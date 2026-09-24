/* PWA edition: private MDL checkpoint storage is not isolated from LAB.
   Keep the public local solver available without opening the private worker. */
(() => {
  'use strict';
  window.TripPrivate = Object.freeze({
    init() {
      const option = document.getElementById('chkMdl');
      if (option) { option.checked = false; option.disabled = true; }
    },
    enabled: () => false,
    diagnosticsAvailable: () => false,
    setBusy() {},
    detach() {}
  });
})();
