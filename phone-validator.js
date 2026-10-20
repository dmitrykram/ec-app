
(function () {
  "use strict";

  if (window.__ecwidPhoneValidatorV2) return;
  window.__ecwidPhoneValidatorV2 = true;

  const LIB_URL =
    "https://unpkg.com/libphonenumber-js@1.11.20/bundle/libphonenumber-js.min.js";

  const STYLE_ID = "epv-styles";
  const COUNTRY_FIELD =
    'input[name="country"][autocomplete="shipping country"]';

  let observer = null;

  // --------------------------------------------------
  // 1. Load libphonenumber-js
  // --------------------------------------------------

  function loadLibrary() {
    const existing = window.libphonenumber;

    if (existing && typeof existing.getCountries === "function") {
      return Promise.resolve(existing);
    }

    if (window.__epvLibraryPromise) {
      return window.__epvLibraryPromise;
    }

    window.__epvLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src = LIB_URL;
      script.async = true;

      script.onload = function () {
        const lib = window.libphonenumber;

        if (lib && typeof lib.getCountries === "function") {
          resolve(lib);
          return;
        }

        reject(
          new Error(
            "Library loaded, but its browser API was not found. " +
            "Check the script URL and browser console."
          )
        );
      };

      script.onerror = function () {
        reject(new Error("Failed to download libphonenumber-js."));
      };

      document.head.appendChild(script);
    });

    return window.__epvLibraryPromise;
  }

  // --------------------------------------------------
  // 2. Styles
  // --------------------------------------------------

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      .epv-root {
        display: flex;
        position: relative;
        width: 100%;
        align-items: stretch;
        gap: 8px;
        margin-bottom: 6px;
        font: inherit;
      }

      .epv-country {
        position: relative;
        flex: 0 0 112px;
        min-width: 0;
      }

      .epv-trigger {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        width: 100%;
        min-height: 44px;
        padding: 9px;
        border: 1px solid #c8cdd2;
        border-radius: 5px;
        background: #fff;
        color: #222;
        font: inherit;
        cursor: pointer;
      }

      .epv-trigger:focus-visible,
      .epv-search:focus-visible,
      .epv-option:focus-visible {
        outline: 2px solid #2878e3;
        outline-offset: 2px;
      }

      .epv-menu {
        position: absolute;
        z-index: 999999;
        top: calc(100% + 4px);
        left: 0;
        width: 280px;
        max-width: 80vw;
        padding: 8px;
        border: 1px solid #d5d9dd;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 5px 24px rgba(0, 0, 0, .16);
      }

      .epv-menu[hidden],
      .epv-error[hidden],
      .epv-status[hidden] {
        display: none;
      }

      .epv-search {
        box-sizing: border-box;
        width: 100%;
        padding: 10px;
        border: 1px solid #c8cdd2;
        border-radius: 5px;
        font: inherit;
      }

      .epv-options {
        max-height: 230px;
        overflow-y: auto;
        margin-top: 6px;
      }

      .epv-option {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 9px 7px;
        border: 0;
        border-radius: 4px;
        background: #fff;
        color: #222;
        text-align: left;
        font: inherit;
        cursor: pointer;
      }

      .epv-option:hover,
      .epv-option[aria-selected="true"] {
        background: #edf4ff;
      }

      .epv-option-name {
        flex: 1;
      }

      .epv-option-code {
        color: #66707a;
      }

      .epv-error {
        margin-top: 5px;
        color: #c62828;
        font-size: 13px;
        line-height: 1.4;
      }

      .epv-status {
        margin-top: 5px;
        color: #68727d;
        font-size: 12px;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }

      .epv-root.epv-invalid .epv-trigger {
        border-color: #c62828;
      }

      @media (max-width: 480px) {
        .epv-country {
          flex-basis: 100px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // --------------------------------------------------
  // 3. Country helpers
  // --------------------------------------------------

  function getCountries(lib) {
    const displayNames = new Intl.DisplayNames(
      ["en"],
      { type: "region" }
    );

    return lib.getCountries()
      .map(code => ({
        code,
        name: displayNames.of(code) || code,
        dial: "+" + lib.getCountryCallingCode(code)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function getCountryFromCheckout(lib, countries) {
    const input = document.querySelector(COUNTRY_FIELD);

    if (!input || !input.value.trim()) return null;

    const value = input.value.trim();
    const upper = value.toUpperCase();

    if (lib.getCountries().includes(upper)) {
      return upper;
    }

    const match = countries.find(country =>
      country.name.toLowerCase() === value.toLowerCase()
    );

    return match ? match.code : null;
  }

  function flag(code) {
    return code
      .toUpperCase()
      .replace(/[A-Z]/g, letter =>
        String.fromCodePoint(127397 + letter.charCodeAt(0))
      );
  }

  // --------------------------------------------------
  // 4. Mount UI beside the original Ecwid input
  // --------------------------------------------------

  function mount(phone, lib, countries) {
    if (!phone || !phone.isConnected) return;
    if (phone.dataset.epvMounted === "true") return;
    if (phone.disabled || phone.readOnly) return;

    phone.dataset.epvMounted = "true";

    const root = document.createElement("div");
    root.className = "epv-root";

    const countryBox = document.createElement("div");
    countryBox.className = "epv-country";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "epv-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const menu = document.createElement("div");
    menu.className = "epv-menu";
    menu.hidden = true;

    const search = document.createElement("input");
    search.type = "search";
    search.className = "epv-search";
    search.placeholder = "Search country...";
    search.setAttribute("aria-label", "Search country");

    const options = document.createElement("div");
    options.className = "epv-options";
    options.setAttribute("role", "listbox");

    menu.append(search, options);
    countryBox.append(trigger, menu);

    const error = document.createElement("div");
    error.className = "epv-error";
    error.hidden = true;
    error.setAttribute("role", "alert");

    const status = document.createElement("div");
    status.className = "epv-status";
    status.hidden = true;
    status.setAttribute("aria-live", "polite");

    // Keep the original Ecwid input element.
    phone.parentNode.insertBefore(root, phone);
    root.append(countryBox, phone);

    phone.insertAdjacentElement("afterend", error);
    error.insertAdjacentElement("afterend", status);

    phone.style.minWidth = "0";
    phone.style.flex = "1 1 auto";
    phone.style.boxSizing = "border-box";

    let selectedCode =
      getCountryFromCheckout(lib, countries) || "US";

    if (!lib.getCountries().includes(selectedCode)) {
      selectedCode = "US";
    }

    let touched = false;

    function selectedCountry() {
      return countries.find(country =>
        country.code === selectedCode
      );
    }

    function updateTrigger() {
      const country = selectedCountry();

      trigger.replaceChildren();

      const flagElement = document.createElement("span");
      flagElement.textContent = flag(country.code);
      flagElement.setAttribute("aria-hidden", "true");

      const dial = document.createElement("span");
      dial.textContent = country.dial;

      const arrow = document.createElement("span");
      arrow.textContent = "▾";
      arrow.setAttribute("aria-hidden", "true");

      trigger.append(flagElement, dial, arrow);
      trigger.title = country.name;
      trigger.setAttribute(
        "aria-label",
        "Phone country: " + country.name + " " + country.dial
      );
    }

    function renderOptions(query) {
      const q = query.trim().toLowerCase();
      options.replaceChildren();

      const filtered = countries.filter(country =>
        country.name.toLowerCase().includes(q) ||
        country.code.toLowerCase() === q ||
        country.dial.includes(q)
      );

      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "epv-status";
        empty.textContent = "No countries found";
        options.appendChild(empty);
        return;
      }

      filtered.forEach(country => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "epv-option";
        button.setAttribute("role", "option");
        button.setAttribute(
          "aria-selected",
          String(country.code === selectedCode)
        );

        const flagElement = document.createElement("span");
        flagElement.textContent = flag(country.code);

        const name = document.createElement("span");
        name.className = "epv-option-name";
        name.textContent = country.name;

        const dial = document.createElement("span");
        dial.className = "epv-option-code";
        dial.textContent = country.dial;

        button.append(flagElement, name, dial);

        button.addEventListener("click", () => {
          selectedCode = country.code;
          updateTrigger();
          closeMenu();
          validate();
          phone.focus();
        });

        options.appendChild(button);
      });
    }

    function openMenu() {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      search.value = "";
      renderOptions("");
      search.focus();
    }

    function closeMenu() {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    }

    function validate() {
      const raw = phone.value.trim();

      root.classList.remove("epv-invalid");
      error.hidden = true;
      error.textContent = "";
      status.hidden = true;
      status.textContent = "";

      if (!raw) {
        phone.removeAttribute("aria-invalid");
        phone.dataset.epvValid = "false";
        delete phone.dataset.epvE164;
        return;
      }

      try {
        const parsed = lib.parsePhoneNumberFromString(
          raw,
          selectedCode
        );

        if (!parsed || !parsed.isPossible()) {
          throw new Error("Please check the phone number length.");
        }

        if (!parsed.isValid()) {
          throw new Error("Please enter a valid phone number.");
        }

        if (parsed.country && parsed.country !== selectedCode) {
          throw new Error(
            "This number appears to belong to another country. " +
            "Please select the correct country code."
          );
        }

        phone.dataset.epvValid = "true";
        phone.dataset.epvE164 = parsed.number;
        phone.removeAttribute("aria-invalid");

        status.textContent =
          "Valid format · International: " + parsed.number;
        status.hidden = false;

        console.info("[Phone Validator] Valid number", {
          country: selectedCode,
          international: parsed.number
        });
      } catch (err) {
        phone.dataset.epvValid = "false";
        delete phone.dataset.epvE164;
        phone.setAttribute("aria-invalid", "true");

        if (touched) {
          root.classList.add("epv-invalid");
          error.textContent =
            err.message || "Please enter a valid phone number.";
          error.hidden = false;
        }

        console.info("[Phone Validator] Invalid number", {
          country: selectedCode,
          reason: err.message
        });
      }
    }

    trigger.addEventListener("click", () => {
      if (menu.hidden) openMenu();
      else closeMenu();
    });

    search.addEventListener("input", () => {
      renderOptions(search.value);
    });

    document.addEventListener("click", event => {
      if (!countryBox.contains(event.target)) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !menu.hidden) {
        closeMenu();
        trigger.focus();
      }
    });

    phone.addEventListener("input", validate);

    phone.addEventListener("blur", () => {
      touched = true;
      validate();
    });

    updateTrigger();
    validate();

    console.info("[Phone Validator] UI mounted", {
      country: selectedCode,
      phoneFieldPreserved: true
    });
  }

  // --------------------------------------------------
  // 5. Observe Ecwid checkout updates
  // --------------------------------------------------

  function start(lib) {
    addStyles();

    const countries = getCountries(lib);

    function scan() {
      const phone = document.querySelector("#ec-phone");

      if (phone) {
        mount(phone, lib, countries);
      }
    }

    scan();

    observer = new MutationObserver(scan);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.info("[Phone Validator] Ready", {
      countries: countries.length
    });
  }

  // --------------------------------------------------
  // 6. Initialize
  // --------------------------------------------------

  loadLibrary()
    .then(lib => start(lib))
    .catch(error => {
      console.error(
        "[Phone Validator] Failed to initialize:",
        error
      );
    });
})();
