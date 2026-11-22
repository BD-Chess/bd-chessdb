import { loadBrowserRuntime } from "../runtime_loader.js";
function resolveAsset(flavor) {
  return flavor === "jspi" ? {
    jsUrl: new URL("../../wasm/routing_runtime.js", import.meta.url).href,
    wasmUrl: new URL("../../wasm/routing_runtime.wasm", import.meta.url).href
  } : {
    jsUrl: new URL("../../wasm/routing_runtime_asyncify.js", import.meta.url).href,
    wasmUrl: new URL("../../wasm/routing_runtime_asyncify.wasm", import.meta.url).href
  };
}
const loadRoutingRuntime = () => loadBrowserRuntime("routing_runtime", resolveAsset), loadRoutingRuntimeAsyncify = () => loadBrowserRuntime("routing_runtime", resolveAsset, "asyncify");
export {
  loadRoutingRuntime,
  loadRoutingRuntimeAsyncify
};
