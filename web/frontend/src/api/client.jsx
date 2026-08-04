/**
 * InkDrop API Client
 * Central HTTP client with CSRF protection, auth, error normalization
 */

const API_BASE = "";
const CSRF_HEADER = "X-InkDrop-CSRF";
const API_KEY_HEADERS = ["X-InkDrop-API-Key", "X-Api-Key"];

let _csrfToken = null;
let _csrfPolicy = null;

function getCSRFToken() {
  return _csrfToken;
}

function getCSRFCookie() {
  const match = document.cookie.match(/(?:^|;\s*)inkdrop_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function refreshAuthContract() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/status`, { credentials: "same-origin" });
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok && data.auth) {
      _csrfPolicy = data.auth.csrf || null;
      if (data.auth.csrf_header) {
        // already using X-InkDrop-CSRF
      }
    }
  } catch {
    // ignore
  }
  _csrfToken = getCSRFCookie();
}

export class InkDropApiError extends Error {
  constructor(status, body) {
    const msg = body?.error || body?.message || `Request failed (${status})`;
    super(msg);
    this.status = status;
    this.body = body;
    this.ok = false;
  }
}

export function friendlyMessage(err) {
  if (err instanceof InkDropApiError) {
    if (err.status === 401) return "Session expired. Please log in again.";
    if (err.status === 403) return "You don't have permission for this action.";
    if (err.status === 503 && err.body?.state_busy) return "Server is busy. Retrying shortly…";
    return err.body?.error || err.message || "Something went wrong.";
  }
  if (err?.name === "TypeError" && err?.message?.includes("fetch")) return "Network error. Check your connection.";
  return err?.message || "An unexpected error occurred.";
}

async function request(method, path, body = null, opts = {}) {
  const headers = { Accept: "application/json", ...opts.headers };
  if (body !== null && body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const csrf = getCSRFToken() || getCSRFCookie();
  if (csrf && method !== "GET") {
    headers[CSRF_HEADER] = csrf;
  }
  const fetchOpts = { method, headers, credentials: "same-origin" };
  if (body !== null && body !== undefined) {
    fetchOpts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, fetchOpts);
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("inkdrop:session-expired", { detail: { status: 401 } }));
    throw new InkDropApiError(401, { error: "Session expired" });
  }
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new InkDropApiError(res.status, data || { error: res.statusText });
  }
  return data;
}

const api = {
  request,
  get: (path, opts) => request("GET", path, null, opts),
  post: (path, body, opts) => request("POST", path, body, opts),
  patch: (path, body, opts) => request("PATCH", path, body, opts),
  put: (path, body, opts) => request("PUT", path, body, opts),
  delete: (path, body, opts) => request("DELETE", path, body, opts),

  refreshAuthContract,
  getCSRFToken,
  InkDropApiError,
  friendlyMessage,
};

// ── Auth ────────────────────────────────────────────────────────────────
api.auth = {
  status: () => api.get("/api/auth/status"),
  session: () => api.get("/api/auth/session"),
  login: (username, password) => api.post("/api/auth/login", { username, password }),
  bootstrap: (username, password) => api.post("/api/auth/bootstrap", { username, password }),
  logout: () => api.post("/api/auth/logout"),
  changePassword: (current_password, new_password, revoke_other_sessions) =>
    api.post("/api/auth/password", { current_password, new_password, revoke_other_sessions }),
  listApiKeys: () => api.get("/api/auth/api-keys"),
  createApiKey: (name, role, description, scopes, expires_in_seconds) =>
    api.post("/api/auth/api-keys", { name, role, description, scopes, expires_in_seconds }),
  revokeApiKey: (id) => api.post(`/api/auth/api-keys/${id}/revoke`, { id }),
  audit: () => api.get("/api/auth/audit"),
};

// ── Setup ──────────────────────────────────────────────────────────────
api.setup = {
  status: () => api.get("/api/inkdrop-setup/status"),
};

// ── State / Dashboard ───────────────────────────────────────────────────
api.state = {
  sections: (params) => api.get(`/api/inkdrop-state/sections${queryStr(params)}`),
  view: async (view, params) => {
    const data = await api.get(`/api/inkdrop-state/${view}${queryStr(params)}`);
    // Backend wraps response in {ok, view: {...}} — flatten for convenience
    if (data && data.ok && data.view && typeof data.view === "object") {
      return { ...data.view, ok: true };
    }
    return data;
  },
  full: (params) => api.get(`/api/inkdrop-state${queryStr(params)}`),
  seriesDetail: (id) => api.get(`/api/inkdrop-state/series/detail?id=${encodeURIComponent(id)}`),
  seriesLibrary: (id, params) =>
    api.get(`/api/inkdrop-state/series/library?id=${encodeURIComponent(id)}${queryStr(params)}`),
  seriesLibraryPreview: (id, params) =>
    api.get(`/api/inkdrop-state/series/library/preview?id=${encodeURIComponent(id)}${queryStr(params)}`),
  seriesRun: (body) => api.post("/api/inkdrop-state/series/run", body),
  seriesUpdate: (body) => api.post("/api/inkdrop-state/series/update", body),
  seriesRemove: (body) => api.post("/api/inkdrop-state/series/remove", body),
  seriesLibraryMigrate: (body) => api.post("/api/inkdrop-state/series/library/migrate", body),
  seriesCoversRefresh: (body) => api.post("/api/inkdrop-state/series/covers/refresh", body),
  sourceAttemptsClear: (body) => api.post("/api/inkdrop-state/source-attempts/clear", body),
  sourceMemoryAllow: (body) => api.post("/api/inkdrop-state/source-memory/allow", body),
  readinessRepairApply: (body) => api.post("/api/inkdrop-state/readiness-repair/apply", body),
  adapterMergeApply: (body) => api.post("/api/inkdrop-state/adapter-merge/apply", body),
  kapowarrAdapterDrainApply: (body) => api.post("/api/inkdrop-state/kapowarr-adapter-drain/apply", body),
  shadowRefMergePreview: (body) => api.post("/api/inkdrop-state/series-shadow-ref-merge/preview", body),
  shadowRefMergeApply: (body) => api.post("/api/inkdrop-state/series-shadow-ref-merge/apply", body),
  shadowRetireApply: (body) => api.post("/api/inkdrop-state/series-shadow-retire/apply", body),
  queueRun: (body) => api.post("/api/inkdrop-state/queue/run", body),
  wantedRun: (body) => api.post("/api/inkdrop-state/wanted/run", body),
  issueMonitorSet: (body) => api.post("/api/issue-monitor/set", body),
  sync: (mode) => api.post("/api/inkdrop-state/sync", { mode }),
  libraryFrontendsSync: () => api.post("/api/inkdrop-state/library-frontends/sync"),
  historyRaw: (id) => api.get(`/api/inkdrop-state/history/raw?id=${encodeURIComponent(id)}`),
  calendar: (params) => api.get(`/api/inkdrop-state/calendar${queryStr(params)}`),
  sourceAttempts: (params) => api.get(`/api/inkdrop-state/source-attempts${queryStr(params)}`),
};

// ── Manual Review ──────────────────────────────────────────────────────
api.manualReview = {
  list: () => api.get("/api/manual-review"),
  approve: (body) => api.post("/api/manual-review/approve", body),
  resolveNoop: () => api.post("/api/manual-review/resolve-noop", {}),
  ignore: (body) => api.post("/api/manual-review/ignore", body),
  badMatch: (body) => api.post("/api/manual-review/bad-match", body),
  addAlias: (body) => api.post("/api/manual-review/add-alias", body),
  approvePack: (body) => api.post("/api/manual-review/approve-pack", body),
};

// ── Manual Search ───────────────────────────────────────────────────────
api.manualSearch = {
  createRun: (body) => api.post("/api/manual-search/runs", body),
  getRun: (runId) => api.get(`/api/manual-search/runs/${runId}`),
  getResults: (runId, params) => api.get(`/api/manual-search/runs/${runId}/results${queryStr(params)}`),
  getDiagnostics: (runId) => api.get(`/api/manual-search/runs/${runId}/diagnostics`),
  cancelRun: (runId) => api.post(`/api/manual-search/runs/${runId}/cancel`),
  grabCandidate: (candidateId, body) => api.post(`/api/manual-search/candidates/${candidateId}/grab`, body),
};

// ── Pack Review ────────────────────────────────────────────────────────
api.packReview = {
  state: () => api.get("/api/pack-review/state"),
  refresh: () => api.post("/api/pack-review/refresh"),
  inspect: (body) => api.post("/api/pack-review/inspect", body),
  importPack: (body) => api.post("/api/pack-review/import", body),
  autoImport: () => api.post("/api/pack-review/auto-import"),
  clear: (body) => api.post("/api/pack-review/clear", body),
};

// ── Watches / ComicVine / MangaDex ─────────────────────────────────────
api.watches = {
  list: () => api.get("/api/watches"),
  comicvineList: () => api.get("/api/comicvine/watches"),
  add: (body) => api.post("/api/watch/add", body),
  addResult: (body) => api.post("/api/watch/add-result", body),
  update: (body) => api.post("/api/watch/update", body),
  delete: (id) => api.post("/api/watch/delete", { id }),
  scan: (body) => api.post("/api/watch/scan", body),
  grab: (body) => api.post("/api/watch/grab", body),
  comicvineSearch: (query, limit) => api.post("/api/comicvine/search", { query, limit }),
  comicvineAdd: (body) => api.post("/api/comicvine/add", body),
  comicvineUpdate: (body) => api.post("/api/comicvine/update", body),
  comicvineReplaceMetadata: (body) => api.post("/api/comicvine/replace-metadata", body),
  comicvineDelete: (id) => api.post("/api/comicvine/delete", { id }),
  comicvineScan: (body) => api.post("/api/comicvine/scan", body),
  comicvineGrab: (body) => api.post("/api/comicvine/grab", body),
  mangadexSearch: (query, limit) => api.post("/api/mangadex/search", { query, limit }),
  mangadexFeed: (mangadexId, limit) => api.post("/api/mangadex/feed", { mangadexId, limit }),
  mangadexAdd: (body) => api.post("/api/mangadex/add", body),
};

// ── Search & Grab ───────────────────────────────────────────────────────
api.search = {
  search: (query, type, limit) => api.post("/api/search", { query, type, limit }),
  sourceProbe: (body) => api.post("/api/source-probe", body),
  grab: (body) => api.post("/api/grab", body),
};

// ── Missing / Discovery ────────────────────────────────────────────────
api.missing = {
  process: (body) => api.post("/api/missing/process", body),
  recheck: (body) => api.post("/api/missing/recheck", body),
  fresh: () => api.post("/api/missing/fresh", {}),
  hot: () => api.post("/api/missing/hot", {}),
  rssDiscover: (body) => api.post("/api/rss/discover", body),
  comicscodesDiscover: (body) => api.post("/api/comicscodes/discover", body),
};

// ── Import ─────────────────────────────────────────────────────────────
api.imports = {
  run: (body) => api.post("/api/import", body),
  reconcile: () => api.get("/api/import-reconcile"),
  libraryAdoptionPlan: (body) => api.post("/api/library-adoption/plan", body),
  libraryAdoptionApply: (body) => api.post("/api/library-adoption/apply", body),
  convertArchivesPlan: (body) => api.post("/api/inkdrop-library/convert-archives/plan", body),
  convertArchivesApply: (body) => api.post("/api/inkdrop-library/convert-archives/apply", body),
  convertArchivesStatus: (taskId) => api.post("/api/inkdrop-library/convert-archives/status", { taskId }),
};

// ── Activity ────────────────────────────────────────────────────────────
api.activity = {
  current: (params) => api.get(`/api/inkdrop-activity/current${queryStr(params)}`),
  summary: () => api.get("/api/inkdrop-activity/summary"),
  detail: (id) => api.get(`/api/inkdrop-activity/${encodeURIComponent(id)}`),
  deferredQueueSync: () => api.get("/api/inkdrop-maintenance/deferred-queue-sync"),
};

// ── Settings ────────────────────────────────────────────────────────────
api.settings = {
  get: (area) => api.get(`/api/inkdrop-settings${area ? `?area=${encodeURIComponent(area)}` : ""}`),
  sync: (area) => api.post("/api/inkdrop-settings/sync", area ? { area } : {}),
  providerAdd: (body) => api.post("/api/inkdrop-settings/provider/add", body),
  providerClaim: (body) => api.post("/api/inkdrop-settings/provider/claim", body),
  providerUpdate: (body) => api.post("/api/inkdrop-settings/provider/update", body),
  providerDelete: (body) => api.post("/api/inkdrop-settings/provider/delete", body),
  providerTest: (body) => api.post("/api/inkdrop-settings/provider/test", body),
  providerRecommendationApply: (body) => api.post("/api/inkdrop-settings/provider/recommendation/apply", body),
  appUpdate: (body) => api.post("/api/inkdrop-settings/app/update", body),
  backupExport: () => api.post("/api/inkdrop-settings/backup/export"),
  backupPreview: (document_text) => api.post("/api/inkdrop-settings/backup/preview", { document_text }),
  backupRestore: (document_text) => api.post("/api/inkdrop-settings/backup/restore", { document_text }),
  portabilityExport: () => api.post("/api/inkdrop-settings/portability/export"),
};

// ── Download Clients ────────────────────────────────────────────────────
api.downloadClients = {
  list: () => api.get("/api/download-clients"),
  registry: () => api.get("/api/download-clients/registry"),
  status: (refresh) => api.get(`/api/download-clients/status${refresh ? "?refresh=1" : ""}`),
  instanceStatus: (id, refresh) => api.get(`/api/download-clients/${id}/status${refresh ? "?refresh=1" : ""}`),
  get: (id) => api.get(`/api/download-clients/${id}`),
  create: (body) => api.post("/api/download-clients", body),
  test: (body) => api.post("/api/download-clients/test", body),
  testAll: () => api.post("/api/download-clients/test-all"),
  testInstance: (id) => api.post(`/api/download-clients/${id}/test`),
  getTestRun: (runId) => api.get(`/api/download-clients/test-runs/${runId}`),
  update: (id, body) => api.patch(`/api/download-clients/${id}`, body),
  delete: (id, revision) => api.delete(`/api/download-clients/${id}`, revision ? { revision } : {}),
};

// ── Series Autopilot / Missing Recovery ──────────────────────────────────
api.autopilot = {
  status: () => api.get("/api/series-autopilot"),
  run: (body) => api.post("/api/series-autopilot/run", body),
  normalize: () => api.post("/api/series-autopilot/normalize"),
};

api.missingRecovery = {
  status: () => api.get("/api/missing-recovery"),
  run: (body) => api.post("/api/series-autopilot/run", body),
};

// ── System ──────────────────────────────────────────────────────────────
api.system = {
  version: () => api.get("/api/system/version"),
  updateStatus: (refresh) => api.get(`/api/system/update-status${refresh ? "?refresh=1" : ""}`),
  health: () => api.get("/api/system/health"),
  logs: () => api.get("/api/system/logs/download"),
  status: () => api.get("/status.json"),
  suwayomi: () => api.get("/api/system/suwayomi"),
};

// ── SAB / Unmatched / Transfer ──────────────────────────────────────────
api.sab = {
  failures: () => api.get("/api/sab-comic-failures"),
  learn: (body) => api.post("/api/sab-comic-failures/learn", body),
};

api.unmatched = {
  list: () => api.get("/api/unmatched-downloads"),
  importItem: (body) => api.post("/api/unmatched-downloads/import", body),
  quarantine: (body) => api.post("/api/unmatched-downloads/quarantine", body),
};

api.transfer = {
  status: (id) => api.get(`/api/inkdrop-transfer-status?id=${encodeURIComponent(id)}`),
};

api.operator = {
  contracts: () => api.get("/api/inkdrop-operator/contracts"),
};

// ── Notifications ───────────────────────────────────────────────────────
api.notifications = {
  config: () => api.get("/api/notifications/config"),
  deliveries: (params) => api.get(`/api/notifications/deliveries${queryStr(params)}`),
  saveChannel: (body) => api.post("/api/notifications/channel/save", body),
  saveSettings: (body) => api.post("/api/notifications/settings/save", body),
};

// ── Diagnostics ──────────────────────────────────────────────────────────
api.diagnostics = {
  acquisitionFunnel: (hours) => api.get(`/api/inkdrop-diagnostics/acquisition-funnel${hours ? `?hours=${hours}` : ""}`),
  staleCompletion: (limit) => api.get(`/api/inkdrop-diagnostics/stale-completion${limit ? `?limit=${limit}` : ""}`),
  packDuplicates: (limit) => api.get(`/api/inkdrop-diagnostics/pack-duplicates${limit ? `?limit=${limit}` : ""}`),
  managedLibraryAudit: () => api.get("/api/inkdrop-diagnostics/managed-library-audit"),
  managedLibraryAuditRun: (body) => api.post("/api/inkdrop-diagnostics/managed-library-audit/run", body),
  libraryImportPlan: () => api.get("/api/inkdrop-diagnostics/library-import-plan"),
  readerFrontendOrphanCleanup: () => api.get("/api/inkdrop-diagnostics/reader-frontend-orphan-cleanup"),
  readerFrontendOrphanCleanupApply: (body) =>
    api.post("/api/inkdrop-diagnostics/reader-frontend-orphan-cleanup/apply", body),
  mangaChapterArtifacts: () => api.get("/api/inkdrop-diagnostics/manga-chapter-artifacts"),
  mangaChapterArtifactsApply: (body) => api.post("/api/inkdrop-diagnostics/manga-chapter-artifacts/apply", body),
  mixedMangaUnits: () => api.get("/api/inkdrop-diagnostics/mixed-manga-units"),
  mixedMangaUnitsApply: (body) => api.post("/api/inkdrop-diagnostics/mixed-manga-units/apply", body),
  managedLibraryDuplicatesQuarantine: (body) =>
    api.post("/api/inkdrop-diagnostics/managed-library-duplicates/quarantine", body),
};

// ── Manga Unit ──────────────────────────────────────────────────────────
api.mangaUnit = {
  set: (body) => api.post("/api/manga-unit/set", body),
};

// ── SLSKD ───────────────────────────────────────────────────────────────
api.slskd = {
  probe: () => api.get("/api/slskd-source-probe"),
  probeRun: (body) => api.post("/api/slskd-source-probe/run", body),
};

// ── Manual Source ────────────────────────────────────────────────────────
api.manualSource = {
  importDetected: (body) => api.post("/api/manual-source/import-detected", body),
  markWaiting: (body) => api.post("/api/manual-source/mark-waiting", body),
  clearWaiting: (body) => api.post("/api/manual-source/clear-waiting", body),
};

// ── Cover proxy ─────────────────────────────────────────────────────────
api.cover = {
  url: (originalUrl) => `/api/inkdrop-cover?url=${encodeURIComponent(originalUrl)}`,
};

// ── Helpers ─────────────────────────────────────────────────────────────
function queryStr(params) {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      sp.set(k, String(v));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default api;
