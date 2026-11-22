function isJspiSupported() {
  return typeof globalThis.WebAssembly?.promising == "function";
}
function preferredRuntimeFlavor() {
  return isJspiSupported() ? "jspi" : "asyncify";
}
function createRuntimeLoader(adapter) {
  const modulePromises = {};
  let selectedFlavor = null;
  function selectRuntimeFlavor() {
    return selectedFlavor || (selectedFlavor = preferredRuntimeFlavor(), adapter.logFlavorSelection && console.log(
      selectedFlavor === "jspi" ? "JSPI is supported. Using JSPI runtime." : "Using Asyncify runtime."
    ), selectedFlavor);
  }
  async function createRuntime(runtimeName, resolveAsset, flavor = selectRuntimeFlavor()) {
    const key = `${runtimeName}:${flavor}`;
    modulePromises[key] ?? (modulePromises[key] = (async () => {
      const asset = await resolveAsset(flavor);
      try {
        const createModule = await adapter.loadFactory(asset.jsUrl), moduleOverrides = {
          locateFile: asset.locateFile,
          noExitRuntime: !0
        };
        return asset.wasmBinary && (moduleOverrides.wasmBinary = asset.wasmBinary), asset.mainScriptUrlOrBlob && (moduleOverrides.mainScriptUrlOrBlob = asset.mainScriptUrlOrBlob), await createModule(moduleOverrides);
      } finally {
        asset.cleanupGlobalState?.();
      }
    })());
    const loading = modulePromises[key];
    try {
      return await loading;
    } catch (error) {
      throw modulePromises[key] === loading && delete modulePromises[key], error;
    }
  }
  async function terminateLoadedRuntimeThreads() {
    const loadedModules = Object.entries(modulePromises), modules = await Promise.allSettled(loadedModules.map(([, module]) => module));
    try {
      for (const moduleResult of modules) {
        if (moduleResult.status !== "fulfilled") continue;
        const module = moduleResult.value;
        try {
          Object.prototype.hasOwnProperty.call(module, "PThread") && module.PThread?.terminateAllThreads?.();
        } catch (error) {
          if (!String(error).includes("PThread")) throw error;
        }
      }
    } finally {
      for (const [key, loading] of loadedModules)
        modulePromises[key] === loading && delete modulePromises[key];
    }
  }
  return {
    terminateLoadedRuntimeThreads,
    loadRuntime: createRuntime
  };
}
export {
  createRuntimeLoader,
  isJspiSupported,
  preferredRuntimeFlavor
};
