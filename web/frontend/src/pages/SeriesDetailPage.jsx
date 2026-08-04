/**
 * InkDrop — Series Detail Page
 * Full detail view for a single series with cover, info, actions,
 * edit form, issues panel, and library info.
 */

import { h, Component } from "preact";
import api from "../api/client.jsx";
import { toast } from "../main.jsx";
import { appStore } from "../stores/app-store.jsx";
import { router } from "../router.jsx";

/* ── Helpers ────────────────────────────────────────────────────────── */
function stripHtml(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

function truncate(str, maxLen) {
  if (!str) return "";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen).trimEnd() + "…";
}

function ownershipLabel(ownership) {
  if (!ownership || ownership === "none") return "None";
  if (ownership === "all") return "Owned";
  if (ownership === "partial") return "Partial";
  return ownership;
}

function ownershipClass(ownership) {
  if (!ownership || ownership === "none") return "series-ownership-none";
  if (ownership === "all") return "series-ownership-owned";
  return "series-ownership-partial";
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function statusPillClass(status) {
  if (!status) return "ink-pill-muted";
  const s = String(status).toLowerCase();
  if (s === "downloaded" || s === "completed" || s === "owned" || s === "complete" || s === "verified")
    return "ink-pill-success";
  if (s === "wanted" || s === "missing") return "ink-pill-warning";
  if (s === "queued" || s === "searching" || s === "active") return "ink-pill-info";
  if (s === "error" || s === "failed") return "ink-pill-danger";
  return "ink-pill-muted";
}

function issueStatusPillClass(issue) {
  const label = issue.completion_gate?.label || issue.wanted_status || issue.queue_state || "";
  const s = String(label).toLowerCase();
  if (s === "complete" || s === "verified" || s === "downloaded" || s === "owned") return "ink-pill-success";
  if (s === "wanted" || s === "active" || s === "queued") return "ink-pill-warning";
  if (s === "failed" || s === "needs attention" || s === "needs_attention") return "ink-pill-danger";
  return "ink-pill-muted";
}

function issueStatusLabel(issue) {
  return issue.completion_gate?.label || issue.wanted_status || issue.queue_state || "Unknown";
}

function issueNumber(issue) {
  return issue.issue_number || issue.normalized_number || `#${issue.id?.slice(0, 6) || "?"}`;
}

function issueTitle(issue) {
  const raw = issue.title || issue.issue_title || issue.name || "";
  const num = issueNumber(issue);
  // If title is just a number or "Issue #N", show "Issue #N"
  if (!raw || /^\d+$/.test(raw) || raw === `Issue ${num}` || raw === `Issue #${num}`) {
    return `Issue ${num}`;
  }
  return raw;
}

/* ── Scoped Styles ──────────────────────────────────────────────────── */
const styles = `
.series-detail-page {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--ink-space-lg) var(--ink-space-md);
  animation: ink-fade-in 250ms ease-out;
}

/* ── Back Button ──────────────────────────────────────────────────── */
.series-detail-back {
  display: inline-flex;
  align-items: center;
  gap: var(--ink-space-xs);
  padding: var(--ink-space-xs) 0;
  font-size: var(--ink-text-sm);
  color: var(--ink-text-secondary);
  cursor: pointer;
  border: none;
  background: none;
  transition: color var(--ink-transition-fast);
  margin-bottom: var(--ink-space-lg);
}

.series-detail-back:hover {
  color: var(--ink-accent-gold);
}

/* ── Hero Section ──────────────────────────────────────────────────── */
.series-detail-hero {
  display: flex;
  gap: var(--ink-space-xl);
  margin-bottom: var(--ink-space-xl);
}

.series-detail-cover-wrap {
  flex-shrink: 0;
  width: 240px;
  border-radius: var(--ink-radius-lg);
  overflow: hidden;
  background: var(--ink-bg-elevated);
  aspect-ratio: 2 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.series-detail-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.series-detail-cover-placeholder {
  color: var(--ink-text-muted);
  font-size: var(--ink-text-sm);
  text-align: center;
  padding: var(--ink-space-md);
}

.series-detail-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-sm);
}

.series-detail-name {
  font-family: var(--ink-font-display);
  font-size: var(--ink-text-2xl);
  font-weight: 600;
  line-height: 1.2;
  margin: 0;
}

.series-detail-description {
  font-size: var(--ink-text-sm);
  color: var(--ink-text-secondary);
  line-height: 1.6;
  margin: var(--ink-space-sm) 0;
}

.series-detail-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ink-space-xs);
  align-items: center;
}

.series-detail-stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ink-space-sm);
  margin-top: var(--ink-space-sm);
}

/* ── Action Buttons ────────────────────────────────────────────────── */
.series-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ink-space-sm);
  margin-bottom: var(--ink-space-xl);
  padding: var(--ink-space-md) 0;
  border-top: 1px solid var(--ink-border-subtle);
  border-bottom: 1px solid var(--ink-border-subtle);
}

/* ── Edit Form ──────────────────────────────────────────────────────── */
.series-detail-edit-form {
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
  padding: var(--ink-space-lg);
  margin-bottom: var(--ink-space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-md);
}

.series-detail-edit-row {
  display: flex;
  align-items: center;
  gap: var(--ink-space-md);
}

.series-detail-edit-label {
  font-size: var(--ink-text-sm);
  font-weight: 500;
  min-width: 100px;
  color: var(--ink-text-secondary);
}

/* ── Section Headers ───────────────────────────────────────────────── */
.series-detail-section-title {
  font-size: var(--ink-text-lg);
  font-weight: 600;
  margin: 0 0 var(--ink-space-md) 0;
  padding-bottom: var(--ink-space-sm);
  border-bottom: 1px solid var(--ink-border-subtle);
}

/* ── Issues Panel ──────────────────────────────────────────────────── */
.series-detail-issues {
  margin-bottom: var(--ink-space-xl);
}

.series-detail-issues-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--ink-space-md);
}

.series-detail-issues-header-left {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
}

.series-detail-issues-count {
  font-size: var(--ink-text-xs);
  font-weight: 600;
  color: var(--ink-text-muted);
  background: var(--ink-bg-elevated);
  padding: 2px var(--ink-space-sm);
  border-radius: var(--ink-radius-full);
}

.series-detail-issues-tabs {
  display: flex;
  gap: var(--ink-space-xs);
  margin-bottom: var(--ink-space-md);
}

.series-detail-issues-tab {
  font-size: var(--ink-text-sm);
  padding: var(--ink-space-xs) var(--ink-space-md);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-full);
  background: transparent;
  color: var(--ink-text-secondary);
  cursor: pointer;
  transition: all var(--ink-transition-fast);
}

.series-detail-issues-tab:hover {
  border-color: var(--ink-accent-gold);
  color: var(--ink-accent-gold);
}

.series-detail-issues-tab.active {
  background: var(--ink-accent-gold-dim);
  border-color: var(--ink-accent-gold);
  color: var(--ink-accent-gold);
}

/* ── Stats Strip ────────────────────────────────────────────────────── */
.series-detail-stats-strip {
  display: flex;
  gap: var(--ink-space-sm);
  margin-bottom: var(--ink-space-md);
  flex-wrap: wrap;
}

/* ── Issues Table ──────────────────────────────────────────────────── */
.series-detail-issues-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
  overflow: hidden;
}

.series-detail-issues-table th {
  text-align: left;
  padding: var(--ink-space-sm) var(--ink-space-md);
  font-size: var(--ink-text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-text-muted);
  background: var(--ink-bg-elevated);
  border-bottom: 1px solid var(--ink-border-subtle);
}

.series-detail-issues-table td {
  padding: var(--ink-space-sm) var(--ink-space-md);
  font-size: var(--ink-text-sm);
  border-bottom: 1px solid var(--ink-border-subtle);
  color: var(--ink-text-primary);
  vertical-align: middle;
}

.series-detail-issues-table tr:last-child td {
  border-bottom: none;
}

.series-detail-issues-table tr:hover td {
  background: var(--ink-bg-hover);
}

.series-detail-issues-table .issue-num {
  font-weight: 600;
  white-space: nowrap;
}

.series-detail-issues-table .issue-date {
  color: var(--ink-text-muted);
  white-space: nowrap;
}

.series-detail-issues-table .issue-actions {
  white-space: nowrap;
}

/* ── Issue Action Buttons ───────────────────────────────────────────── */
.issue-action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--ink-space-xs);
  padding: 2px var(--ink-space-sm);
  font-size: var(--ink-text-xs);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-sm);
  background: transparent;
  color: var(--ink-text-secondary);
  cursor: pointer;
  transition: all var(--ink-transition-fast);
}

.issue-action-btn:hover {
  border-color: var(--ink-accent-gold);
  color: var(--ink-accent-gold);
}

.issue-action-btn.danger:hover {
  border-color: var(--ink-danger);
  color: var(--ink-danger);
}

.issue-action-btn.success:hover {
  border-color: var(--ink-success);
  color: var(--ink-success);
}

.issue-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Monitored Toggle ───────────────────────────────────────────────── */
.issue-monitor-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--ink-space-xs);
  cursor: pointer;
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  user-select: none;
}

.issue-monitor-toggle input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
}

.issue-monitor-toggle.monitored {
  color: var(--ink-success);
}

/* ── Library Section ───────────────────────────────────────────────── */
.series-detail-library {
  margin-bottom: var(--ink-space-xl);
}

.series-detail-library-card {
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
  padding: var(--ink-space-lg);
}

.series-detail-library-row {
  display: flex;
  justify-content: space-between;
  padding: var(--ink-space-xs) 0;
  font-size: var(--ink-text-sm);
  border-bottom: 1px solid var(--ink-border-subtle);
}

.series-detail-library-row:last-child {
  border-bottom: none;
}

.series-detail-library-label {
  color: var(--ink-text-muted);
}

.series-detail-library-value {
  color: var(--ink-text-primary);
  font-weight: 500;
  text-align: right;
}

/* ── Responsive ────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .series-detail-hero {
    flex-direction: column;
    align-items: center;
  }

  .series-detail-cover-wrap {
    width: 180px;
  }

  .series-detail-info {
    text-align: center;
  }

  .series-detail-meta-row {
    justify-content: center;
  }

  .series-detail-stats-row {
    justify-content: center;
  }

  .series-detail-actions {
    justify-content: center;
  }

  .series-detail-issues-table th:nth-child(4),
  .series-detail-issues-table td:nth-child(4) {
    display: none;
  }
}
`;

/* ── SeriesDetailPage Component ──────────────────────────────────────── */
export class SeriesDetailPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      error: null,
      series: null,
      library: null,
      libraryLoading: false,
      libraryError: null,
      showEdit: false,
      editMonitored: false,
      editTags: "",
      editSaving: false,
      runningSearch: false,
      refreshingCovers: false,
      deleting: false,
      // Issues panel state
      issues: [],
      issuesLoading: false,
      issuesError: null,
      issueFilter: "all",
      togglingIssue: null,
      searchingIssue: null,
    };

    this._mounted = false;
  }

  componentDidMount() {
    this._mounted = true;
    this._loadData();
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  /* ── Data Loading ────────────────────────────────────────────────── */
  async _loadData() {
    const routeParams = appStore.get("routeParams") || {};
    const id = routeParams.id;

    if (!id) {
      if (this._mounted) {
        this.setState({ loading: false, error: "No series ID specified." });
      }
      return;
    }

    this.setState({ loading: true, error: null });

    try {
      const data = await api.state.seriesDetail(id);

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || "Failed to load series detail");
      }

      const series = data.series;

      this.setState({
        loading: false,
        series,
        editMonitored: !!series.monitored,
        editTags: Array.isArray(series.tags) ? series.tags.join(", ") : series.tags || "",
      });

      // Load library and issues in background
      this._loadLibrary(id);
      this._loadIssues(id);
    } catch (err) {
      if (!this._mounted) return;
      this.setState({
        loading: false,
        error: err.message || "An unexpected error occurred",
      });
      toast(err.message || "Failed to load series detail", "error");
    }
  }

  async _loadLibrary(id) {
    this.setState({ libraryLoading: true, libraryError: null });

    try {
      const data = await api.state.seriesLibrary(id);

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || "Failed to load library info");
      }

      this.setState({
        libraryLoading: false,
        library: data.library,
      });
    } catch (err) {
      if (!this._mounted) return;
      this.setState({
        libraryLoading: false,
        libraryError: err.message || "Failed to load library info",
      });
    }
  }

  async _loadIssues(id) {
    this.setState({ issuesLoading: true, issuesError: null });

    try {
      const data = await api.state.view("issues", {
        focus_series_id: id,
        limit: 200,
        summary: "compact",
        rows: "compact",
      });

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || "Failed to load issues");
      }

      const issues = data.rows || data.issues || data.results || [];
      this.setState({
        issuesLoading: false,
        issues: Array.isArray(issues) ? issues : [],
      });
    } catch (err) {
      if (!this._mounted) return;
      this.setState({
        issuesLoading: false,
        issuesError: err.message || "Failed to load issues",
      });
    }
  }

  /* ── Actions ─────────────────────────────────────────────────────── */
  async _handleRunSearch() {
    const id = this.state.series?.series_id || this.state.series?.id;
    if (!id || this.state.runningSearch) return;

    this.setState({ runningSearch: true });

    try {
      const data = await api.state.seriesRun({ series_id: id });

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || "Search failed");
      }

      toast("Search started successfully", "success");
    } catch (err) {
      if (!this._mounted) return;
      toast(err.message || "Failed to run search", "error");
    } finally {
      if (this._mounted) {
        this.setState({ runningSearch: false });
      }
    }
  }

  async _handleRefreshMetadata() {
    const id = this.state.series?.series_id || this.state.series?.id;
    if (!id || this.state.refreshingCovers) return;

    this.setState({ refreshingCovers: true });

    try {
      const data = await api.state.seriesCoversRefresh({ series_id: id });

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || "Refresh failed");
      }

      toast("Metadata refresh started", "success");
    } catch (err) {
      if (!this._mounted) return;
      toast(err.message || "Failed to refresh metadata", "error");
    } finally {
      if (this._mounted) {
        this.setState({ refreshingCovers: false });
      }
    }
  }

  async _handleToggleMonitored() {
    const { series } = this.state;
    const id = series?.series_id || series?.id;
    if (!id) return;

    const newValue = !series.monitored;

    try {
      const data = await api.state.seriesUpdate({ series_id: id, monitored: newValue });

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || "Update failed");
      }

      toast(newValue ? "Series is now monitored" : "Series is now unmonitored", "success");
      this.setState((prev) => ({
        series: { ...prev.series, monitored: newValue },
        editMonitored: newValue,
      }));
    } catch (err) {
      if (!this._mounted) return;
      toast(err.message || "Failed to toggle monitoring", "error");
    }
  }

  _handleNavigateWanted() {
    const id = this.state.series?.series_id || this.state.series?.id;
    if (!id) return;
    router.navigate("wanted", { focus: id });
  }

  _handleNavigateQueue() {
    const id = this.state.series?.series_id || this.state.series?.id;
    if (!id) return;
    router.navigate("queue", { focus: id });
  }

  _toggleEdit() {
    const { showEdit, series } = this.state;
    if (showEdit) {
      // Cancel — reset form
      this.setState({
        showEdit: false,
        editMonitored: !!series.monitored,
        editTags: Array.isArray(series.tags) ? series.tags.join(", ") : series.tags || "",
      });
    } else {
      this.setState({ showEdit: true });
    }
  }

  async _handleSaveEdit() {
    const id = this.state.series?.series_id || this.state.series?.id;
    if (!id || this.state.editSaving) return;

    this.setState({ editSaving: true });

    try {
      const tags = this.state.editTags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const data = await api.state.seriesUpdate({
        series_id: id,
        monitored: this.state.editMonitored,
        tags,
      });

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || "Update failed");
      }

      toast("Series updated", "success");

      // Refresh series data
      this.setState({ showEdit: false, editSaving: false });
      this._loadData();
    } catch (err) {
      if (!this._mounted) return;
      this.setState({ editSaving: false });
      toast(err.message || "Failed to update series", "error");
    }
  }

  async _handleDelete() {
    const id = this.state.series?.series_id || this.state.series?.id;
    if (!id || this.state.deleting) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${this.state.series.title || this.state.series.name}"?\n\nThis action cannot be undone. All series data, including issues and library references, will be removed.`,
    );

    if (!confirmed) return;

    this.setState({ deleting: true });

    try {
      const data = await api.state.seriesRemove({ series_id: id });

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || "Delete failed");
      }

      toast("Series deleted", "success");
      router.navigateToSection("series");
    } catch (err) {
      if (!this._mounted) return;
      this.setState({ deleting: false });
      toast(err.message || "Failed to delete series", "error");
    }
  }

  /* ── Issue Actions ────────────────────────────────────────────────── */
  async _handleIssueMonitorToggle(issue, newValue) {
    if (this.state.togglingIssue === issue.id) return;

    this.setState({ togglingIssue: issue.id });

    try {
      const data = await api.state.issueMonitorSet({ issueId: issue.id, monitored: newValue });

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || "Failed to update issue monitor");
      }

      toast(newValue ? "Issue is now monitored" : "Issue is now unmonitored", "success");

      // Update local state
      this.setState((prev) => ({
        issues: prev.issues.map((i) => (i.id === issue.id ? { ...i, monitored: newValue } : i)),
      }));
    } catch (err) {
      if (!this._mounted) return;
      toast(err.message || "Failed to toggle issue monitoring", "error");
    } finally {
      if (this._mounted) {
        this.setState({ togglingIssue: null });
      }
    }
  }

  async _handleIssueSearch(issue) {
    const seriesId = this.state.series?.series_id || this.state.series?.id;
    if (!seriesId || this.state.searchingIssue === issue.id) return;

    this.setState({ searchingIssue: issue.id });

    try {
      const data = await api.state.seriesRun({ series_id: seriesId, issue_id: issue.id });

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || "Search failed");
      }

      toast(`Search started for issue #${issueNumber(issue)}`, "success");
    } catch (err) {
      if (!this._mounted) return;
      toast(err.message || "Failed to run search", "error");
    } finally {
      if (this._mounted) {
        this.setState({ searchingIssue: null });
      }
    }
  }

  /* ── Render Helpers ──────────────────────────────────────────────── */
  _renderLoading() {
    return (
      <div class="ink-loading">
        <div class="ink-spinner" />
        <span style="margin-left:var(--ink-space-md);">Loading series detail…</span>
      </div>
    );
  }

  _renderError() {
    return (
      <div class="ink-auth-error" style="text-align:center;padding:var(--ink-space-2xl);">
        <div style="font-size:var(--ink-text-lg);font-weight:600;margin-bottom:var(--ink-space-sm);">
          Failed to Load Series
        </div>
        <div style="font-size:var(--ink-text-sm);color:var(--ink-text-muted);margin-bottom:var(--ink-space-lg);">
          {this.state.error}
        </div>
        <button class="ink-btn-primary" onClick={() => this._loadData()} type="button">
          Retry
        </button>
      </div>
    );
  }

  _renderHero() {
    const { series } = this.state;
    if (!series) return null;

    const coverUrl = series.cover_url ? api.cover.url(series.cover_url) : null;

    // Description: strip HTML, read from multiple possible fields, truncate to 600 chars
    const rawDesc = series.metadata?.description || series.description || "";
    const cleanDesc = truncate(stripHtml(rawDesc), 600);

    return (
      <div class="series-detail-hero">
        <div class="series-detail-cover-wrap">
          {coverUrl ? (
            <img
              class="series-detail-cover"
              src={coverUrl}
              alt={`${series.title || series.name} cover`}
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div class="series-detail-cover-placeholder" style={coverUrl ? { display: "none" } : {}}>
            No Cover Available
          </div>
        </div>

        <div class="series-detail-info">
          <h1 class="series-detail-name">{series.title || series.name}</h1>

          {cleanDesc ? (
            <div class="series-detail-description">{cleanDesc}</div>
          ) : (
            <div class="series-detail-description" style="color:var(--ink-text-muted);font-style:italic;">
              No description available
            </div>
          )}

          <div class="series-detail-meta-row">
            {series.metadata?.publisher && <span class="ink-pill ink-pill-muted">{series.metadata.publisher}</span>}
            {series.metadata?.source && <span class="ink-pill ink-pill-info">{series.metadata.source}</span>}
            {series.metadata?.provider_id && <span class="ink-pill ink-pill-muted">{series.metadata.provider_id}</span>}
            <span class={`series-ownership ${ownershipClass(series.ownership)}`}>
              {ownershipLabel(series.ownership)}
            </span>
          </div>

          <div style="font-size:var(--ink-text-sm);color:var(--ink-text-secondary);">
            {(series.metadata?.year || series.start_year || series.year) && (
              <span>Started {series.metadata?.year || series.start_year || series.year}</span>
            )}
            {(series.counts?.issues > 0 || series.issue_count > 0 || series.count_of_issues > 0) && (
              <span>
                {series.metadata?.year || series.start_year || series.year ? " · " : ""}
                {series.counts?.issues || series.issue_count || series.count_of_issues} issues
              </span>
            )}
          </div>

          <div class="series-detail-stats-row">
            {(series.counts?.wanted || series.wanted_count) > 0 && (
              <span class="ink-pill ink-pill-warning">{series.counts?.wanted || series.wanted_count} Wanted</span>
            )}
            {(series.counts?.queue || series.active_queue_count) > 0 && (
              <span class="ink-pill ink-pill-info">{series.counts?.queue || series.active_queue_count} In Queue</span>
            )}
            {(series.counts?.needs_you || series.needs_you_count) > 0 && (
              <span class="ink-pill ink-pill-danger">
                {series.counts?.needs_you || series.needs_you_count} Needs You
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  _renderActions() {
    const { runningSearch, refreshingCovers, deleting, series } = this.state;
    const isMonitored = !!series?.monitored;

    return (
      <div class="series-detail-actions">
        <button
          class="ink-btn-primary ink-btn-sm"
          onClick={() => this._handleRunSearch()}
          disabled={runningSearch}
          type="button"
        >
          {runningSearch ? (
            <>
              <span class="ink-spinner" style="width:14px;height:14px;border-width:2px;" /> Searching
            </>
          ) : (
            "Search"
          )}
        </button>

        <button
          class="ink-btn-ghost ink-btn-sm"
          onClick={() => {
            const series = this.state.series;
            if (!series) return;
            window.dispatchEvent(
              new CustomEvent("inkdrop:open-manual-search", {
                detail: {
                  series_id: series.series_id || series.id,
                  series_name: series.title || series.name,
                },
              }),
            );
          }}
          type="button"
        >
          🔍 Manual Search
        </button>

        <button
          class="ink-btn-ghost ink-btn-sm"
          onClick={() => this._handleRefreshMetadata()}
          disabled={refreshingCovers}
          type="button"
        >
          {refreshingCovers ? (
            <>
              <span class="ink-spinner" style="width:14px;height:14px;border-width:2px;" /> Refreshing
            </>
          ) : (
            "Refresh Metadata"
          )}
        </button>

        <button
          class={`ink-btn-ghost ink-btn-sm ${isMonitored ? "ink-pill-success" : ""}`}
          onClick={() => this._handleToggleMonitored()}
          type="button"
        >
          {isMonitored ? "Unmonitor" : "Monitor"}
        </button>

        <button class="ink-btn-ghost ink-btn-sm" onClick={() => this._handleNavigateWanted()} type="button">
          Wanted
        </button>

        <button class="ink-btn-ghost ink-btn-sm" onClick={() => this._handleNavigateQueue()} type="button">
          Queue
        </button>

        <button class="ink-btn-ghost ink-btn-sm" onClick={() => this._toggleEdit()} type="button">
          {this.state.showEdit ? "Cancel" : "Edit"}
        </button>

        <button
          class="ink-btn-danger ink-btn-sm"
          onClick={() => this._handleDelete()}
          disabled={deleting}
          type="button"
        >
          {deleting ? (
            <>
              <span class="ink-spinner" style="width:14px;height:14px;border-width:2px;" /> Deleting
            </>
          ) : (
            "Delete"
          )}
        </button>
      </div>
    );
  }

  _renderEditForm() {
    if (!this.state.showEdit) return null;

    return (
      <div class="series-detail-edit-form">
        <h3 style="margin:0;font-size:var(--ink-text-base);font-weight:600;">Edit Series</h3>

        <div class="series-detail-edit-row">
          <label class="series-detail-edit-label" for="series-monitored">
            Monitored
          </label>
          <input
            id="series-monitored"
            type="checkbox"
            checked={this.state.editMonitored}
            onChange={(e) => this.setState({ editMonitored: e.target.checked })}
          />
        </div>

        <div class="series-detail-edit-row">
          <label class="series-detail-edit-label" for="series-tags">
            Tags
          </label>
          <input
            id="series-tags"
            class="ink-field"
            type="text"
            value={this.state.editTags}
            onInput={(e) => this.setState({ editTags: e.target.value })}
            placeholder="Comma-separated tags"
            style="flex:1;"
          />
        </div>

        <div style="display:flex;gap:var(--ink-space-sm);">
          <button
            class="ink-btn-primary ink-btn-sm"
            onClick={() => this._handleSaveEdit()}
            disabled={this.state.editSaving}
            type="button"
          >
            {this.state.editSaving ? (
              <>
                <span class="ink-spinner" style="width:14px;height:14px;border-width:2px;" /> Saving
              </>
            ) : (
              "Save"
            )}
          </button>
          <button class="ink-btn-ghost ink-btn-sm" onClick={() => this._toggleEdit()} type="button">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  _renderIssues() {
    const { series, issues, issuesLoading, issuesError, issueFilter, togglingIssue, searchingIssue } = this.state;
    if (!series) return null;

    // Filter issues
    let filteredIssues = issues;
    if (issueFilter === "wanted") {
      filteredIssues = issues.filter((i) => {
        const label = (i.completion_gate?.label || i.wanted_status || i.queue_state || "").toLowerCase();
        return label === "wanted" || label === "missing";
      });
    } else if (issueFilter === "queue") {
      filteredIssues = issues.filter((i) => {
        const label = (i.completion_gate?.label || i.wanted_status || i.queue_state || "").toLowerCase();
        return label === "queued" || label === "active" || label === "searching";
      });
    }

    return (
      <div class="series-detail-issues">
        <div class="series-detail-issues-header">
          <div class="series-detail-issues-header-left">
            <h2 class="series-detail-section-title" style="margin:0;border:none;padding:0;">
              Issues
            </h2>
            <span class="series-detail-issues-count">{issues.length}</span>
          </div>
        </div>

        {/* Stats Strip */}
        <div class="series-detail-stats-strip">
          {(series.counts?.wanted || series.wanted_count) > 0 ? (
            <span class="ink-pill ink-pill-warning">{series.counts?.wanted || series.wanted_count} Wanted</span>
          ) : (
            <span class="ink-pill ink-pill-muted">0 Wanted</span>
          )}
          {(series.counts?.queue || series.active_queue_count) > 0 ? (
            <span class="ink-pill ink-pill-warning">{series.counts?.queue || series.active_queue_count} In Queue</span>
          ) : (
            <span class="ink-pill ink-pill-muted">0 In Queue</span>
          )}
          {(series.counts?.needs_you || series.needs_you_count) > 0 ? (
            <span class="ink-pill ink-pill-danger">{series.counts?.needs_you || series.needs_you_count} Needs You</span>
          ) : (
            <span class="ink-pill ink-pill-muted">0 Needs You</span>
          )}
        </div>

        {/* Filter Tabs */}
        <div class="series-detail-issues-tabs">
          {["all", "wanted", "queue"].map((tab) => (
            <button
              class={`series-detail-issues-tab ${issueFilter === tab ? "active" : ""}`}
              onClick={() => this.setState({ issueFilter: tab })}
              type="button"
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {issuesLoading && (
          <div class="ink-loading" style="justify-content:flex-start;padding:var(--ink-space-lg);">
            <div class="ink-spinner" style="width:14px;height:14px;border-width:2px;" />
            <span style="margin-left:var(--ink-space-sm);font-size:var(--ink-text-sm);color:var(--ink-text-muted);">
              Loading issues…
            </span>
          </div>
        )}

        {/* Error State */}
        {issuesError && !issuesLoading && (
          <div style="font-size:var(--ink-text-sm);color:var(--ink-text-muted);padding:var(--ink-space-md);">
            {issuesError}
          </div>
        )}

        {/* Empty State */}
        {!issuesLoading && !issuesError && filteredIssues.length === 0 && (
          <div style="font-size:var(--ink-text-sm);color:var(--ink-text-muted);padding:var(--ink-space-md);text-align:center;">
            {issueFilter === "all" ? "No issues found for this series." : `No ${issueFilter} issues.`}
          </div>
        )}

        {/* Issues Table */}
        {!issuesLoading && !issuesError && filteredIssues.length > 0 && (
          <table class="series-detail-issues-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((issue, idx) => {
                const num = issueNumber(issue);
                const title = issueTitle(issue);
                const statusLabel = issueStatusLabel(issue);
                const statusClass = issueStatusPillClass(issue);
                const isMonitored = !!issue.monitored;
                const isToggling = togglingIssue === issue.id;
                const isSearching = searchingIssue === issue.id;

                return (
                  <tr key={issue.id || num || idx}>
                    <td class="issue-num">{num}</td>
                    <td>{title}</td>
                    <td>
                      <span class={`ink-pill ${statusClass}`}>{statusLabel}</span>
                    </td>
                    <td class="issue-date">{formatDate(issue.release_date)}</td>
                    <td class="issue-actions">
                      <label
                        class={`issue-monitor-toggle ${isMonitored ? "monitored" : ""}`}
                        onClick={() => this._handleIssueMonitorToggle(issue, !isMonitored)}
                      >
                        <input
                          type="checkbox"
                          checked={isMonitored}
                          disabled={isToggling}
                          onChange={(e) => e.stopPropagation()}
                        />
                        {isToggling ? (
                          <span
                            class="ink-spinner"
                            style="width:10px;height:10px;border-width:1.5px;display:inline-block;"
                          />
                        ) : isMonitored ? (
                          "Monitored"
                        ) : (
                          "Monitor"
                        )}
                      </label>
                      <button
                        class="issue-action-btn"
                        onClick={() => this._handleIssueSearch(issue)}
                        disabled={isSearching}
                        type="button"
                        style="margin-left:var(--ink-space-xs);"
                      >
                        {isSearching ? (
                          <span
                            class="ink-spinner"
                            style="width:10px;height:10px;border-width:1.5px;display:inline-block;"
                          />
                        ) : (
                          "Search"
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  _renderLibrary() {
    const { library, libraryLoading, libraryError } = this.state;

    if (libraryLoading) {
      return (
        <div class="series-detail-library">
          <h2 class="series-detail-section-title">Library</h2>
          <div class="ink-loading" style="justify-content:flex-start;">
            <div class="ink-spinner" style="width:14px;height:14px;border-width:2px;" />
            <span style="margin-left:var(--ink-space-sm);font-size:var(--ink-text-sm);color:var(--ink-text-muted);">
              Loading library info…
            </span>
          </div>
        </div>
      );
    }

    if (libraryError) {
      return (
        <div class="series-detail-library">
          <h2 class="series-detail-section-title">Library</h2>
          <div style="font-size:var(--ink-text-sm);color:var(--ink-text-muted);">{libraryError}</div>
        </div>
      );
    }

    if (!library) return null;

    return (
      <div class="series-detail-library">
        <h2 class="series-detail-section-title">Library</h2>
        <div class="series-detail-library-card">
          {Object.entries(library).map(([key, value]) => (
            <div class="series-detail-library-row" key={key}>
              <span class="series-detail-library-label">
                {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              <span class="series-detail-library-value">
                {value == null
                  ? "—"
                  : Array.isArray(value)
                    ? value.length > 0
                      ? value.join(", ")
                      : "—"
                    : typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Main Render ─────────────────────────────────────────────────── */
  render() {
    const { loading, error, series } = this.state;

    return (
      <div class="series-detail-page">
        <style>{styles}</style>

        {/* ── Back Button ──────────────────────────────────────────── */}
        <button class="series-detail-back" onClick={() => router.navigateToSection("series")} type="button">
          <span>&larr;</span> Back to Series
        </button>

        {/* ── Loading State ────────────────────────────────────────── */}
        {loading && this._renderLoading()}

        {/* ── Error State ─────────────────────────────────────────── */}
        {error && this._renderError()}

        {/* ── Content ─────────────────────────────────────────────── */}
        {!loading && !error && series && (
          <>
            {this._renderHero()}
            {this._renderActions()}
            {this._renderEditForm()}
            {this._renderIssues()}
            {this._renderLibrary()}
          </>
        )}
      </div>
    );
  }
}

export default SeriesDetailPage;
