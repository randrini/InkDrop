/**
 * InkDrop — Series Detail Page
 * Full detail view for a single series with cover, info, actions,
 * edit form, recent issues, and library info.
 */

import { h, Component } from "preact";
import api from "../api/client.jsx";
import { toast } from "../main.jsx";
import { appStore } from "../stores/app-store.jsx";
import { router } from "../router.jsx";

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
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
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

/* ── Issues Table ──────────────────────────────────────────────────── */
.series-detail-issues {
  margin-bottom: var(--ink-space-xl);
}

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
}

.series-detail-issues-table tr:last-child td {
  border-bottom: none;
}

.series-detail-issues-table tr:hover td {
  background: var(--ink-bg-hover);
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
}
`;

/* ── Helpers ────────────────────────────────────────────────────────── */
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
  if (s === "downloaded" || s === "completed" || s === "owned") return "ink-pill-success";
  if (s === "wanted" || s === "missing") return "ink-pill-warning";
  if (s === "queued" || s === "searching" || s === "active") return "ink-pill-info";
  if (s === "error" || s === "failed") return "ink-pill-muted";
  return "ink-pill-muted";
}

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

      // Load library data in background
      this._loadLibrary(id);
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

  /* ── Actions ─────────────────────────────────────────────────────── */
  async _handleRunSearch() {
    const id = this.state.series?.id;
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
    const id = this.state.series?.id;
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
    const id = this.state.series?.id;
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
    const id = this.state.series?.id;
    if (!id || this.state.deleting) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${this.state.series.name}"?\n\nThis action cannot be undone. All series data, including issues and library references, will be removed.`,
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

    return (
      <div class="series-detail-hero">
        <div class="series-detail-cover-wrap">
          {coverUrl ? (
            <img
              class="series-detail-cover"
              src={coverUrl}
              alt={`${series.name} cover`}
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
          <h1 class="series-detail-name">{series.name}</h1>

          {series.description && <div class="series-detail-description">{series.description}</div>}

          <div class="series-detail-meta-row">
            {series.publisher && <span class="ink-pill ink-pill-muted">{series.publisher}</span>}
            {series.source && <span class="ink-pill ink-pill-info">{series.source}</span>}
            {series.metadata_provider && <span class="ink-pill ink-pill-muted">{series.metadata_provider}</span>}
            <span class={`series-ownership ${ownershipClass(series.ownership)}`}>
              {ownershipLabel(series.ownership)}
            </span>
          </div>

          {series.start_year && (
            <div style="font-size:var(--ink-text-sm);color:var(--ink-text-secondary);">
              Started {series.start_year}
              {series.total_issues != null ? ` · ${series.total_issues} issues` : ""}
            </div>
          )}

          <div class="series-detail-stats-row">
            {series.wanted_count > 0 && <span class="ink-pill ink-pill-warning">{series.wanted_count} Wanted</span>}
            {series.active_queue_count > 0 && (
              <span class="ink-pill ink-pill-info">{series.active_queue_count} In Queue</span>
            )}
            {series.needs_you_count > 0 && (
              <span class="ink-pill" style="background:var(--ink-danger-dim);color:var(--ink-danger);">
                {series.needs_you_count} Needs You
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  _renderActions() {
    const { runningSearch, refreshingCovers, deleting } = this.state;

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
            "Run Search"
          )}
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
    const { series } = this.state;
    if (!series) return null;

    const issues = series.recent_issues || series.issues;
    if (!issues || !Array.isArray(issues) || issues.length === 0) return null;

    return (
      <div class="series-detail-issues">
        <h2 class="series-detail-section-title">Recent Issues</h2>
        <table class="series-detail-issues-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, idx) => (
              <tr key={issue.id || issue.issue_number || idx}>
                <td style="font-weight:600;white-space:nowrap;">{issue.issue_number || issue.number || "—"}</td>
                <td>{issue.title || issue.name || "Untitled"}</td>
                <td>
                  {issue.status ? (
                    <span class={`ink-pill ${statusPillClass(issue.status)}`}>{issue.status}</span>
                  ) : (
                    <span class="ink-pill ink-pill-muted">Unknown</span>
                  )}
                </td>
                <td style="color:var(--ink-text-muted);white-space:nowrap;">
                  {formatDate(issue.date || issue.release_date || issue.cover_date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
              <span class="series-detail-library-value">{value == null ? "—" : String(value)}</span>
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
