import { warnSingleThreadedBrowser } from "./browser_threading.js";
import {
  createRuntimeLoader
} from "./runtime_loader_core.js";
import { isJspiSupported } from "./runtime_loader_core.js";
const loader = createRuntimeLoader({
  logFlavorSelection: !0,
  async loadFactory(runtimeUrl) {
    const { default: createModule } = await import(
      /* webpackIgnore: true */
      /* @vite-ignore */
      runtimeUrl
    );
    return createModule;
  }
}), terminateLoadedRuntimeThreads = loader.terminateLoadedRuntimeThreads;
function loadBrowserRuntime(name, resolveAsset, flavor) {
  return loader.loadRuntime(name, (selectedFlavor) => {
    warnSingleThreadedBrowser();
    const asset = resolveAsset(selectedFlavor), baseName = selectedFlavor === "asyncify" ? `${name}_asyncify` : name;
    return {
      jsUrl: asset.jsUrl,
      // Let Emscripten compile the response as it streams instead of buffering it.
      locateFile: (file) => file === `${baseName}.wasm` ? asset.wasmUrl : file === `${baseName}.js` ? asset.jsUrl : file,
      mainScriptUrlOrBlob: asset.jsUrl
    };
  }, flavor);
}
export {
  isJspiSupported,
  loadBrowserRuntime,
  terminateLoadedRuntimeThreads
};
