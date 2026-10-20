
(function () {
  "use strict";

  if (window.__phoneValidatorDiagnosticLoaded) {
    return;
  }

  window.__phoneValidatorDiagnosticLoaded = true;

  console.info("[Phone Validator] Script loaded", {
    url: window.location.href,
    ecwidAvailable: typeof window.Ecwid !== "undefined"
  });

  function reportEcwid() {
    if (!window.Ecwid) {
      console.info("[Phone Validator] Waiting for Ecwid API");
      return;
    }

    try {
      console.info("[Phone Validator] Ecwid API detected");

      if (typeof Ecwid.getInitializedWidgets === "function") {
        console.info(
          "[Phone Validator] Widgets:",
          Ecwid.getInitializedWidgets()
        );
      }

      if (typeof Ecwid.getOwnerId === "function") {
        console.info(
          "[Phone Validator] Store ID:",
          Ecwid.getOwnerId()
        );
      }
    } catch (error) {
      console.warn("[Phone Validator] Diagnostic error:", error);
    }
  }

  if (window.Ecwid && Ecwid.OnAPILoaded) {
    Ecwid.OnAPILoaded.add(reportEcwid);
  } else {
    document.addEventListener("DOMContentLoaded", reportEcwid);
  }
})();
