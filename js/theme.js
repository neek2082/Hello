// Light/dark theme toggle, shared by every page.
// Loaded in <head> so the saved theme is applied before the page is drawn (no flash).
// The default is light, whatever the device's own setting is.

(function () {
  var STORAGE_KEY = "theme";
  var root = document.documentElement;

  function getSavedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null; // Storage blocked (e.g. private mode): fall back to the default.
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // Not saved, but the toggle still works for this page.
    }
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    var button = document.querySelector(".theme-toggle");
    if (button) {
      var isDark = theme === "dark";
      button.textContent = isDark ? "Light theme" : "Dark theme";
      button.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    }
  }

  applyTheme(getSavedTheme() === "dark" ? "dark" : "light");

  document.addEventListener("DOMContentLoaded", function () {
    var button = document.querySelector(".theme-toggle");
    if (!button) return;
    applyTheme(root.getAttribute("data-theme"));
    button.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      saveTheme(next);
    });
  });
})();
