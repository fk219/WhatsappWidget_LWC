/* Theme preference: system, light or dark. Applied pre-paint by an inline head script. */
(function () {
  var STORAGE_KEY = "wsf.theme";
  var root = document.documentElement;

  function stored() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return value === "light" || value === "dark" || value === "system" ? value : "system";
    } catch (error) {
      return "system";
    }
  }

  function systemIsDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function apply(theme) {
    var dark = theme === "dark" || (theme === "system" && systemIsDark());
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.themeChoice = theme;
    root.style.colorScheme = dark ? "dark" : "light";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      var label = button.querySelector("[data-theme-label]");
      if (label) label.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
      button.setAttribute("aria-label", "Theme: " + theme + ". Switch theme.");
      button.setAttribute("title", "Theme: " + theme);
    });
  }

  function save(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      /* private mode: keep the in-memory choice */
    }
  }

  apply(stored());

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-theme-toggle]");
    if (!button) return;
    var current = root.dataset.themeChoice || "system";
    var next = current === "light" ? "dark" : current === "dark" ? "system" : "light";
    save(next);
    apply(next);
  });

  var media = window.matchMedia("(prefers-color-scheme: dark)");
  var onChange = function () {
    if (stored() === "system") apply("system");
  };
  if (media.addEventListener) media.addEventListener("change", onChange);
  else media.addListener(onChange);
})();
