
(function () {
  "use strict";

  if (window.__ecwidPhoneValidatorV7) return;
  window.__ecwidPhoneValidatorV7 = true;

  const LIB_URL =
    "https://unpkg.com/libphonenumber-js@1.11.20/bundle/libphonenumber-js.min.js";

  const COUNTRY_FIELD =
    'input[name="country"][autocomplete="shipping country"]';

  const CONFIG_URL =
    "https://dmitrykram.github.io/ec-app/config.json";

  const DEFAULT_CONFIG = {
    enabled: true,
    allowedCountries: null,
    defaultCountry: null
  };

  async function loadConfig() {
    try {
      const response = await fetch(CONFIG_URL + "?v=" + Date.now(), {
        cache: "no-store"
      });

      if (!response.ok) throw new Error("HTTP " + response.status);

      const incoming = await response.json();

      return {
        enabled: typeof incoming.enabled === "boolean"
          ? incoming.enabled
          : DEFAULT_CONFIG.enabled,

        allowedCountries: Array.isArray(incoming.allowedCountries)
          ? incoming.allowedCountries.map(code =>
              String(code).toUpperCase()
            )
          : DEFAULT_CONFIG.allowedCountries,

        defaultCountry: typeof incoming.defaultCountry === "string"
          ? incoming.defaultCountry.toUpperCase()
          : DEFAULT_CONFIG.defaultCountry
      };
    } catch (error) {
      console.warn(
        "[Phone Validator] Could not load config; using defaults.",
        error
      );
      return { ...DEFAULT_CONFIG };
    }
  }

  function loadLibrary() {
    if (
      window.libphonenumber &&
      typeof window.libphonenumber.getCountries === "function"
    ) {
      return Promise.resolve(window.libphonenumber);
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
        } else {
          reject(new Error("Phone library API unavailable"));
        }
      };

      script.onerror = function () {
        reject(new Error("Failed to load phone validation library"));
      };

      document.head.appendChild(script);
    });

    return window.__epvLibraryPromise;
  }

  function getCountries(lib) {
    const names = new Intl.DisplayNames(["en"], { type: "region" });

    return lib.getCountries()
      .map(code => ({
        code,
        name: names.of(code) || code,
        dial: "+" + lib.getCountryCallingCode(code)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function getCountryFromCheckout(lib, countries) {
    const input = document.querySelector(COUNTRY_FIELD);

    if (!input || !input.value.trim()) return null;

    const value = input.value.trim();
    const upper = value.toUpperCase();

    if (lib.getCountries().includes(upper)) return upper;

    const match = countries.find(country =>
      country.name.toLowerCase() === value.toLowerCase()
    );

    return match ? match.code : null;
  }

  function flag(code) {
    return code.toUpperCase().replace(/[A-Z]/g, letter =>
      String.fromCodePoint(127397 + letter.charCodeAt(0))
    );
  }

  function movePhoneCell(phone) {
    const phoneCell = phone.closest(".ec-form__cell--phone");
    const originalRow = phoneCell?.closest(".ec-form__row");

    if (!phoneCell || !originalRow) return;

    let phoneRow = document.querySelector(".ec-form__row.epv-phone-row");

    if (!phoneRow) {
      phoneRow = document.createElement("div");
      phoneRow.className = "ec-form__row epv-phone-row";
      originalRow.insertAdjacentElement("afterend", phoneRow);
    }

    phoneRow.appendChild(phoneCell);
  }

  function mount(phone, lib, countries, config) {
    if (!phone || !phone.isConnected) return;
    if (phone.dataset.epvMounted === "true") return;
    if (phone.disabled || phone.readOnly) return;

    movePhoneCell(phone);
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

    phone.parentNode.insertBefore(root, phone);
    root.append(countryBox, phone);
    phone.insertAdjacentElement("afterend", error);
    error.insertAdjacentElement("afterend", status);

    phone.style.minWidth = "0";
    phone.style.width = "100%";
    phone.style.flex = "none";
    phone.style.boxSizing = "border-box";

    let selectedCode =
      getCountryFromCheckout(lib, countries) ||
      config.defaultCountry ||
      "US";

    if (!countries.some(country => country.code === selectedCode)) {
      selectedCode = countries[0]?.code || "US";
    }

    let touched = false;

    function selectedCountry() {
      return countries.find(country => country.code === selectedCode);
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
        const parsed = lib.parsePhoneNumberFromString(raw, selectedCode);

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

  function start(lib, config) {
    const allCountries = getCountries(lib);

    const countries = Array.isArray(config.allowedCountries)
      ? allCountries.filter(country =>
          config.allowedCountries.includes(country.code)
        )
      : allCountries;

    if (!config.enabled) {
      console.info("[Phone Validator] Disabled by config.");
      return;
    }

    if (!countries.length) {
      console.error("[Phone Validator] No allowed countries in config.");
      return;
    }

    if (!countries.some(country => country.code === config.defaultCountry)) {
      config.defaultCountry = countries.some(country => country.code === "US")
        ? "US"
        : countries[0].code;
    }

    function scan() {
      const phone = document.querySelector("#ec-phone");
      if (phone) mount(phone, lib, countries, config);
    }

    scan();

    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.info("[Phone Validator] Ready", {
      countries: countries.length,
      defaultCountry: config.defaultCountry || "checkout country / fallback",
      enabled: config.enabled
    });
  }

  Promise.all([loadLibrary(), loadConfig()])
    .then(([lib, config]) => start(lib, config))
    .catch(error => {
      console.error("[Phone Validator] Initialization failed:", error);
    });
})();
