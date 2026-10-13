const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const DEFAULT_WASM_PARTS = [
  "reckless_bg.wasm.part0",
  "reckless_bg.wasm.part1",
  "reckless_bg.wasm.part2",
  "reckless_bg.wasm.part3",
];

function workerError(message, code = "RECKLESS_ERROR") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function normalizeBaseUrl(value) {
  const url = new URL(value || "./", import.meta.url);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

function moduleBaseUrl() {
  return import.meta.url.slice(0, import.meta.url.lastIndexOf("/") + 1);
}

function fenValidationError(fen) {
  if (typeof fen !== "string") return "FEN must be a string";
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6) return "FEN must contain six fields";

  const ranks = fields[0].split("/");
  if (ranks.length !== 8) return "FEN board must contain eight ranks";

  let whiteKings = 0;
  let blackKings = 0;
  for (const rank of ranks) {
    let squares = 0;
    for (const token of rank) {
      if (/^[1-8]$/.test(token)) squares += Number(token);
      else if (/^[prnbqkPRNBQK]$/.test(token)) {
        squares += 1;
        if (token === "K") whiteKings += 1;
        if (token === "k") blackKings += 1;
      } else return `Invalid FEN board token: ${token}`;
    }
    if (squares !== 8) return "Every FEN rank must describe eight squares";
  }

  if (whiteKings !== 1 || blackKings !== 1) return "FEN must contain exactly one king per side";
  if (!/^[wb]$/.test(fields[1])) return "Invalid FEN side to move";
  if (!/^-$|^(?!.*(.).*\1)[KQkq]+$/.test(fields[2])) return "Invalid FEN castling rights";
  if (!/^-$|^[a-h][36]$/.test(fields[3])) return "Invalid FEN en-passant square";
  if (!/^\d+$/.test(fields[4])) return "Invalid FEN halfmove clock";
  if (!/^[1-9]\d*$/.test(fields[5])) return "Invalid FEN fullmove number";
  return null;
}

function normalizedFenFields(fen) {
  const fields = fen.trim().split(/\s+/);
  return [
    fields[0],
    fields[1],
    fields[2] === "-" ? "-" : [...fields[2]].sort().join(""),
    fields[3],
    String(Number(fields[4])),
    String(Number(fields[5])),
  ];
}

function fenMatches(expected, actual) {
  return normalizedFenFields(expected).join(" ") === normalizedFenFields(actual).join(" ");
}

export function parseInfoLine(line) {
  if (typeof line !== "string") return null;
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== "info") return null;

  const valueAfter = (key) => {
    const index = tokens.indexOf(key);
    return index >= 0 ? tokens[index + 1] : undefined;
  };
  const scoreIndex = tokens.indexOf("score");
  const pvIndex = tokens.indexOf("pv");
  let scoreCp = null;
  let mate = null;

  if (scoreIndex >= 0 && tokens[scoreIndex + 1] === "cp") {
    const value = Number(tokens[scoreIndex + 2]);
    if (Number.isFinite(value)) scoreCp = value;
  } else if (scoreIndex >= 0 && tokens[scoreIndex + 1] === "mate") {
    const value = Number(tokens[scoreIndex + 2]);
    if (Number.isFinite(value)) mate = value;
  }

  return {
    multiPv: finitePositive(valueAfter("multipv")) || 1,
    depth: finitePositive(valueAfter("depth")),
    selDepth: finitePositive(valueAfter("seldepth")),
    scoreCp,
    mate,
    nodes: finitePositive(valueAfter("nodes")),
    nps: finitePositive(valueAfter("nps")),
    timeMs: finitePositive(valueAfter("time")),
    pv: pvIndex >= 0 ? tokens.slice(pvIndex + 1) : [],
    raw: line,
  };
}

export function parseGoCommand(command) {
  const tokens = command.trim().split(/\s+/).slice(1);
  const valueAfter = (key) => {
    const index = tokens.indexOf(key);
    return index >= 0 ? finitePositive(tokens[index + 1]) : 0;
  };
  return {
    movetime: valueAfter("movetime"),
    depth: valueAfter("depth"),
    nodes: valueAfter("nodes"),
  };
}

export function createRecklessWorkerRuntime(scope, dependencies = {}) {
  const fetchAsset = dependencies.fetch || globalThis.fetch?.bind(globalThis);
  const importModule = dependencies.importModule || ((url) => import(url));
  let engine = null;
  let initPromise = null;
  let configuredBaseUrl = null;
  let multiPv = 1;
  let commandQueue = Promise.resolve();

  const post = (message) => scope.postMessage(message);
  const postUci = (line) => post(String(line));

  function respond(requestId, result) {
    post({ type: "response", requestId, ok: true, result });
  }

  function respondError(requestId, error) {
    post({
      type: "response",
      requestId,
      ok: false,
      error: {
        code: error?.code || "RECKLESS_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }

  function emitStructuredLine(requestId, line, info = null) {
    post({ type: "output", requestId, line });
    if (info) post({ type: "info", requestId, line, info });
  }

  async function readResponse(response, url, index, progress, requestId) {
    if (!response.ok) {
      throw workerError(`Unable to load Reckless asset ${url} (${response.status} ${response.statusText})`, "ASSET_LOAD_ERROR");
    }

    const declaredSize = Number(response.headers?.get?.("content-length")) || 0;
    progress.totals[index] = declaredSize;

    const report = () => {
      if (!requestId) return;
      const loaded = progress.loaded.reduce((sum, value) => sum + value, 0);
      const knownTotal = progress.totals.every((value) => value > 0)
        ? progress.totals.reduce((sum, value) => sum + value, 0)
        : null;
      post({ type: "download-progress", requestId, loaded, total: knownTotal, url });
    };

    if (!response.body?.getReader) {
      const buffer = await response.arrayBuffer();
      progress.loaded[index] = buffer.byteLength;
      if (!progress.totals[index]) progress.totals[index] = buffer.byteLength;
      report();
      return new Uint8Array(buffer);
    }

    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      length += value.byteLength;
      progress.loaded[index] = length;
      report();
    }

    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (!progress.totals[index]) progress.totals[index] = length;
    report();
    return bytes;
  }

  async function loadWasmBytes(config, requestId) {
    if (!fetchAsset) throw workerError("fetch() is unavailable in this worker", "ASSET_LOAD_ERROR");
    const baseUrl = normalizeBaseUrl(config.assetBaseUrl || moduleBaseUrl());
    const assetNames = config.wasmFile
      ? [config.wasmFile]
      : Array.isArray(config.wasmParts) && config.wasmParts.length
        ? config.wasmParts
        : DEFAULT_WASM_PARTS;
    const urls = assetNames.map((name) => new URL(name, baseUrl).href);
    const progress = { loaded: urls.map(() => 0), totals: urls.map(() => 0) };
    const responses = await Promise.all(urls.map((url) => fetchAsset(url)));
    const parts = await Promise.all(
      responses.map((response, index) => readResponse(response, urls[index], index, progress, requestId)),
    );
    const totalLength = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const bytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    if (bytes[0] !== 0 || bytes[1] !== 97 || bytes[2] !== 115 || bytes[3] !== 109) {
      throw workerError("Loaded Reckless assets do not form a valid WebAssembly module", "INVALID_WASM");
    }
    return { bytes, baseUrl };
  }

  async function ensureInitialized(config = {}, requestId = null) {
    if (engine) {
      if (config.assetBaseUrl && normalizeBaseUrl(config.assetBaseUrl) !== configuredBaseUrl) {
        throw workerError("Reckless is already initialized with a different assetBaseUrl", "ALREADY_INITIALIZED");
      }
      return engine;
    }
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const { bytes, baseUrl } = await loadWasmBytes(config, requestId);
      const moduleUrl = new URL(config.glueFile || "reckless.js", baseUrl).href;
      let bindings;
      try {
        bindings = await importModule(moduleUrl);
      } catch (error) {
        throw workerError(
          `Unable to import Reckless bindings from ${moduleUrl}: ${error instanceof Error ? error.message : error}`,
          "ASSET_LOAD_ERROR",
        );
      }
      if (typeof bindings.default !== "function" || typeof bindings.Engine !== "function") {
        throw workerError(`Invalid Reckless bindings module at ${moduleUrl}`, "INVALID_BINDINGS");
      }
      await bindings.default({ module_or_path: bytes });
      engine = new bindings.Engine();
      engine.set_threads(1);
      configuredBaseUrl = baseUrl;
      return engine;
    })();

    try {
      return await initPromise;
    } catch (error) {
      initPromise = null;
      throw error;
    }
  }

  function setPosition(fen) {
    const validationError = fenValidationError(fen);
    if (validationError) throw workerError(validationError, "INVALID_FEN");
    const previous = engine.fen();
    engine.set_position(fen.trim());
    const actual = engine.fen();
    if (!fenMatches(fen, actual)) {
      engine.set_position(previous);
      throw workerError("Reckless rejected the supplied FEN", "INVALID_FEN");
    }
    return actual;
  }

  function makeMove(move) {
    const normalized = String(move || "").trim().toLowerCase();
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(normalized)) {
      throw workerError(`Invalid UCI move: ${normalized || "(empty)"}`, "ILLEGAL_MOVE");
    }
    const before = engine.fen();
    engine.make_move(normalized);
    const fen = engine.fen();
    if (before === fen) throw workerError(`Illegal move in the current position: ${normalized}`, "ILLEGAL_MOVE");
    return { move: normalized, fen };
  }

  function runSearch(options, onLine) {
    const latestLines = new Map();
    const callback = (line) => {
      const info = parseInfoLine(line);
      if (info) latestLines.set(info.multiPv, info);
      onLine(line, info);
    };
    const requestedMultiPv = Math.min(10, Math.max(1, finitePositive(options.multiPv) || multiPv));
    const movetime = finitePositive(options.movetime);
    const depth = finitePositive(options.depth);
    const nodes = finitePositive(options.nodes);

    if (options.infinite) engine.go_uci(0, 0, requestedMultiPv, callback);
    else if (nodes || depth) engine.go_uci(depth, nodes, requestedMultiPv, callback);
    else engine.go_movetime(movetime || 1000, requestedMultiPv, callback);

    const rawBestMove = engine.last_bestmove();
    const bestMove = rawBestMove && rawBestMove !== "(none)" ? rawBestMove : null;
    const lines = [...latestLines.values()].sort((a, b) => a.multiPv - b.multiPv);
    const primary = lines.find((line) => line.multiPv === 1) || null;
    return {
      bestMove,
      scoreCp: primary?.scoreCp ?? null,
      mate: primary?.mate ?? null,
      depth: primary?.depth || Math.max(0, Number(engine.last_depth()) || 0),
      nodes: Math.max(primary?.nodes || 0, Number(engine.last_nodes()) || 0),
      lines,
      fen: engine.fen(),
    };
  }

  function applyPositionCommand(command) {
    const rest = command.slice("position ".length).trim();
    const movesMarker = rest.indexOf(" moves ");
    const positionPart = movesMarker >= 0 ? rest.slice(0, movesMarker) : rest;
    const moves = movesMarker >= 0 ? rest.slice(movesMarker + 7).trim().split(/\s+/).filter(Boolean) : [];

    if (positionPart === "startpos") setPosition(START_FEN);
    else if (positionPart.startsWith("fen ")) setPosition(positionPart.slice(4));
    else throw workerError("position requires startpos or fen", "INVALID_POSITION_COMMAND");

    for (const move of moves) makeMove(move);
  }

  async function handleUci(commandValue) {
    const command = commandValue.trim();
    if (!command) return;
    if (command === "uci") {
      postUci("id name Reckless 0.10.0-dev");
      postUci("id author codedeliveryservice");
      postUci("option name MultiPV type spin default 1 min 1 max 10");
      postUci("uciok");
      return;
    }
    if (command === "isready") {
      await ensureInitialized();
      postUci("readyok");
      return;
    }
    if (command === "ucinewgame") {
      await ensureInitialized();
      engine.reset();
      engine.set_position(START_FEN);
      return;
    }
    if (command.startsWith("setoption ")) {
      const match = command.match(/^setoption\s+name\s+MultiPV\s+value\s+(\d+)$/i);
      if (match) multiPv = Math.min(10, Math.max(1, Number(match[1])));
      else postUci(`info string unsupported option: ${command}`);
      return;
    }
    if (command.startsWith("position ")) {
      await ensureInitialized();
      applyPositionCommand(command);
      return;
    }
    if (command === "go" || command.startsWith("go ")) {
      await ensureInitialized();
      const result = runSearch({ ...parseGoCommand(command), multiPv }, (line) => postUci(line));
      postUci(`bestmove ${result.bestMove || "(none)"}`);
      return;
    }
    if (command === "stop") {
      // A synchronous WASM search blocks this worker's event loop. The command
      // can only be observed after that search has already returned.
      return;
    }
    if (command === "quit") {
      engine?.free?.();
      scope.close?.();
      return;
    }
    postUci(`info string unsupported command: ${command}`);
  }

  async function handleStructured(message) {
    const requestId = message.requestId;
    if (!requestId) throw workerError("Structured messages require a requestId", "MISSING_REQUEST_ID");

    if (message.type === "init") {
      await ensureInitialized(message, requestId);
      respond(requestId, { name: "Reckless", version: "0.10.0-dev", fen: engine.fen() });
      return;
    }

    await ensureInitialized({}, requestId);
    if (message.type === "set-position") {
      respond(requestId, { fen: setPosition(message.fen) });
      return;
    }
    if (message.type === "make-move") {
      respond(requestId, makeMove(message.move));
      return;
    }
    if (message.type === "analyze") {
      if (message.fen) setPosition(message.fen);
      const result = runSearch(message, (line, info) => emitStructuredLine(requestId, line, info));
      emitStructuredLine(requestId, `bestmove ${result.bestMove || "(none)"}`);
      respond(requestId, result);
      return;
    }
    if (message.type === "new-game") {
      engine.reset();
      engine.set_position(START_FEN);
      respond(requestId, { fen: engine.fen() });
      return;
    }
    if (message.type === "get-fen") {
      respond(requestId, { fen: engine.fen() });
      return;
    }
    if (message.type === "stop") {
      respond(requestId, {
        interrupted: false,
        reason: "Synchronous Reckless WASM searches must be cancelled by terminating the worker",
      });
      return;
    }
    if (message.type === "quit") {
      respond(requestId, { closed: true });
      engine?.free?.();
      scope.close?.();
      return;
    }
    throw workerError(`Unsupported structured command: ${message.type}`, "UNSUPPORTED_COMMAND");
  }

  async function handleMessage(data) {
    if (typeof data === "string") return handleUci(data);
    if (data && typeof data === "object") return handleStructured(data);
    throw workerError("Worker messages must be UCI strings or structured objects", "INVALID_MESSAGE");
  }

  function reportError(data, error) {
    if (typeof data === "string") postUci(`info string ${error instanceof Error ? error.message : error}`);
    else respondError(data?.requestId ?? null, error);
  }

  function onMessage(event) {
    const data = event.data;
    commandQueue = commandQueue.then(() => handleMessage(data)).catch((error) => reportError(data, error));
  }

  scope.addEventListener("message", onMessage);
  return {
    handleMessage,
    dispose() {
      scope.removeEventListener?.("message", onMessage);
      engine?.free?.();
      engine = null;
    },
  };
}

if (typeof self !== "undefined" && typeof self.postMessage === "function" && typeof document === "undefined") {
  createRecklessWorkerRuntime(self);
}
