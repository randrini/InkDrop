/**
 * InkDrop — WantedPage
 * Shows missing issues with series name, issue, source, status.
 * Supports "Run" to trigger wanted search and Missing Recovery section.
 */

import { h, Component } from "preact";
import api from "../api/client.jsx";
import { toast } from "../main.jsx";

const styles = `
.ink-wanted-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ink-space-sm);
  margin-bottom: var(--ink-space-lg);
}
.ink-wanted-filters select,
.ink-wanted-filters input {
  min-width: 140px;
  flex: 0 1 auto;
}
.ink-wanted-actions {
  display: flex;
  gap: var(--ink-space-sm);
  align-items: center;
  flex-wrap: wrap;
}
.ink-wanted-count {
  font-size: var(--ink-text-sm);
  color: var(--ink-text-muted);
  margin-bottom: var(--ink-space-md);
}
.ink-wanted-item {
  display: flex;
  align-items: center;
  gap: var(--ink-space-md);
  padding: var(--ink-space-md) var(--ink-space-lg);
  border-bottom: 1px solid var(--ink-border-subtle);
  transition: background var(--ink-transition-fast);
}
.ink-wanted-item:hover {
  background: var(--ink-bg-hover);
}
.ink-wanted-item:last-child {
  border-bottom: none;
}
.ink-wanted-series {
  flex: 2;
  min-width: 0;
}
.ink-wanted-series-name {
  font-weight: 600;
  font-size: var(--ink-text-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ink-wanted-issue {
  flex: 1;
  min-width: 0;
  font-size: var(--ink-text-sm);
  color: var(--ink-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ink-wanted-source {
  flex: 1;
  min-width: 0;
  font-size: var(--ink-text-sm);
  color: var(--ink-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ink-wanted-status {
  flex: 0 0 auto;
}
.ink-wanted-cover {
  width: 40px;
  height: 56px;
  border-radius: var(--ink-radius-sm);
  object-fit: cover;
  background: var(--ink-bg-elevated);
  flex-shrink: 0;
}
.ink-wanted-recovery {
  margin-top: var(--ink-space-xl);
}
.ink-wanted-recovery-stats {
  display: flex;
  gap: var(--ink-space-xl);
  flex-wrap: wrap;
  margin-top: var(--ink-space-md);
}
.ink-wanted-recovery-stat {
  text-align: center;
}
.ink-wanted-recovery-stat-value {
  font-size: var(--ink-text-2xl);
  font-weight: 600;
  color: var(--ink-text-primary);
  font-family: var(--ink-font-display);
}
.ink-wanted-recovery-stat-label {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: var(--ink-space-xs);
}
.ink-wanted-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ink-space-lg);
  flex-wrap: wrap;
}
@media (max-width: 768px) {
  .ink-wanted-item {
    flex-wrap: wrap;
  }
  .ink-wanted-series,
  .ink-wanted-issue,
  .ink-wanted-source {
    flex: 1 1 100%;
  }
  .ink-wanted-filters select,
  .ink-wanted-filters input {
    min-width: 100px;
    flex: 1 1 auto;
  }
}
`;

class WantedPage extends Component {
  constructor() {
    super();
    this.state = {
      loading: true,
      error: null,
      items: [],
      filters: {},
      filterValues: {},
      totalCount: 0,
      recoveryStatus: null,
      recoveryLoading: false,
      running: false,
    };
    this._loadData = this._loadData.bind(this);
    this._loadRecovery = this._loadRecovery.bind(this);
    this._handleRun = this._handleRun.bind(this);
    this._handleRecoveryAction = this._handleRecoveryAction.bind(this);
    this._handleFilterChange = this._handleFilterChange.bind(this);
  }

  componentDidMount() {
    this._loadData();
    this._loadRecovery();
  }

  async _loadData() {
    this.setState({ loading: true, error: null });
    try {
      const data = await api.state.view("wanted", {
        summary_mode: "compact",
        row_mode: "compact_card",
      });
      if (data.ok) {
        const stateData = data.state || data;
        this.setState({
          items: stateData.items || stateData.rows || [],
          filters: stateData.filters || {},
          filterValues: stateData.filter_values || {},
          totalCount: stateData.total_count || stateData.total || 0,
          loading: false,
        });
      } else {
        this.setState({ error: data.error || "Failed to load wanted items", loading: false });
      }
    } catch (err) {
      this.setState({ error: err.message || "Failed to load wanted items", loading: false });
    }
  }

  async _loadRecovery() {
    try {
      const data = await api.missingRecovery.status();
      if (data.ok) {
        this.setState({ recoveryStatus: data.state || data });
      }
    } catch {
      // recovery status is optional
    }
  }

  async _handleRun() {
    this.setState({ running: true });
    try {
      const data = await api.state.wantedRun({});
      if (data.ok) {
        toast("Wanted search started", "success");
      } else {
        toast(data.error || "Failed to start wanted search", "error");
      }
    } catch (err) {
      toast(err.message || "Failed to start wanted search", "error");
    } finally {
      this.setState({ running: false });
    }
  }

  async _handleRecoveryAction(action) {
    this.setState({ recoveryLoading: true });
    try {
      const data = await api.missingRecovery.run({ missingRecoveryAction: action });
      if (data.ok) {
        toast(`Missing recovery ${action === "start" ? "started" : "paused"}`, "success");
        this._loadRecovery();
      } else {
        toast(data.error || `Failed to ${action} recovery`, "error");
      }
    } catch (err) {
      toast(err.message || `Failed to ${action} recovery`, "error");
    } finally {
      this.setState({ recoveryLoading: false });
    }
  }

  _handleFilterChange(key, value) {
    const filterValues = { ...this.state.filterValues, [key]: value };
    this.setState({ filterValues });
    // Reload with filters
    this._loadWithFilters(filterValues);
  }

  async _loadWithFilters(filterValues) {
    this.setState({ loading: true });
    try {
      const params = {
        summary_mode: "compact",
        row_mode: "compact_card",
        ...filterValues,
      };
      const data = await api.state.view("wanted", params);
      if (data.ok) {
        const stateData = data.state || data;
        this.setState({
          items: stateData.items || stateData.rows || [],
          totalCount: stateData.total_count || stateData.total || 0,
          loading: false,
        });
      } else {
        this.setState({ error: data.error || "Failed to load wanted items", loading: false });
      }
    } catch (err) {
      this.setState({ error: err.message || "Failed to load wanted items", loading: false });
    }
  }

  _renderStatusPill(status) {
    if (!status) return null;
    const statusLower = String(status).toLowerCase();
    let cls = "ink-pill-muted";
    if (statusLower === "missing" || statusLower === "wanted") cls = "ink-pill-warning";
    else if (statusLower === "found" || statusLower === "snatched") cls = "ink-pill-info";
    else if (statusLower === "downloaded" || statusLower === "imported") cls = "ink-pill-success";
    else if (statusLower === "failed") cls = "ink-pill-danger";
    return <span class={`ink-pill ${cls}`}>{status}</span>;
  }

  render() {
    const { loading, error, items, filters, filterValues, totalCount, recoveryStatus, recoveryLoading, running } =
      this.state;

    return (
      <div class="ink-page">
        <style>{styles}</style>

        {/* Filters */}
        {filters && Object.keys(filters).length > 0 && (
          <div class="ink-wanted-filters">
            {Object.entries(filters).map(([key, config]) => {
              if (config.type === "select" && config.options) {
                return (
                  <select
                    key={key}
                    value={filterValues[key] || ""}
                    onChange={(e) => this._handleFilterChange(key, e.target.value)}
                  >
                    <option value="">{config.label || key}</option>
                    {config.options.map((opt) => (
                      <option key={opt.value || opt} value={opt.value || opt}>
                        {opt.label || opt}
                      </option>
                    ))}
                  </select>
                );
              }
              if (config.type === "text" || config.type === "search") {
                return (
                  <input
                    key={key}
                    type="text"
                    placeholder={config.label || key}
                    value={filterValues[key] || ""}
                    onInput={(e) => this._handleFilterChange(key, e.target.value)}
                  />
                );
              }
              return null;
            })}
          </div>
        )}

        {/* Header with actions */}
        <div class="ink-wanted-header">
          <div class="ink-wanted-count">
            {totalCount > 0 ? `${totalCount} wanted item${totalCount !== 1 ? "s" : ""}` : "No wanted items"}
          </div>
          <div class="ink-wanted-actions">
            <button class="ink-btn-primary" onClick={this._handleRun} disabled={running}>
              {running ? <span class="ink-spinner" /> : null}
              {running ? "Running..." : "Run"}
            </button>
            <button class="ink-btn-ghost" onClick={this._loadData}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div class="ink-loading">
            <div class="ink-spinner" />
            <span style="margin-left: var(--ink-space-sm);">Loading wanted items...</span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div class="ink-section">
            <div class="ink-section-body" style="text-align: center; color: var(--ink-text-danger);">
              <p>{error}</p>
              <button class="ink-btn-ghost" style="margin-top: var(--ink-space-md);" onClick={this._loadData}>
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Items list */}
        {!loading && !error && items.length === 0 && (
          <div class="ink-empty">
            <div class="ink-empty-icon">🎯</div>
            <div class="ink-empty-title">All caught up!</div>
            <p>No missing issues. Everything is accounted for.</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div class="ink-section">
            {items.map((item, idx) => (
              <div class="ink-wanted-item" key={item.id || item.issue_id || idx}>
                {item.cover_url && (
                  <img class="ink-wanted-cover" src={api.cover.url(item.cover_url)} alt="" loading="lazy" />
                )}
                <div class="ink-wanted-series">
                  <div class="ink-wanted-series-name">{item.series_name || item.series || item.title || "Unknown"}</div>
                  {item.series_year && <div class="ink-mini">{item.series_year}</div>}
                </div>
                <div class="ink-wanted-issue">
                  {item.issue_number || item.issue || item.number || ""}
                  {item.issue_name ? ` — ${item.issue_name}` : ""}
                </div>
                <div class="ink-wanted-source">{item.source || item.source_name || ""}</div>
                <div class="ink-wanted-status">{this._renderStatusPill(item.status || item.issue_status)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Missing Recovery Section */}
        <div class="ink-wanted-recovery">
          <div class="ink-section">
            <div class="ink-section-head">
              <h3>Missing Recovery</h3>
              <div class="ink-wanted-actions">
                {recoveryStatus && (
                  <button
                    class={recoveryStatus.running ? "ink-btn-ghost" : "ink-btn-primary"}
                    onClick={() => this._handleRecoveryAction(recoveryStatus.running ? "pause" : "start")}
                    disabled={recoveryLoading}
                  >
                    {recoveryLoading ? <span class="ink-spinner" /> : null}
                    {recoveryStatus.running ? "Pause" : "Start"}
                  </button>
                )}
                <button class="ink-btn-ghost" onClick={this._loadRecovery}>
                  ↻
                </button>
              </div>
            </div>
            <div class="ink-section-body">
              {!recoveryStatus && (
                <div class="ink-loading">
                  <div class="ink-spinner" />
                </div>
              )}
              {recoveryStatus && (
                <div>
                  {recoveryStatus.running && (
                    <div class="ink-progress ink-progress-indeterminate" style="margin-bottom: var(--ink-space-md);">
                      <div class="ink-progress-bar" />
                    </div>
                  )}
                  <div class="ink-wanted-recovery-stats">
                    {recoveryStatus.total != null && (
                      <div class="ink-wanted-recovery-stat">
                        <div class="ink-wanted-recovery-stat-value">{recoveryStatus.total}</div>
                        <div class="ink-wanted-recovery-stat-label">Total</div>
                      </div>
                    )}
                    {recoveryStatus.processed != null && (
                      <div class="ink-wanted-recovery-stat">
                        <div class="ink-wanted-recovery-stat-value">{recoveryStatus.processed}</div>
                        <div class="ink-wanted-recovery-stat-label">Processed</div>
                      </div>
                    )}
                    {recoveryStatus.found != null && (
                      <div class="ink-wanted-recovery-stat">
                        <div class="ink-wanted-recovery-stat-value">{recoveryStatus.found}</div>
                        <div class="ink-wanted-recovery-stat-label">Found</div>
                      </div>
                    )}
                    {recoveryStatus.failed != null && (
                      <div class="ink-wanted-recovery-stat">
                        <div class="ink-wanted-recovery-stat-value">{recoveryStatus.failed}</div>
                        <div class="ink-wanted-recovery-stat-label">Failed</div>
                      </div>
                    )}
                    {recoveryStatus.remaining != null && (
                      <div class="ink-wanted-recovery-stat">
                        <div class="ink-wanted-recovery-stat-value">{recoveryStatus.remaining}</div>
                        <div class="ink-wanted-recovery-stat-label">Remaining</div>
                      </div>
                    )}
                  </div>
                  {recoveryStatus.message && (
                    <p style="margin-top: var(--ink-space-md); font-size: var(--ink-text-sm); color: var(--ink-text-secondary);">
                      {recoveryStatus.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export { WantedPage };
export default WantedPage;
