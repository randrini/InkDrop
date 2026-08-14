// InkDrop mobile status view (/m). Standalone script -- not part of the
// desktop shell's JS bundle. Phase 1 is strictly read-only: a stats glance
// and a list of items needing operator attention (Manual Review), both
// fetched from the same JSON APIs the desktop app already uses. No add,
// search, or retry actions live here yet.
(() => {
  "use strict";

  const REFRESH_INTERVAL_MS = 45000;
  const MANUAL_REVIEW_LIMIT = 30;

  const els = {};
  let currentScreen = "home";
  let refreshTimer = null;
  let loadToken = 0;

  function byId(id) {
    return document.getElementById(id);
  }

  function cacheEls() {
    els.bootError = byId("mobileBootError");
    els.login = byId("mobileLogin");
    els.loginForm = byId("mobileLoginForm");
    els.loginError = byId("mobileLoginError");
    els.username = byId("mobileUsername");
    els.password = byId("mobilePassword");
    els.nav = byId("mobileNav");
    els.refreshBtn = byId("mobileRefreshBtn");
    els.desktopLink = byId("mobileDesktopLink");
    els.home = byId("mobileHome");
    els.homeContent = byId("mobileHomeContent");
    els.stuck = byId("mobileStuck");
    els.stuckContent = byId("mobileStuckContent");
    els.stuckBadge = byId("mobileStuckBadge");
  }

  function cookieValue(name) {
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + name + "=([^;]*)"),
    );
    return match ? decodeURIComponent(match[1]) : "";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  }

  function humanizeToken(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function fmtMinutes(minutes) {
    const n = Number(minutes);
    if (!isFinite(n) || n < 0) return null;
    if (n < 1) return "just now";
    if (n < 60) return `${Math.round(n)}m ago`;
    const hours = n / 60;
    if (hours < 48) return `${Math.round(hours)}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }

  async function fetchJson(path) {
    const res = await fetch(path, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 401) {
      const err = new Error("unauthenticated");
      err.unauthenticated = true;
      throw err;
    }
    let data = null;
    try {
      data = await res.json();
    } catch (parseErr) {
      throw new Error(`bad response from ${path}`);
    }
    if (!res.ok && !data) throw new Error(`request failed: ${path}`);
    return data;
  }

  function setSpinning(spinning) {
    if (!els.refreshBtn) return;
    els.refreshBtn.classList.toggle("m-spinning", !!spinning);
  }

  // --- Auth -----------------------------------------------------------

  async function boot() {
    try {
      const data = await fetchJson("/api/auth/status");
      const auth = (data && data.auth) || {};
      // setup_required wins over everything else, including
      // required === false: that combination means no enforcement is
      // possible yet (no administrator exists, or external auth isn't
      // ready), not "operational APIs are open to anyone who can reach
      // this page." This page has no bootstrap form, so send them to "/"
      // where the desktop shell owns first-run setup. The inline script in
      // MOBILE_HTML already does this before this script even loads --
      // this is the fallback for a request whose server-rendered flag was
      // already stale by the time it reached the browser.
      if (auth.setup_required) {
        location.replace("/" + location.search);
        return;
      }
      if (auth.required === false || auth.session_authenticated) {
        showApp();
      } else {
        showLogin();
      }
    } catch (err) {
      showLogin();
    }
  }

  function showLogin() {
    stopAutoRefresh();
    els.login.hidden = false;
    els.home.hidden = true;
    els.stuck.hidden = true;
    els.nav.hidden = true;
    els.refreshBtn.hidden = true;
    els.username.focus();
  }

  function showApp() {
    els.login.hidden = true;
    els.nav.hidden = false;
    els.refreshBtn.hidden = false;
    switchScreen(currentScreen, { force: true });
    startAutoRefresh();
  }

  async function handleLogin(event) {
    event.preventDefault();
    els.loginError.hidden = true;
    const submitBtn = els.loginForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username: els.username.value.trim(),
          password: els.password.value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && data.ok !== false) {
        els.password.value = "";
        showApp();
        return;
      }
      els.loginError.textContent =
        humanizeToken(data && data.error) ||
        "Sign-in failed. Check your username and password.";
      els.loginError.hidden = false;
    } catch (err) {
      els.loginError.textContent =
        "Couldn't reach InkDrop. Check your connection and try again.";
      els.loginError.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  }

  // --- Navigation -------------------------------------------------------

  function switchScreen(name, opts) {
    const force = !!(opts && opts.force);
    if (name === currentScreen && !force) return;
    currentScreen = name;
    els.home.hidden = name !== "home";
    els.stuck.hidden = name !== "stuck";
    els.nav.querySelectorAll(".m-nav-btn").forEach((btn) => {
      btn.classList.toggle("m-nav-active", btn.dataset.screen === name);
    });
    loadCurrentScreen();
  }

  function loadCurrentScreen() {
    if (currentScreen === "home") loadHome();
    else loadStuck();
    // Keep the attention badge live regardless of which screen is showing.
    if (currentScreen !== "stuck") refreshStuckBadge();
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(() => {
      if (document.hidden) return;
      loadCurrentScreen();
    }, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  function stopAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  function onVisibilityChange() {
    if (!document.hidden) loadCurrentScreen();
  }

  // --- Home screen --------------------------------------------------------

  function statusDotClass(status) {
    const s = String(status || "").toLowerCase();
    if (s.includes("problem") || s.includes("fail") || s.includes("error"))
      return "m-status-problem";
    if (s.includes("warn") || s.includes("attention") || s.includes("degraded"))
      return "m-status-warn";
    if (
      s.includes("ok") ||
      s.includes("healthy") ||
      s.includes("good") ||
      s.includes("idle") ||
      s.includes("running")
    )
      return "m-status-ok";
    return "";
  }

  function tile(value, label, attention) {
    return `<div class="m-tile">
      <div class="m-tile-value${attention ? " m-tile-attn" : ""}">${escapeHtml(value)}</div>
      <div class="m-tile-label">${escapeHtml(label)}</div>
    </div>`;
  }

  async function loadHome() {
    const token = ++loadToken;
    setSpinning(true);
    if (!els.homeContent.dataset.loaded) {
      els.homeContent.innerHTML =
        '<div class="m-loading">Loading status&hellip;</div>';
    }
    try {
      const [status, activity] = await Promise.all([
        fetchJson("/status.json"),
        fetchJson("/api/inkdrop-activity/summary").catch(() => null),
      ]);
      if (token !== loadToken) return;
      renderHome(status, activity);
      els.homeContent.dataset.loaded = "1";
    } catch (err) {
      if (token !== loadToken) return;
      if (err.unauthenticated) {
        showLogin();
        return;
      }
      if (!els.homeContent.dataset.loaded) {
        els.homeContent.innerHTML =
          '<p class="m-error">Couldn\'t load status. Pull down or tap refresh to try again.</p>';
      }
    } finally {
      if (token === loadToken) setSpinning(false);
    }
  }

  function renderHome(status, activity) {
    status = status || {};
    const dotClass = statusDotClass(status.status);
    const detail = status.detail
      ? `<span class="m-status-detail">${escapeHtml(status.detail)}</span>`
      : "";
    const lastImport = fmtMinutes(status.last_import_minutes);

    const tiles = [
      tile(status.inkdrop_state_series_count ?? "-", "Series"),
      tile(status.inkdrop_state_wanted_count ?? "-", "Wanted"),
      tile(
        activity && activity.active_total != null
          ? activity.active_total
          : (status.inkdrop_state_queue_count ?? "-"),
        "Active downloads",
      ),
      tile(
        status.manual_review_actionable_count ??
          status.manual_review_count ??
          "-",
        "Needs attention",
        (status.manual_review_actionable_count || 0) > 0,
      ),
      tile(
        (status.failed_download_count || 0) + (status.failed_import_count || 0),
        "Failed",
        (status.failed_download_count || 0) +
          (status.failed_import_count || 0) >
          0,
      ),
      tile(
        activity && activity.ready_to_import != null
          ? activity.ready_to_import
          : "-",
        "Ready to import",
      ),
    ].join("");

    const clientsHtml = renderClientRow(activity);
    const metaHtml = lastImport
      ? `<div class="m-meta-row"><span>Last import ${escapeHtml(lastImport)}</span></div>`
      : "";

    els.homeContent.innerHTML = `
      <div class="m-status-banner">
        <span class="m-status-dot ${dotClass}"></span>
        <span class="m-status-text">${escapeHtml(status.status ? humanizeToken(status.status) : "Status unavailable")}${detail}</span>
      </div>
      <div class="m-tile-grid">${tiles}</div>
      ${clientsHtml}
      ${metaHtml}
    `;
  }

  function renderClientRow(activity) {
    const clients = activity && activity.clients;
    if (!clients || typeof clients !== "object") return "";
    const rows = Object.keys(clients)
      .map((key) => {
        const c = clients[key] || {};
        const active = Number(c.active || 0);
        const queued = Number(c.queued || 0);
        if (!active && !queued) return "";
        return `<div class="m-item-card">
          <div class="m-item-row">
            <span class="m-item-title">${escapeHtml(humanizeToken(key))}</span>
            <span class="m-pill">${active} active</span>
            ${queued ? `<span class="m-pill">${queued} queued</span>` : ""}
          </div>
        </div>`;
      })
      .filter(Boolean)
      .join("");
    if (!rows) return "";
    return `<div class="m-section-title">Download clients</div><div class="m-item-list">${rows}</div>`;
  }

  // --- Stuck items (Manual Review) screen ---------------------------------

  function reviewRowTitle(row) {
    const issue = row.issue_number ? ` #${row.issue_number}` : "";
    return `${row.series || "Unknown series"}${issue}`;
  }

  function reviewRowState(row) {
    return (
      row.display_state_label ||
      row.display_state ||
      row.state ||
      row.status ||
      ""
    );
  }

  function reviewRowReason(row) {
    return (
      row.review_reason ||
      row.reason ||
      row.why_not_grabbed ||
      row.activity_summary ||
      ""
    );
  }

  async function loadStuck() {
    const token = ++loadToken;
    setSpinning(true);
    if (!els.stuckContent.dataset.loaded) {
      els.stuckContent.innerHTML =
        '<div class="m-loading">Loading&hellip;</div>';
    }
    try {
      const payload = await fetchJson(
        `/api/inkdrop-state/manual_review?summary=compact&rows=compact&limit=${MANUAL_REVIEW_LIMIT}`,
      );
      const data = (payload && payload.view) || {};
      if (token !== loadToken) return;
      renderStuck(data);
      updateBadge(data);
      els.stuckContent.dataset.loaded = "1";
    } catch (err) {
      if (token !== loadToken) return;
      if (err.unauthenticated) {
        showLogin();
        return;
      }
      if (!els.stuckContent.dataset.loaded) {
        els.stuckContent.innerHTML =
          '<p class="m-error">Couldn\'t load Manual Review. Pull down or tap refresh to try again.</p>';
      }
    } finally {
      if (token === loadToken) setSpinning(false);
    }
  }

  async function refreshStuckBadge() {
    try {
      const payload = await fetchJson(
        `/api/inkdrop-state/manual_review?summary=compact&rows=compact&limit=1`,
      );
      updateBadge((payload && payload.view) || {});
    } catch (err) {
      // Badge is best-effort; a failed background check shouldn't surface an error.
    }
  }

  function updateBadge(data) {
    const count = Number((data && (data.total_count ?? data.count)) || 0);
    if (count > 0) {
      els.stuckBadge.hidden = false;
      els.stuckBadge.textContent = count > 99 ? "99+" : String(count);
    } else {
      els.stuckBadge.hidden = true;
    }
  }

  function renderStuck(data) {
    const rows = data && Array.isArray(data.rows) ? data.rows : [];
    if (!rows.length) {
      els.stuckContent.innerHTML =
        '<div class="m-empty">Nothing needs your attention right now.</div>';
      return;
    }
    const cards = rows
      .map((row) => {
        const reason = reviewRowReason(row);
        const state = reviewRowState(row);
        return `<div class="m-item-card">
          <div class="m-item-title">${escapeHtml(reviewRowTitle(row))}</div>
          ${reason ? `<div class="m-item-reason">${escapeHtml(humanizeToken(reason))}</div>` : ""}
          <div class="m-item-row">
            ${state ? `<span class="m-pill">${escapeHtml(humanizeToken(state))}</span>` : ""}
            ${row.current_source || row.source ? `<span class="m-item-source">${escapeHtml(row.current_source || row.source)}</span>` : ""}
          </div>
        </div>`;
      })
      .join("");
    const total = Number(
      (data && (data.total_count ?? rows.length)) || rows.length,
    );
    const more =
      total > rows.length
        ? `<div class="m-more-note">Showing ${rows.length} of ${total} &mdash; open InkDrop on desktop for the full list.</div>`
        : "";
    els.stuckContent.innerHTML = `<div class="m-item-list">${cards}</div>${more}`;
  }

  // --- Wire up --------------------------------------------------------

  function goToDesktop() {
    try {
      sessionStorage.setItem("inkdropViewPreference", "desktop");
    } catch (e) {}
    // Deliberately not forwarding location.search: a lingering ?view=mobile
    // (from an earlier forced-mobile visit) would otherwise re-assert
    // itself the instant the desktop gate script reads the query string,
    // clobbering the preference this click just set.
    location.href = "/";
  }

  function init() {
    cacheEls();
    els.loginForm.addEventListener("submit", handleLogin);
    els.refreshBtn.addEventListener("click", () => loadCurrentScreen());
    els.desktopLink.addEventListener("click", goToDesktop);
    els.nav.querySelectorAll(".m-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchScreen(btn.dataset.screen));
    });
    boot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
