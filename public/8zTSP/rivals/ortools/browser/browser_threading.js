const key = /* @__PURE__ */ Symbol.for("or-tools-wasm.single-thread-warning"), host = globalThis, state = () => host[key] ?? (host[key] = { enabled: !0, printed: !1 });
function setSingleThreadWarningEnabled(enabled) {
  state().enabled = enabled;
}
function isSingleThreadedBrowser() {
  return typeof globalThis.crossOriginIsolated == "boolean" && (globalThis.crossOriginIsolated !== !0 || typeof globalThis.SharedArrayBuffer != "function");
}
function warnSingleThreadedBrowser() {
  if (typeof document > "u") return;
  const notice = state();
  if (!(!isSingleThreadedBrowser() || !notice.enabled || notice.printed)) {
    notice.printed = !0;
    try {
      console.warn("OR-Tools WASM is running with one solver thread because cross-origin isolation is unavailable. Automatic execution runs directly and may block the UI. Enable COOP/COEP headers for parallel solving and shared worker callbacks/cancellation. To hide this warning, call setSingleThreadWarningEnabled(false).");
    } catch {
    }
  }
}
export {
  isSingleThreadedBrowser,
  setSingleThreadWarningEnabled,
  warnSingleThreadedBrowser
};
