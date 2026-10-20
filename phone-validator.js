
(function () {
  "use strict";

  if (window.__ecwidPhoneValidatorV1) return;
  window.__ecwidPhoneValidatorV1 = true;

  const LIB_URL =
    "https://unpkg.com/libphonenumber-js@1.11.20/bundle/libphonenumber-max.js";

  const STYLE_ID = "epv-styles";
  const WIDGET_ID = "epv-widget";

  function loadLibrary() {
    if (window.libphonenumber) return Promise.resolve();

    if (window.__epvLibraryPromise) return window.__epvLibraryPromise;

    window.__epvLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = LIB_URL;
      script.async = true;
      script.onload = () => {
        if (window.libphonenumber) resolve();
        else reject(new Error("Phone library did not initialize"));
      };
      script.onerror = () => reject(new Error("Could not load phone library"));
      document.head.appendChild(script);
    });

    return window.__epvLibraryPromise;
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .epv-root {
        position: relative;
        display: flex;
        width: 100%;
        gap: 8px;
        align-items: stretch;
        margin: 0 0 6px;
        font: inherit;
      }
      .epv-country {
        position: relative;
        flex: 0 0 116px;
        min-width: 0;
      }
      .epv-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 7px;
        width: 100%;
        height: 100%;
        min-height: 44px;
        padding: 10px;
        border: 1px solid #c8cdd2;
        border-radius: 5px;
        background: #fff;
        color: #222;
        cursor: pointer;
        font: inherit;
      }
      .epv-trigger:focus-visible,
      .epv-search:focus-visible,
      .epv-option:focus-visible {
        outline: 2px solid #2878e3;
        outline-offset: 2px;
      }
      .epv-code {
        white-space: nowrap;
      }
      .epv-arrow {
        color: #606870;
      }
      .epv-menu {
        position: absolute;
        z-index: 999999;
        top: calc(100% + 4px);
        left: 0;
        width: 290px;
        max-width: min(290px, 80vw);
        padding: 8px;
        background: #fff;
        border: 1px solid #d5d9dd;
        border-radius: 8px;
        box-shadow: 0 5px 24px rgba(0,0,0,.16);
      }
      .epv-menu[hidden] {
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
        gap: 9px;
        width: 100%;
        padding: 9px 7px;
        border: 0;
        border-radius: 4px;
        background: #fff;
        color: #222;
        text-align: left;
        cursor: pointer;
        font: inherit;
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
        margin: 5px 0 0;
        color: #c62828;
        font-size: 13px;
        line-height: 1.4;
      }
      .epv-status {
        margin: 5px 0 0;
        color: #68727d;
        font-size: 12px;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }
      .epv-error[hidden],
      .epv-status[hidden] {
        display: none;
      }
      .epv-root.epv-invalid button.epv-trigger {
        border-color: #c62828;
      }
      @media (max-width: 480px) {
        .epv-country {
          flex-basis: 105px;
        }
        .epv-menu {
          width: 270px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function countryFlag(code) {
    return code
      .toUpperCase()
      .replace(/[A-Z]/g, c =>
        String.fromCodePoint(127397 + c.charCodeAt(0))
      );
  }

  function getCountries(phoneLib) {
    const names = new Intl.DisplayNames(["en"], { type: "region" });

    return phoneLib.getCountries()
      .map(code => ({
        code,
        name: names.of(code) || code,
        dial: "+" + phoneLib.getCountryCallingCode(code)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function getCountryFromCheckout(phoneLib, countries) {
    const input = document.querySelector(
      'input[name="country"][autocomplete="shipping country"]'
    );

    if (!input || !input.value.trim()) return null;

    const raw = input.value.trim();
    const upper = raw.toUpperCase();

    // Some checkout implementations may expose an ISO country code.
    if (phoneLib.getCountries().includes(upper)) return upper;

    // Otherwise try matching the visible country name.
    const match = countries.find(c =>
      c.name.toLowerCase() === raw.toLowerCase()
    );

    return match ? match.code : null;
  }

  function mount(phone, phoneLib, countries) {
    if (!phone || !phone.isConnected) return;
    if (phone.dataset.epvMounted === "true") return;

    // Avoid silently changing a field that is not a normal checkout input.
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

    // Preserve Ecwid's original input element and its event handlers.
    // The selector is inserted immediately before it.
    phone.parentNode.insertBefore(root, phone);
    root.append(countryBox, phone);
    phone.insertAdjacentElement("afterend", error);
    error.insertAdjacentElement("afterend", status);

    phone.style.minWidth = "0";
    phone.style.flex = "1 1 auto";
    phone.style.boxSizing = "border-box";
    phone.placeholder = phone.placeholder || "Phone number";

    let selectedCode =
      getCountryFromCheckout(phoneLib, countries) || "US";

    if (!phoneLib.getCountries().includes(selectedCode)) {
      selectedCode = "US";
    }

    let touched = false;

    function selectedCountry() {
      return countries.find(c => c.code === selectedCode);
    }

    function updateTrigger() {
      const country = selectedCountry();
      trigger.replaceChildren();

      const flag = document.createElement("span");
      flag.textContent = countryFlag(country.code);
      flag.setAttribute("aria-hidden", "true");

      const dial = document.createElement("span");
      dial.className = "epv-code";
      dial.textContent = country.dial;

      const arrow = document.createElement("span");
      arrow.className = "epv-arrow";
      arrow.textContent = "▾";
      arrow.setAttribute("aria-hidden", "true");

      trigger.append(flag, dial, arrow);
      trigger.title = country.name;
      trigger.setAttribute("aria-label",
        "Phone country: " + country.name + " " + country.dial
      );
    }

    function renderOptions(query) {
      const q = query.trim().toLowerCase();
      options.replaceChildren();

      const filtered = countries.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase() === q ||
        c.dial.includes(q)
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

        const flag = document.createElement("span");
        flag.textContent = countryFlag(country.code);

        const name = document.createElement("span");
        name.className = "epv-option-name";
        name.textContent = country.name;

        const dial = document.createElement("span");
        dial.className = "epv-option-code";
        dial.textContent = country.dial;

        button.append(flag, name, dial);

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

      // Leave the original required-field validation to Ecwid.
      if (!raw) {
        phone.removeAttribute("aria-invalid");
        phone.dataset.epvValid = "false";
        delete phone.dataset.epvE164;
        return;
      }

      try {
        const parsed = phoneLib.parsePhoneNumberFromString(
          raw,
          selectedCode
        );

        if (!parsed || !parsed.isPossible()) {
          throw new Error("Please enter a valid phone number length.");
        }

        if (!parsed.isValid()) {
          throw new Error("Please check the phone number.");
        }

        if (parsed.country && parsed.country !== selectedCode) {
          throw new Error(
            "This number appears to belong to another country. " +
            "Select the correct country code."
          );
        }

        phone.dataset.epvValid = "true";
        phone.dataset.epvE164 = parsed.number;
        phone.removeAttribute("aria-invalid");

        status.textContent = "Valid format · International: " + parsed.number;
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
          error.textContent = err.message ||
            "Please enter a valid phone number.";
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

    search.addEventListener("input", () => renderOptions(search.value));

    document.addEventListener("click", event => {
      if (!countryBox.contains(event.target)) closeMenu();
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

  function start(phoneLib) {
    addStyles();

    const countries = getCountries(phoneLib);

    function scan() {
      const phone = document.querySelector("#ec-phone");
      if (phone) mount(phone, phoneLib, countries);
    }

    scan();

    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.info("[Phone Validator] Ready", {
      countries: countries.length
    });
  }

  loadLibrary()
    .then(start)
    .catch(error => {
      console.error("[Phone Validator] Failed to initialize:", error);
    });
})();
