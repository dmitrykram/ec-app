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

(function () {
  "use strict";

  function attachPhoneDiagnostic() {
    const phone = document.querySelector("#ec-phone");

    if (!phone || phone.dataset.phoneDiagnostic === "true") {
      return;
    }

    phone.dataset.phoneDiagnostic = "true";

    console.info("[Phone Validator] Phone field found:", {
      type: phone.type,
      required: phone.required,
      maxLength: phone.maxLength
    });

    phone.addEventListener("input", function () {
      console.info("[Phone Validator] Input changed", {
        length: phone.value.length,
        hasValue: phone.value.trim().length > 0
      });
    });

    phone.addEventListener("blur", function () {
      console.info("[Phone Validator] Field blur");
    });
  }

  attachPhoneDiagnostic();

  const observer = new MutationObserver(attachPhoneDiagnostic);

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();
