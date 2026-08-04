/**
 * InkDrop Hash Router
 * Uses URL hash for navigation (#section, #settings?area=setup, etc.)
 * Matches the existing backend SPA routing pattern.
 */

import { appStore } from "./stores/app-store.jsx";

const ROUTE_PATTERNS = [
  { section: "calendar", pattern: /^#calendar\b/ },
  { section: "series", pattern: /^#series\b/ },
  { section: "wanted", pattern: /^#wanted\b/ },
  { section: "activity", pattern: /^#activity\b/ },
  { section: "queue", pattern: /^#queue\b/, subsection: "activity" },
  { section: "history", pattern: /^#history\b/, subsection: "activity" },
  { section: "source_memory", pattern: /^#source_memory\b/, subsection: "activity" },
  { section: "manual_review", pattern: /^#manual_review\b/ },
  { section: "settings", pattern: /^#settings\b/ },
  { section: "system", pattern: /^#system\b/ },
];

function parseHash() {
  const hash = window.location.hash || "#series";
  const params = {};

  for (const route of ROUTE_PATTERNS) {
    if (route.pattern.test(hash)) {
      const remainder = hash.replace(route.pattern, "");
      const qMark = remainder.indexOf("?");
      if (qMark >= 0) {
        const sp = new URLSearchParams(remainder.slice(qMark + 1));
        for (const [k, v] of sp.entries()) params[k] = v;
      }
      return {
        section: route.section,
        subsection: route.subsection || null,
        params,
        raw: hash,
      };
    }
  }
  return { section: "series", subsection: null, params, raw: hash };
}

function navigate(section, params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const query = sp.toString();
  window.location.hash = `#${section}${query ? "?" + query : ""}`;
}

function navigateToSection(section) {
  navigate(section);
}

function navigateToSettingsArea(area) {
  navigate("settings", { area });
}

function navigateToSubsection(section, subsection) {
  navigate(subsection || section, subsection ? {} : {});
}

function startRouter() {
  function onHashChange() {
    const route = parseHash();
    appStore.setMany({
      currentSection: route.section,
      currentSubsection: route.subsection,
      routeParams: route.params,
    });
  }

  window.addEventListener("hashchange", onHashChange);
  onHashChange();

  if (!window.location.hash || window.location.hash === "#") {
    window.location.hash = "#series";
  }
}

export const router = {
  parseHash,
  navigate,
  navigateToSection,
  navigateToSettingsArea,
  navigateToSubsection,
  startRouter,
};

export default router;
