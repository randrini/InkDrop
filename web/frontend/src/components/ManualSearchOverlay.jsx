/**
 * InkDrop — ManualSearchOverlay
 * Full-screen overlay for manual search. Opens on `inkdrop:open-manual-search` custom event.
 * Polls search runs, shows results with filters, supports grab and cancel.
 */

import { h, Component } from "preact";
import api from "../api/client.jsx";
import { toast } from "../main.jsx";

const styles = `
.ink-manual-overlay {
  position: fixed;
  inset: 0;
  background: var(--ink-bg-overlay);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ink-fade-in var(--ink-transition-fast) ease-out;
}
.ink-manual-dialog {
  background: var(--ink-bg-primary);
  border: 1px solid var(--ink-border-default);
  border-radius: var(--ink-radius-xl);
  width: 95vw;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: ink-dialog-in var(--ink-transition-base) ease-out;
}
.ink-manual-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ink-space-lg) var(--ink-space-xl);
  border-bottom: 1px solid var(--ink-border-subtle);
  flex-shrink: 0;
}
.ink-manual-header h2 {
  font-family: var(--ink-font-display);
  font-size: var(--ink-text-xl);
  font-weight: 400;
}
.ink-manual-close {
  background: transparent;
  border: none;
  color: var(--ink-text-muted);
  font-size: var(--ink-text-xl);
  padding: var(--ink-space-xs);
  min-height: unset;
  line-height: 1;
  border-radius: var(--ink-radius-sm);
}
.ink-manual-close:hover {
  color: var(--ink-text-primary);
  background: var(--ink-bg-hover);
}
.ink-manual-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--ink-space-xl);
}
.ink-manual-status {
  display: flex;
  align-items: center;
  gap: var(--ink-space-md);
  margin-bottom: var(--ink-space-lg);
  padding: var(--ink-space-md) var(--ink-space-lg);
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-md);
}
.ink-manual-status-text {
  font-size: var(--ink-text-sm);
  color: var(--ink-text-secondary);
}
.ink-manual-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ink-space-sm);
  margin-bottom: var(--ink-space-lg);
}
.ink-manual-filters select,
.ink-manual-filters input {
  min-width: 120px;
  flex: 0 1 auto;
  font-size: var(--ink-text-xs);
  min-height: 30px;
  padding: var(--ink-space-xs) var(--ink-space-sm);
}
.ink-manual-results {
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-sm);
}
.ink-manual-result {
  display: flex;
  align-items: center;
  gap: var(--ink-space-md);
  padding: var(--ink-space-md) var(--ink-space-lg);
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-md);
  transition: border-color var(--ink-transition-fast);
}
.ink-manual-result:hover {
  border-color: var(--ink-border-default);
}
.ink-manual-result-info {
  flex: 1;
  min-width: 0;
}
.ink-manual-result-title {
  font-size: var(--ink-text-sm);
  font-weight: 600;
}
.ink-manual-result-meta {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  margin-top: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: var(--ink-space-xs);
}
.ink-manual-result-meta span {
  white-space: nowrap;
}
.ink-manual-result-actions {
  flex-shrink: 0;
  display: flex;
  gap: var(--ink-space-xs);
}
.ink-manual-result-actions button {
  min-height: 28px;
  padding: var(--ink-space-xs) var(--ink-space-sm);
  font-size: var(--ink-text-xs);
}
.ink-manual-score {
  flex-shrink: 0;
  text-align: center;
  min-width: 40px;
}
.ink-manual-score-value {
  font-size: var(--ink-text-sm);
  font-weight: 600;
  font-family: var(--ink-font-mono);
}
.ink-manual-score-label {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
}
.ink-manual-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ink-space-sm);
  margin-top: var(--ink-space-lg);
  padding-top: var(--ink-space-lg);
  border-top: 1px solid var(--ink-border-subtle);
}
.ink-manual-pagination button {
  min-height: 30px;
  padding: var(--ink-space-xs) var(--ink-space-md);
  font-size: var(--ink-text-sm);
}
.ink-manual-pagination span {
  font-size: var(--ink-text-sm);
  color: var(--ink-text-muted);
}
.ink-manual-empty {
  text-align: center;
  padding: var(--ink-space-3xl) var(--ink-space-xl);
  color: var(--ink-text-muted);
}
.ink-manual-empty-icon {
  font-size: 2.5rem;
  margin-bottom: var(--ink-space-md);
  opacity: 0.4;
}
.ink-manual-error {
  text-align: center;
  padding: var(--ink-space-xl);
  color: var(--ink-text-danger);
}
@media (max-width: 768px) {
  .ink-manual-dialog {
    width: 100vw;
    max-height: 100vh;
    border-radius: 0;
  }
  .ink-manual-result {
    flex-wrap: wrap;
  }
  .ink-manual-filters select,
  .ink-manual-filters input {
    min-width: 80px;
    flex: 1 1 auto;
  }
}
`;

const POLL_INTERVAL = 3000;
const PAGE_SIZE = 25;

class ManualSearchOverlay extends Component {
  constructor() {
    super();
    this.state = {
      open: false,
      seriesId: null,
      seriesName: "",
      runId: null,
      runStatus: null,
      loading: false,
      error: null,
      results: [],
      totalResults: 0,
      offset: 0,
      filters: {
        decision: "",
        provider: "",
        protocol: "",
        language: "",
        format: "",
        pack: "",
        assisted: "",
        score_min: "",
        score_max: "",
        sort: "",
      },
      grabbing: new Set(),
    };
    this._onOpen = this._onOpen.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._close = this._close.bind(this);
    this._startSearch = this._startSearch.bind(this);
    this._pollRun = this._pollRun.bind(this);
    this._loadResults = this._loadResults.bind(this);
    this._handleGrab = this._handleGrab.bind(this);
    this._handleCancel = this._handleCancel.bind(this);
    this._handleFilterChange = this._handleFilterChange.bind(this);
    this._handlePageChange = this._handlePageChange.bind(this);
  }

  componentDidMount() {
    window.addEventListener("inkdrop:open-manual-search", this._onOpen);
    window.addEventListener("keydown", this._onKeyDown);
  }

  componentWillUnmount() {
    window.removeEventListener("inkdrop:open-manual-search", this._onOpen);
    window.removeEventListener("keydown", this._onKeyDown);
    if (this._pollTimer) clearInterval(this._pollTimer);
  }

  _onOpen(e) {
    const detail = e.detail || {};
    this.setState(
      {
        open: true,
        seriesId: detail.series_id || null,
        seriesName: detail.series_name || detail.title || "",
        runId: null,
        runStatus: null,
        loading: false,
        error: null,
        results: [],
        totalResults: 0,
        offset: 0,
        filters: {
          decision: "",
          provider: "",
          protocol: "",
          language: "",
          format: "",
          pack: "",
          assisted: "",
          score_min: "",
          score_max: "",
          sort: "",
        },
        grabbing: new Set(),
      },
      () => {
        this._startSearch();
      },
    );
  }

  _onKeyDown(e) {
    if (e.key === "Escape" && this.state.open) {
      this._close();
    }
  }

  _close() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this.setState({ open: false });
  }

  async _startSearch() {
    const { seriesId } = this.state;
    if (!seriesId) {
      this.setState({ error: "No series selected", loading: false });
      return;
    }

    this.setState({ loading: true, error: null });
    try {
      const data = await api.manualSearch.createRun({ series_id: seriesId });
      if (data.ok) {
        const runId = data.run_id || data.id || data.run?.id;
        this.setState({ runId, loading: false, runStatus: "pending" }, () => {
          this._pollRun();
        });
      } else {
        this.setState({ error: data.error || "Failed to start search", loading: false });
      }
    } catch (err) {
      this.setState({ error: err.message || "Failed to start search", loading: false });
    }
  }

  _pollRun() {
    if (this._pollTimer) clearInterval(this._pollTimer);

    this._pollTimer = setInterval(async () => {
      const { runId } = this.state;
      if (!runId) return;

      try {
        const data = await api.manualSearch.getRun(runId);
        if (data.ok) {
          const runData = data.state || data;
          const status = runData.status || runData.state;
          this.setState({ runStatus: status });

          if (status === "completed" || status === "finished" || status === "done") {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
            this._loadResults();
          } else if (status === "failed" || status === "error" || status === "cancelled") {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
            this.setState({ error: runData.error || `Search ${status}` });
          }
        }
      } catch {
        // continue polling
      }
    }, POLL_INTERVAL);
  }

  async _loadResults() {
    const { runId, offset, filters } = this.state;
    if (!runId) return;

    try {
      const params = {
        limit: PAGE_SIZE,
        offset,
      };
      // Add non-empty filters
      for (const [key, value] of Object.entries(filters)) {
        if (value !== "" && value !== null && value !== undefined) {
          if (key === "score_min") params.score_min = Number(value);
          else if (key === "score_max") params.score_max = Number(value);
          else if (key === "sort") params.sort = value;
          else if (key === "assisted") params.assisted = value === "true" ? true : value === "false" ? false : value;
          else params[key] = value;
        }
      }

      const data = await api.manualSearch.getResults(runId, params);
      if (data.ok) {
        const resultsData = data.state || data;
        this.setState({
          results: resultsData.items || resultsData.results || resultsData.rows || [],
          totalResults: resultsData.total_count || resultsData.total || 0,
        });
      }
    } catch (err) {
      this.setState({ error: err.message || "Failed to load results" });
    }
  }

  async _handleGrab(candidateId) {
    if (!candidateId) return;
    this.setState((prev) => {
      const next = new Set(prev.grabbing);
      next.add(candidateId);
      return { grabbing: next };
    });

    try {
      const data = await api.manualSearch.grabCandidate(candidateId, {});
      if (data.ok) {
        toast("Candidate grabbed successfully", "success");
        this._loadResults();
      } else {
        toast(data.error || "Failed to grab candidate", "error");
      }
    } catch (err) {
      toast(err.message || "Failed to grab candidate", "error");
    } finally {
      this.setState((prev) => {
        const next = new Set(prev.grabbing);
        next.delete(candidateId);
        return { grabbing: next };
      });
    }
  }

  async _handleCancel() {
    const { runId } = this.state;
    if (!runId) return;

    try {
      const data = await api.manualSearch.cancelRun(runId);
      if (data.ok) {
        toast("Search cancelled", "info");
        if (this._pollTimer) {
          clearInterval(this._pollTimer);
          this._pollTimer = null;
        }
        this.setState({ runStatus: "cancelled" });
      } else {
        toast(data.error || "Failed to cancel search", "error");
      }
    } catch (err) {
      toast(err.message || "Failed to cancel search", "error");
    }
  }

  _handleFilterChange(key, value) {
    this.setState(
      (prev) => ({
        filters: { ...prev.filters, [key]: value },
        offset: 0,
      }),
      () => {
        this._loadResults();
      },
    );
  }

  _handlePageChange(newOffset) {
    this.setState({ offset: Math.max(0, newOffset) }, () => {
      this._loadResults();
    });
  }

  _renderStatusPill(status) {
    if (!status) return null;
    const s = String(status).toLowerCase();
    if (s === "completed" || s === "finished" || s === "done")
      return <span class="ink-pill ink-pill-success">Completed</span>;
    if (s === "running" || s === "in_progress" || s === "pending")
      return <span class="ink-pill ink-pill-info">{status}</span>;
    if (s === "failed" || s === "error") return <span class="ink-pill ink-pill-danger">Failed</span>;
    if (s === "cancelled") return <span class="ink-pill ink-pill-warning">Cancelled</span>;
    return <span class="ink-pill ink-pill-muted">{status}</span>;
  }

  render() {
    const { open, seriesName, runStatus, loading, error, results, totalResults, offset, filters, grabbing } =
      this.state;

    if (!open) return null;

    const totalPages = Math.ceil(totalResults / PAGE_SIZE);
    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
    const isSearching =
      runStatus &&
      !["completed", "finished", "done", "failed", "error", "cancelled"].includes(String(runStatus).toLowerCase());

    return (
      <div
        class="ink-manual-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) this._close();
        }}
      >
        <style>{styles}</style>
        <div class="ink-manual-dialog" role="dialog" aria-modal="true" aria-label="Manual Search">
          {/* Header */}
          <div class="ink-manual-header">
            <h2>Manual Search{seriesName ? `: ${seriesName}` : ""}</h2>
            <button class="ink-manual-close" onClick={this._close} aria-label="Close search overlay">
              ✕
            </button>
          </div>

          {/* Body */}
          <div class="ink-manual-body">
            {/* Status bar */}
            {runStatus && (
              <div class="ink-manual-status">
                {isSearching && <div class="ink-spinner" />}
                <span class="ink-manual-status-text">{isSearching ? "Searching..." : "Search complete"}</span>
                {this._renderStatusPill(runStatus)}
                {isSearching && (
                  <button class="ink-btn-danger ink-btn-sm" onClick={this._handleCancel} style="margin-left: auto;">
                    Cancel
                  </button>
                )}
              </div>
            )}

            {/* Loading state */}
            {loading && !runStatus && (
              <div class="ink-loading">
                <div class="ink-spinner" />
                <span style="margin-left: var(--ink-space-sm);">Starting search...</span>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div class="ink-manual-error">
                <p>{error}</p>
                <button class="ink-btn-ghost" style="margin-top: var(--ink-space-md);" onClick={this._startSearch}>
                  Retry
                </button>
              </div>
            )}

            {/* Filters */}
            {results.length > 0 && (
              <div class="ink-manual-filters">
                <select value={filters.decision} onChange={(e) => this._handleFilterChange("decision", e.target.value)}>
                  <option value="">All Decisions</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="pending">Pending</option>
                </select>
                <input
                  type="text"
                  placeholder="Provider"
                  value={filters.provider}
                  onInput={(e) => this._handleFilterChange("provider", e.target.value)}
                />
                <select value={filters.protocol} onChange={(e) => this._handleFilterChange("protocol", e.target.value)}>
                  <option value="">All Protocols</option>
                  <option value="torrent">Torrent</option>
                  <option value="usenet">Usenet</option>
                  <option value="direct">Direct</option>
                </select>
                <input
                  type="text"
                  placeholder="Language"
                  value={filters.language}
                  onInput={(e) => this._handleFilterChange("language", e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Format"
                  value={filters.format}
                  onInput={(e) => this._handleFilterChange("format", e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Pack"
                  value={filters.pack}
                  onInput={(e) => this._handleFilterChange("pack", e.target.value)}
                />
                <select value={filters.assisted} onChange={(e) => this._handleFilterChange("assisted", e.target.value)}>
                  <option value="">All Types</option>
                  <option value="true">Assisted</option>
                  <option value="false">Unassisted</option>
                </select>
                <input
                  type="number"
                  placeholder="Min Score"
                  value={filters.score_min}
                  onInput={(e) => this._handleFilterChange("score_min", e.target.value)}
                  min="0"
                  max="100"
                  style="max-width: 80px;"
                />
                <input
                  type="number"
                  placeholder="Max Score"
                  value={filters.score_max}
                  onInput={(e) => this._handleFilterChange("score_max", e.target.value)}
                  min="0"
                  max="100"
                  style="max-width: 80px;"
                />
                <select value={filters.sort} onChange={(e) => this._handleFilterChange("sort", e.target.value)}>
                  <option value="">Default Sort</option>
                  <option value="score">Score</option>
                  <option value="age">Age</option>
                  <option value="size">Size</option>
                  <option value="name">Name</option>
                </select>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div>
                <div class="ink-manual-results">
                  {results.map((result, idx) => {
                    const candidateId = result.id || result.candidate_id;
                    const isGrabbing = grabbing.has(candidateId);
                    return (
                      <div class="ink-manual-result" key={candidateId || idx}>
                        {/* Score */}
                        <div class="ink-manual-score">
                          <div
                            class="ink-manual-score-value"
                            style={{
                              color:
                                (result.score || 0) >= 80
                                  ? "var(--ink-success)"
                                  : (result.score || 0) >= 50
                                    ? "var(--ink-warning)"
                                    : "var(--ink-text-muted)",
                            }}
                          >
                            {result.score != null ? result.score : "—"}
                          </div>
                          <div class="ink-manual-score-label">score</div>
                        </div>

                        {/* Info */}
                        <div class="ink-manual-result-info">
                          <div class="ink-manual-result-title">
                            {result.title || result.name || result.release_name || "Unknown"}
                          </div>
                          <div class="ink-manual-result-meta">
                            {result.provider && <span class="ink-pill ink-pill-muted">{result.provider}</span>}
                            {result.protocol && <span>{result.protocol}</span>}
                            {result.language && <span>{result.language}</span>}
                            {result.format && <span>{result.format}</span>}
                            {result.size && <span>{result.size}</span>}
                            {result.age && <span>{result.age}</span>}
                            {result.pack && <span class="ink-pill ink-pill-info">Pack</span>}
                            {result.assisted && <span class="ink-pill ink-pill-gold">Assisted</span>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div class="ink-manual-result-actions">
                          <button
                            class="ink-btn-primary ink-btn-sm"
                            onClick={() => this._handleGrab(candidateId)}
                            disabled={isGrabbing || result.decision === "approved"}
                          >
                            {isGrabbing ? <span class="ink-spinner" /> : null}
                            {result.decision === "approved" ? "Grabbed" : "Grab"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div class="ink-manual-pagination">
                    <button
                      class="ink-btn-ghost ink-btn-sm"
                      disabled={offset <= 0}
                      onClick={() => this._handlePageChange(offset - PAGE_SIZE)}
                    >
                      ← Previous
                    </button>
                    <span>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      class="ink-btn-ghost ink-btn-sm"
                      disabled={offset + PAGE_SIZE >= totalResults}
                      onClick={() => this._handlePageChange(offset + PAGE_SIZE)}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* No results (search completed but empty) */}
            {!loading && !error && runStatus && !isSearching && results.length === 0 && (
              <div class="ink-manual-empty">
                <div class="ink-manual-empty-icon">🔍</div>
                <div class="ink-empty-title">No results found</div>
                <p>The search completed but no candidates were found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export { ManualSearchOverlay };
export default ManualSearchOverlay;
