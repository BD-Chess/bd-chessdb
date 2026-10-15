const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const DEFAULT_WASM_PARTS = [
  "reckless_bg.wasm.part0",
  "reckless_bg.wasm.part1",
  "reckless_bg.wasm.part2",
  "reckless_bg.wasm.part3",
];

function environmentBaseUrl() {
  if (typeof document !== "undefined" && document.baseURI) return document.baseURI;
  if (typeof location !== "undefined" && location.href) return location.href;
  return import.meta.url;
}

function moduleBaseUrl() {
  return import.meta.url.slice(0, import.meta.url.lastIndexOf("/") + 1);
}

function resolveUrl(value, fallback) {
  if (value instanceof URL) return value.href;
  return new URL(value || fallback, environmentBaseUrl()).href;
}

function normalizeBaseUrl(value) {
  const url = new URL(resolveUrl(value, moduleBaseUrl()));
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

function createError(payload) {
  const error = new Error(payload?.message || "Reckless worker request failed");
  error.name = payload?.code === "ABORTED" ? "AbortError" : "RecklessError";
  error.code = payload?.code || "RECKLESS_ERROR";
  return error;
}

function abortError(message = "Reckless analysis was cancelled") {
  return createError({ code: "ABORTED", message });
}

function attachWorkerListener(worker, type, listener) {
  if (typeof worker.addEventListener === "function") worker.addEventListener(type, listener);
  else worker[`on${type}`] = listener;
}

export class RecklessEngine {
  constructor(options = {}) {
    this.assetBaseUrl = normalizeBaseUrl(options.assetBaseUrl);
    this.workerUrl = resolveUrl(options.workerUrl, `${moduleBaseUrl()}reckless-worker.js`);
    this.glueFile = options.glueFile || "reckless.js";
    this.wasmFile = options.wasmFile || null;
    this.wasmParts = options.wasmParts?.length ? [...options.wasmParts] : [...DEFAULT_WASM_PARTS];
    this._workerFactory =
      options.workerFactory ||
      ((url, workerOptions) => {
        if (typeof Worker === "undefined") {
          throw new Error("Web Workers are unavailable in this environment");
        }
        return new Worker(url, workerOptions);
      });
    this._worker = null;
    this._workerGeneration = 0;
    this._requestSequence = 0;
    this._pending = new Map();
    this._ready = false;
    this._readyPromise = null;
    this._terminated = false;
    this._fen = START_FEN;
    this._analysisSequence = 0;
    this._activeAnalysisToken = 0;
    this._activeSearchRequestId = null;
    this._infoCallbacks = new Set();
    this._outputCallbacks = new Set();
    this._progressCallbacks = new Set();
  }

  async init() {
    if (this._terminated) throw createError({ code: "TERMINATED", message: "This RecklessEngine has been terminated" });
    if (this._ready) return this;
    if (this._readyPromise) return this._readyPromise;
    if (!this._worker) this._spawnWorker();

    const { promise } = this._request("init", {
      assetBaseUrl: this.assetBaseUrl,
      glueFile: this.glueFile,
      wasmFile: this.wasmFile,
      wasmParts: this.wasmFile ? undefined : this.wasmParts,
    });
    this._readyPromise = promise
      .then((result) => {
        this._ready = true;
        this._fen = result.fen || START_FEN;
        return this;
      })
      .catch((error) => {
        this._readyPromise = null;
        throw error;
      });
    return this._readyPromise;
  }

  async setPosition(fen) {
    await this._cancelActiveAnalysis();
    await this.init();
    const { promise } = this._request("set-position", { fen });
    const result = await promise;
    this._fen = result.fen;
    return this._fen;
  }

  async makeMove(uciMove) {
    await this._cancelActiveAnalysis();
    await this.init();
    const { promise } = this._request("make-move", { move: uciMove });
    const result = await promise;
    this._fen = result.fen;
    return result;
  }

  async analyze(options = {}) {
    const token = ++this._analysisSequence;
    const previousToken = this._activeAnalysisToken;
    this._activeAnalysisToken = token;

    if (previousToken) await this._restartWorker("Superseded by a newer Reckless analysis");
    if (this._activeAnalysisToken !== token) throw abortError();

    try {
      await this.init();
      if (this._activeAnalysisToken !== token) throw abortError();
      if (options.fen) {
        const { promise: positionPromise } = this._request("set-position", { fen: options.fen });
        const position = await positionPromise;
        if (this._activeAnalysisToken !== token) throw abortError();
        this._fen = position.fen;
      }

      const { requestId, promise } = this._request("analyze", {
        movetime: options.movetime,
        depth: options.depth,
        nodes: options.nodes,
        multiPv: options.multiPv,
        infinite: options.infinite === true,
      });
      this._activeSearchRequestId = requestId;
      const result = await promise;
      if (this._activeAnalysisToken !== token) throw abortError();
      return result;
    } finally {
      if (this._activeAnalysisToken === token) this._activeAnalysisToken = 0;
      this._activeSearchRequestId = null;
    }
  }

  async stop() {
    ++this._analysisSequence;
    this._activeAnalysisToken = 0;
    if (!this._worker) return;
    try {
      await this._restartWorker("Reckless analysis was stopped");
    } catch (error) {
      if (this._terminated || error?.code === "TERMINATED") return;
      throw error;
    }
  }

  async newGame() {
    await this._cancelActiveAnalysis();
    await this.init();
    const { promise } = this._request("new-game");
    const result = await promise;
    this._fen = result.fen;
    return this._fen;
  }

  async getFen() {
    await this.init();
    const { promise } = this._request("get-fen");
    const result = await promise;
    this._fen = result.fen;
    return this._fen;
  }

  terminate() {
    this._terminated = true;
    this._activeAnalysisToken = 0;
    this._destroyWorker(createError({ code: "TERMINATED", message: "RecklessEngine was terminated" }));
  }

  onInfo(callback) {
    if (typeof callback !== "function") throw new TypeError("onInfo requires a callback");
    this._infoCallbacks.add(callback);
    return () => this._infoCallbacks.delete(callback);
  }

  onOutput(callback) {
    if (typeof callback !== "function") throw new TypeError("onOutput requires a callback");
    this._outputCallbacks.add(callback);
    return () => this._outputCallbacks.delete(callback);
  }

  onDownloadProgress(callback) {
    if (typeof callback !== "function") throw new TypeError("onDownloadProgress requires a callback");
    this._progressCallbacks.add(callback);
    return () => this._progressCallbacks.delete(callback);
  }

  _spawnWorker() {
    const generation = ++this._workerGeneration;
    const worker = this._workerFactory(this.workerUrl, { type: "module", name: "reckless-engine" });
    this._worker = worker;
    attachWorkerListener(worker, "message", (event) => {
      if (generation === this._workerGeneration) this._handleMessage(event.data);
    });
    attachWorkerListener(worker, "error", (event) => {
      if (generation !== this._workerGeneration) return;
      const message = event?.message || "The Reckless worker stopped unexpectedly";
      this._destroyWorker(createError({ code: "WORKER_ERROR", message }));
    });
  }

  _request(type, payload = {}) {
    if (!this._worker) throw createError({ code: "WORKER_UNAVAILABLE", message: "Reckless worker is unavailable" });
    const requestId = `reckless-${++this._requestSequence}`;
    let resolveRequest;
    let rejectRequest;
    const promise = new Promise((resolve, reject) => {
      resolveRequest = resolve;
      rejectRequest = reject;
    });
    this._pending.set(requestId, { resolve: resolveRequest, reject: rejectRequest, type });
    try {
      this._worker.postMessage({ type, requestId, ...payload });
    } catch (error) {
      this._pending.delete(requestId);
      rejectRequest(error);
    }
    return { requestId, promise };
  }

  _handleMessage(message) {
    if (typeof message === "string") {
      this._emit(this._outputCallbacks, message, { line: message, protocol: "uci" });
      return;
    }
    if (!message || typeof message !== "object") return;
    if (message.type === "output") {
      this._emit(this._outputCallbacks, message.line, message);
      return;
    }
    if (message.type === "info") {
      if (message.requestId !== this._activeSearchRequestId) return;
      this._emit(this._infoCallbacks, message.info, message);
      return;
    }
    if (message.type === "download-progress") {
      this._emit(this._progressCallbacks, {
        loaded: message.loaded,
        total: message.total,
        url: message.url,
      }, message);
      return;
    }
    if (message.type !== "response") return;

    const pending = this._pending.get(message.requestId);
    if (!pending) return;
    this._pending.delete(message.requestId);
    if (message.ok) pending.resolve(message.result);
    else pending.reject(createError(message.error));
  }

  _emit(callbacks, value, event) {
    for (const callback of callbacks) {
      try {
        callback(value, event);
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }

  async _cancelActiveAnalysis() {
    if (this._activeAnalysisToken) await this.stop();
  }

  async _restartWorker(reason) {
    const restoreFen = this._fen;
    this._destroyWorker(abortError(reason));
    if (this._terminated) return;
    await this.init();
    if (restoreFen !== START_FEN) {
      const { promise } = this._request("set-position", { fen: restoreFen });
      const result = await promise;
      this._fen = result.fen;
    }
  }

  _destroyWorker(error) {
    const worker = this._worker;
    this._worker = null;
    this._ready = false;
    this._readyPromise = null;
    this._activeSearchRequestId = null;
    ++this._workerGeneration;
    worker?.terminate?.();
    for (const pending of this._pending.values()) pending.reject(error);
    this._pending.clear();
  }
}

export { START_FEN };
