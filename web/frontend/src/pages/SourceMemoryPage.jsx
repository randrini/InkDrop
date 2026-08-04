/**
 * InkDrop — SourceMemoryPage (Blocklist)
 * Shows blocked/remembered source attempts with allow/clear actions.
 */

import { h, Component } from "preact";
import api from "../api/client.jsx";
import { toast } from "../main.jsx";
import { appStore } from "../stores/app-store.jsx";
import { router } from "../router.jsx";

const styles = `
.ink-source-memory-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ink-space-md);
  margin-bottom: var(--ink-space-lg);
  flex-wrap: wrap;
}

.ink-source-memory-toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
  font-size: var(--ink-text-sm);
  color: var(--ink-text-secondary);
}

.ink-source-memory-toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
}

.ink-source-memory-title {
  font-size: var(--ink-text-xl);
  font-weight: 600;
  color: var(--ink-text-primary);
}

.ink-source-memory-search {
  margin-bottom: var(--ink-space-lg);
}

.ink-source-memory-search input {
  width: 100%;
  max-width: 360px;
  padding: var(--ink-space-sm) var(--ink-space-md);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-md);
  background: var(--ink-bg-surface);
  color: var(--ink-text-primary);
  font-size: var(--ink-text-sm);
  outline: none;
  transition: border-color var(--ink-transition-fast);
}

.ink-source-memory-search input:focus {
  border-color: var(--ink-accent-gold);
}

.ink-source-memory-item {
  display: flex;
  align-items: center;
  gap: var(--ink-space-md);
  padding: var(--ink-space-md) var(--ink-space-lg);
  border-bottom: 1px solid var(--ink-border-subtle);
  transition: background var(--ink-transition-fast);
}

.ink-source-memory-item:hover {
  background: var(--ink-bg-hover);
}

.ink-source-memory-item:last-child {
  border-bottom: none;
}

.ink-source-memory-series {
  flex: 2;
  min-width: 0;
}

.ink-source-memory-series-name {
  font-weight: 600;
  font-size: var(--ink-text-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  color: var(--ink-text-primary);
  transition: color var(--ink-transition-fast);
}

.ink-source-memory-series-name:hover {
  color: var(--ink-accent-gold);
}

.ink-source-memory-issue {
  flex: 1;
  min-width: 0;
  font-size: var(--ink-text-sm);
  color: var(--ink-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ink-source-memory-provider {
  flex: 1;
  min-width: 0;
  font-size: var(--ink-text-sm);
  color: var(--ink-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ink-source-memory-reason {
  flex: 1;
  min-width: 0;
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ink-source-memory-date {
  flex: 0 0 auto;
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  white-space: nowrap;
}

.ink-source-memory-actions {
  flex: 0 0 auto;
  display: flex;
  gap: var(--ink-space-xs);
}

.ink-source-memory-empty {
  text-align: center;
  padding: var(--ink-space-3xl) var(--ink-space-xl);
  color: var(--ink-text-muted);
}

.ink-source-memory-empty-icon {
  font-size: 2.5rem;
  margin-bottom: var(--ink-space-md);
  opacity: 0.4;
}

.ink-source-memory-empty-title {
  font-size: var(--ink-text-lg);
  font-weight: 600;
  color: var(--ink-text-secondary);
  margin-bottom: var(--ink-space-sm);
}

.ink-source-memory-error {
  padding: var(--ink-space-lg) var(--ink-space-xl);
  background: var(--ink-danger-dim);
  border: 1px solid rgba(244, 67, 54, 0.25);
  border-radius: var(--ink-radius-lg);
  color: var(--ink-danger);
  font-size: var(--ink-text-sm);
  margin-bottom: var(--ink-space-lg);
}

@media (max-width: 768px) {
  .ink-source-memory-item {
    flex-wrap: wrap;
  }
  .ink-source-memory-series,
  .ink-source-memory-issue,
  .ink-source-memory-provider,
  .ink-source-memory-reason {
    flex: 1 1 100%;
  }
}
`;

class SourceMemoryPage extends Component {
  constructor() {
    super();
    this.state = {
      loading: true,
      error: null,
      rows: [],
      totalCount: 0,
      searchQuery: "",
      actionLoading: null,
    };
    this._mounted = false;
    this._refresh = this._refresh.bind(this);
    this._handleAllow = this._handleAllow.bind(this);
    this._handleClear = this._handleClear.bind(this);
    this._handleSearch = this._handleSearch.bind(this);
    this._navigateToSeries = this._navigateToSeries.bind(this);
  }

  componentDidMount() {
    this._mounted = true;
    this._refresh();
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  async _refresh() {
    this.setState({ loading: true, error: null });
    try {
      const data = await api.state.view("source_memory", {
        summary_mode: "compact",
        row_mode: "compact_card",
      });
      if (!this._mounted) return;
      if (data.ok) {
        this.setState({
          rows: data.rows || [],
          totalCount: data.total_count || 0,
          loading: false,
        });
      } else {
        this.setState({ error: data.error || "Failed to load blocklist", loading: false });
      }
    } catch (err) {
      if (!this._mounted) return;
      this.setState({ error: err.message || "Failed to load blocklist", loading: false });
    }
  }

  async _handleAllow(row) {
    const key = `${row.series_id}-${row.issue_id || ""}-${row.provider || ""}`;
    this.setState({ actionLoading: key });
    try {
      const body = {
        series_id: row.series_id,
        provider: row.provider,
      };
      if (row.issue_id) body.issue_id = row.issue_id;
      if (row.edition_id) body.edition_id = row.edition_id;
      if (row.unit_id) body.unit_id = row.unit_id;
      if (row.reason) body.reason = row.reason;

      const res = await api.state.sourceMemoryAllow(body);
      if (!this._mounted) return;
      if (res.ok) {
        toast("Source allowed", "success");
        this._refresh();
      } else {
        toast(res.error || "Failed to allow source", "error");
      }
    } catch (err) {
      if (!this._mounted) return;
      toast(err.message || "Failed to allow source", "error");
    } finally {
      if (this._mounted) this.setState({ actionLoading: null });
    }
  }

  async _handleClear(row) {
    const key = `${row.series_id}-clear`;
    this.setState({ actionLoading: key });
    try {
      const res = await api.state.sourceAttemptsClear({ series_id: row.series_id });
      if (!this._mounted) return;
      if (res.ok) {
        toast("Source attempts cleared", "success");
        this._refresh();
      } else {
        toast(res.error || "Failed to clear source attempts", "error");
      }
    } catch (err) {
      if (!this._mounted) return;
      toast(err.message || "Failed to clear source attempts", "error");
    } finally {
      if (this._mounted) this.setState({ actionLoading: null });
    }
  }

  _handleSearch(e) {
    this.setState({ searchQuery: e.target.value });
  }

  _navigateToSeries(seriesId) {
    router.navigate("series", { id: seriesId });
  }

  _formatDate(dateStr) {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  }

  _getFilteredRows() {
    const { rows, searchQuery } = this.state;
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((row) => {
      return (
        (row.series_name && row.series_name.toLowerCase().includes(q)) ||
        (row.source_name && row.source_name.toLowerCase().includes(q)) ||
        (row.provider && row.provider.toLowerCase().includes(q)) ||
        (row.reason && row.reason.toLowerCase().includes(q)) ||
        (row.issue_number && String(row.issue_number).toLowerCase().includes(q))
      );
    });
  }

  render() {
    const { loading, error, rows, totalCount, searchQuery, actionLoading } = this.state;
    const filteredRows = this._getFilteredRows();

    return (
      <div class="ink-page">
        <style>{styles}</style>

        {/* Toolbar */}
        <div class="ink-source-memory-toolbar">
          <div class="ink-source-memory-toolbar-left">
            <span class="ink-source-memory-title">Blocklist</span>
            {totalCount > 0 && <span class="ink-pill ink-pill-warning">{totalCount}</span>}
          </div>
          <div class="ink-source-memory-toolbar-right">
            <button class="ink-btn-ghost ink-btn-sm" onClick={this._refresh} disabled={loading}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Search */}
        <div class="ink-source-memory-search">
          <input
            type="text"
            placeholder="Filter by series, source, provider, or reason…"
            value={searchQuery}
            onInput={this._handleSearch}
          />
        </div>

        {/* Error state */}
        {error && !loading && (
          <div class="ink-source-memory-error">
            {error}
            <button class="ink-btn-ghost ink-btn-sm" style="margin-left: var(--ink-space-md);" onClick={this._refresh}>
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div class="ink-loading">
            <div class="ink-spinner" />
            <span style="margin-left: var(--ink-space-sm);">Loading blocklist…</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && rows.length === 0 && (
          <div class="ink-source-memory-empty">
            <div class="ink-source-memory-empty-icon">🛡️</div>
            <div class="ink-source-memory-empty-title">Blocklist is Empty</div>
            <p>No blocked sources. All source attempts are being processed normally.</p>
          </div>
        )}

        {/* Filtered empty state */}
        {!loading && !error && rows.length > 0 && filteredRows.length === 0 && (
          <div class="ink-source-memory-empty">
            <div class="ink-source-memory-empty-title">No matches</div>
            <p>No blocked sources match your search filter.</p>
          </div>
        )}

        {/* Rows list */}
        {!loading && filteredRows.length > 0 && (
          <div class="ink-section">
            {filteredRows.map((row, idx) => {
              const actionKey = `${row.series_id}-${row.issue_id || ""}-${row.provider || ""}`;
              const clearKey = `${row.series_id}-clear`;
              const isAllowing = actionLoading === actionKey;
              const isClearing = actionLoading === clearKey;

              return (
                <div class="ink-source-memory-item" key={row.id || row._id || idx}>
                  <div class="ink-source-memory-series">
                    <div
                      class="ink-source-memory-series-name"
                      onClick={() => this._navigateToSeries(row.series_id)}
                      title={row.series_name || "Unknown Series"}
                    >
                      {row.series_name || "Unknown Series"}
                    </div>
                  </div>

                  <div class="ink-source-memory-issue">
                    {row.issue_number ? `#${row.issue_number}` : "—"}
                    {row.issue_name ? ` — ${row.issue_name}` : ""}
                  </div>

                  <div class="ink-source-memory-provider">{row.source_name || row.provider || "—"}</div>

                  <div class="ink-source-memory-reason">
                    {row.reason ? <span class="ink-pill ink-pill-muted">{row.reason}</span> : "—"}
                  </div>

                  <div class="ink-source-memory-date">{this._formatDate(row.created_at)}</div>

                  <div class="ink-source-memory-actions">
                    <button
                      class="ink-btn-primary ink-btn-sm"
                      onClick={() => this._handleAllow(row)}
                      disabled={!!actionLoading}
                    >
                      {isAllowing ? <span class="ink-spinner" /> : null}
                      {isAllowing ? "…" : "Allow"}
                    </button>
                    <button
                      class="ink-btn-danger ink-btn-sm"
                      onClick={() => this._handleClear(row)}
                      disabled={!!actionLoading}
                    >
                      {isClearing ? <span class="ink-spinner" /> : null}
                      {isClearing ? "…" : "Clear"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
}

export { SourceMemoryPage };
export default SourceMemoryPage;
