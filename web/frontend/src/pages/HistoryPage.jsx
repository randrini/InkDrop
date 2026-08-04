/**
 * InkDrop — History Page
 * Past transfers, imports, and acquisitions with filters and pagination.
 */

import { h, Component } from 'preact';
import api from '../api/client.jsx';
import { toast } from '../main.jsx';

const styles = `
.ink-history-page { padding-bottom: var(--ink-space-2xl); }

/* ── Toolbar ──────────────────────────────────── */
.ink-history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ink-space-md);
  margin-bottom: var(--ink-space-lg);
  flex-wrap: wrap;
}

.ink-history-toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
  color: var(--ink-text-secondary);
  font-size: var(--ink-text-sm);
}

.ink-history-toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
}

/* ── Filters ──────────────────────────────────── */
.ink-history-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ink-space-sm);
  margin-bottom: var(--ink-space-lg);
}

.ink-history-filter-btn {
  padding: var(--ink-space-xs) var(--ink-space-md);
  font-size: var(--ink-text-xs);
  font-weight: 500;
  border-radius: var(--ink-radius-full);
  border: 1px solid var(--ink-border-subtle);
  background: transparent;
  color: var(--ink-text-secondary);
  cursor: pointer;
  transition: all var(--ink-transition-fast);
  min-height: 28px;
}
.ink-history-filter-btn:hover {
  border-color: var(--ink-border-default);
  color: var(--ink-text-primary);
}
.ink-history-filter-btn.ink-history-filter-active {
  background: var(--ink-accent-gold-dim);
  border-color: var(--ink-accent-gold);
  color: var(--ink-accent-gold);
}

/* ── Table ────────────────────────────────────── */
.ink-history-table-wrap {
  overflow-x: auto;
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
}

.ink-history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--ink-text-sm);
}

.ink-history-table th {
  text-align: left;
  padding: var(--ink-space-sm) var(--ink-space-md);
  color: var(--ink-text-muted);
  font-weight: 500;
  border-bottom: 1px solid var(--ink-border-subtle);
  white-space: nowrap;
  font-size: var(--ink-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ink-history-table td {
  padding: var(--ink-space-sm) var(--ink-space-md);
  border-bottom: 1px solid var(--ink-border-subtle);
  vertical-align: middle;
}

.ink-history-table tbody tr {
  transition: background var(--ink-transition-fast);
}
.ink-history-table tbody tr:hover { background: var(--ink-bg-hover); }
.ink-history-table tbody tr:last-child td { border-bottom: none; }

.ink-history-series {
  font-weight: 500;
  color: var(--ink-text-primary);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ink-history-issue {
  color: var(--ink-text-secondary);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ink-history-source {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
}

.ink-history-date {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ── Status Pill ──────────────────────────────── */
.ink-history-status {
  display: inline-flex;
  align-items: center;
  gap: var(--ink-space-xs);
  padding: 2px var(--ink-space-sm);
  font-size: var(--ink-text-xs);
  font-weight: 500;
  border-radius: var(--ink-radius-full);
  white-space: nowrap;
}
.ink-history-status-success { background: var(--ink-success-dim); color: var(--ink-success); }
.ink-history-status-error { background: var(--ink-danger-dim); color: var(--ink-danger); }
.ink-history-status-warning { background: var(--ink-warning-dim); color: var(--ink-warning); }
.ink-history-status-info { background: var(--ink-info-dim); color: var(--ink-info); }
.ink-history-status-muted { background: rgba(255,255,255,0.05); color: var(--ink-text-muted); }

/* ── Pagination ───────────────────────────────── */
.ink-history-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ink-space-sm);
  margin-top: var(--ink-space-lg);
  padding: var(--ink-space-md);
}

.ink-history-page-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 var(--ink-space-sm);
  font-size: var(--ink-text-sm);
  border: 1px solid var(--ink-border-subtle);
  background: transparent;
  color: var(--ink-text-secondary);
  border-radius: var(--ink-radius-md);
  cursor: pointer;
  transition: all var(--ink-transition-fast);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ink-history-page-btn:hover {
  border-color: var(--ink-border-default);
  color: var(--ink-text-primary);
}
.ink-history-page-btn.ink-history-page-active {
  background: var(--ink-accent-gold-dim);
  border-color: var(--ink-accent-gold);
  color: var(--ink-accent-gold);
}
.ink-history-page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ink-history-page-info {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  margin: 0 var(--ink-space-sm);
}

/* ── Empty State ──────────────────────────────── */
.ink-history-empty {
  text-align: center;
  padding: var(--ink-space-3xl) var(--ink-space-xl);
  color: var(--ink-text-muted);
}

.ink-history-empty-icon {
  font-size: 2.5rem;
  margin-bottom: var(--ink-space-md);
  opacity: 0.4;
}

.ink-history-empty-title {
  font-size: var(--ink-text-lg);
  font-weight: 600;
  color: var(--ink-text-secondary);
  margin-bottom: var(--ink-space-sm);
}

/* ── Error ─────────────────────────────────────── */
.ink-history-error {
  padding: var(--ink-space-lg) var(--ink-space-xl);
  background: var(--ink-danger-dim);
  border: 1px solid rgba(244, 67, 54, 0.25);
  border-radius: var(--ink-radius-lg);
  color: var(--ink-danger);
  font-size: var(--ink-text-sm);
  margin-bottom: var(--ink-space-lg);
}

/* ── Responsive ────────────────────────────────── */
@media (max-width: 768px) {
  .ink-history-table th:nth-child(4),
  .ink-history-table td:nth-child(4) { display: none; }
}
`;

const PAGE_SIZE = 50;

class HistoryPage extends Component {
  constructor() {
    super();
    this.state = {
      loading: true,
      error: null,
      rows: [],
      totalCount: 0,
      hasMore: false,
      filters: [],
      activeFilter: null,
      page: 0,
      sort: null,
      direction: null,
    };
    this._load = this._load.bind(this);
    this._setFilter = this._setFilter.bind(this);
    this._goToPage = this._goToPage.bind(this);
    this._toggleSort = this._toggleSort.bind(this);
  }

  componentDidMount() {
    this._load();
  }

  componentWillUnmount() {
    // cleanup if needed
  }

  async _load() {
    try {
      const params = { summary_mode: 'compact', limit: PAGE_SIZE, offset: this.state.page * PAGE_SIZE };
      if (this.state.activeFilter) {
        params.filter = this.state.activeFilter;
      }
      if (this.state.sort) {
        params.sort = this.state.sort;
        params.direction = this.state.direction || 'asc';
      }

      const res = await api.state.view('history', params);
      if (res.ok) {
        this.setState({
          loading: false,
          error: null,
          rows: res.rows || [],
          totalCount: res.total_count || 0,
          hasMore: !!res.has_more,
          filters: res.filters || [],
        });
      } else {
        this.setState({
          loading: false,
          error: res.error || 'Failed to load history',
        });
      }
    } catch (err) {
      this.setState({
        loading: false,
        error: err.message || 'Failed to load history data',
      });
    }
  }

  _setFilter(filter) {
    this.setState(
      prev => ({ activeFilter: prev.activeFilter === filter ? null : filter, page: 0, loading: true }),
      this._load
    );
  }

  _goToPage(page) {
    this.setState({ page, loading: true }, this._load);
  }

  _toggleSort(column) {
    this.setState(
      prev => {
        const direction = prev.sort === column && prev.direction === 'asc' ? 'desc' : 'asc';
        return { sort: column, direction, page: 0, loading: true };
      },
      this._load
    );
  }

  _statusClass(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('success') || s.includes('complete') || s.includes('imported') || s.includes('downloaded')) {
      return 'ink-history-status-success';
    }
    if (s.includes('error') || s.includes('fail')) return 'ink-history-status-error';
    if (s.includes('warn')) return 'ink-history-status-warning';
    if (s.includes('info') || s.includes('skip')) return 'ink-history-status-info';
    return 'ink-history-status-muted';
  }

  _formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const now = new Date();
      const diffMs = now - d;
      const diffMin = Math.floor(diffMs / 60000);
      const diffHr = Math.floor(diffMs / 3600000);
      const diffDay = Math.floor(diffMs / 86400000);

      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      if (diffDay < 7) return `${diffDay}d ago`;

      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return dateStr;
    }
  }

  _renderFilters() {
    const { filters, activeFilter } = this.state;
    if (!filters || filters.length === 0) return null;

    return (
      <div class="ink-history-filters">
        {filters.map(f => {
          const key = f.key || f.id || f;
          const label = f.label || (typeof f === 'string' ? f : key);
          return (
            <button
              key={key}
              class={`ink-history-filter-btn${activeFilter === key ? ' ink-history-filter-active' : ''}`}
              onClick={() => this._setFilter(key)}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  _renderPagination() {
    const { totalCount, page, loading } = this.state;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisible = 7;
    let start = Math.max(0, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible);
    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }

    for (let i = start; i < end; i++) {
      pages.push(i);
    }

    return (
      <div class="ink-history-pagination">
        <button
          class="ink-history-page-btn"
          disabled={page === 0 || loading}
          onClick={() => this._goToPage(0)}
          title="First page"
        >
          «
        </button>
        <button
          class="ink-history-page-btn"
          disabled={page === 0 || loading}
          onClick={() => this._goToPage(page - 1)}
          title="Previous page"
        >
          ‹
        </button>

        {start > 0 && (
          <span class="ink-history-page-info">…</span>
        )}

        {pages.map(p => (
          <button
            key={p}
            class={`ink-history-page-btn${p === page ? ' ink-history-page-active' : ''}`}
            onClick={() => this._goToPage(p)}
            disabled={loading}
          >
            {p + 1}
          </button>
        ))}

        {end < totalPages && (
          <span class="ink-history-page-info">…</span>
        )}

        <button
          class="ink-history-page-btn"
          disabled={page >= totalPages - 1 || loading}
          onClick={() => this._goToPage(page + 1)}
          title="Next page"
        >
          ›
        </button>
        <button
          class="ink-history-page-btn"
          disabled={page >= totalPages - 1 || loading}
          onClick={() => this._goToPage(totalPages - 1)}
          title="Last page"
        >
          »
        </button>

        <span class="ink-history-page-info">
          Page {page + 1} of {totalPages}
        </span>
      </div>
    );
  }

  _renderSortIndicator(column) {
    const { sort, direction } = this.state;
    if (sort !== column) return null;
    return <span style="margin-left: 4px; font-size: 10px;">{direction === 'asc' ? '▲' : '▼'}</span>;
  }

  render() {
    const { loading, error, rows, totalCount } = this.state;

    return (
      <div class="ink-page ink-history-page">
        <style>{styles}</style>

        {error && (
          <div class="ink-history-error">
            {error}
          </div>
        )}

        {loading ? (
          <div class="ink-loading">
            <div class="ink-spinner" />
          </div>
        ) : (
          <div>
            <div class="ink-history-toolbar">
              <div class="ink-history-toolbar-left">
                <span>{totalCount} item{totalCount !== 1 ? 's' : ''} total</span>
              </div>
              <div class="ink-history-toolbar-right">
                <button class="ink-btn-ghost ink-btn-sm" onClick={this._load}>
                  ↻ Refresh
                </button>
              </div>
            </div>

            {this._renderFilters()}

            {rows.length === 0 ? (
              <div class="ink-history-empty">
                <div class="ink-history-empty-icon">🕐</div>
                <div class="ink-history-empty-title">No History</div>
                <p>No completed transfers or imports have been recorded yet.</p>
              </div>
            ) : (
              <div>
                <div class="ink-history-table-wrap">
                  <table class="ink-history-table">
                    <thead>
                      <tr>
                        <th onClick={() => this._toggleSort('series')} style="cursor: pointer;">
                          Series{this._renderSortIndicator('series')}
                        </th>
                        <th onClick={() => this._toggleSort('issue')} style="cursor: pointer;">
                          Issue{this._renderSortIndicator('issue')}
                        </th>
                        <th>Status</th>
                        <th>Source</th>
                        <th onClick={() => this._toggleSort('date')} style="cursor: pointer;">
                          Date{this._renderSortIndicator('date')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(item => (
                        <tr key={item.id || item._id}>
                          <td>
                            <span class="ink-history-series" title={item.series_name || item.series}>
                              {item.series_name || item.series || '—'}
                            </span>
                          </td>
                          <td>
                            <span class="ink-history-issue" title={item.issue || item.title}>
                              {item.issue || item.title || '—'}
                            </span>
                          </td>
                          <td>
                            <span class={`ink-history-status ${this._statusClass(item.status)}`}>
                              {item.status || '—'}
                            </span>
                          </td>
                          <td>
                            <span class="ink-history-source">
                              {item.source || item.source_name || '—'}
                            </span>
                          </td>
                          <td>
                            <span class="ink-history-date">
                              {this._formatDate(item.date || item.timestamp || item.completed_at)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {this._renderPagination()}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}

export { HistoryPage };
