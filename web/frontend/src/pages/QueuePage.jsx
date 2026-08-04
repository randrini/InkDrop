/**
 * InkDrop — Queue Page
 * Active download and processing queue with run controls.
 */

import { h, Component } from 'preact';
import api from '../api/client.jsx';
import { toast } from '../main.jsx';

const styles = `
.ink-queue-page { padding-bottom: var(--ink-space-2xl); }

/* ── Toolbar ──────────────────────────────────── */
.ink-queue-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ink-space-md);
  margin-bottom: var(--ink-space-lg);
  flex-wrap: wrap;
}

.ink-queue-toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
  color: var(--ink-text-secondary);
  font-size: var(--ink-text-sm);
}

.ink-queue-toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
}

/* ── Filters ──────────────────────────────────── */
.ink-queue-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ink-space-sm);
  margin-bottom: var(--ink-space-lg);
}

.ink-queue-filter-btn {
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
.ink-queue-filter-btn:hover {
  border-color: var(--ink-border-default);
  color: var(--ink-text-primary);
}
.ink-queue-filter-btn.ink-queue-filter-active {
  background: var(--ink-accent-gold-dim);
  border-color: var(--ink-accent-gold);
  color: var(--ink-accent-gold);
}

/* ── Card Grid ─────────────────────────────────── */
.ink-queue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--ink-space-lg);
}

.ink-queue-card {
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
  padding: var(--ink-space-lg);
  transition: border-color var(--ink-transition-fast), transform var(--ink-transition-fast);
}
.ink-queue-card:hover {
  border-color: var(--ink-border-default);
  transform: translateY(-1px);
}

.ink-queue-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ink-space-sm);
  margin-bottom: var(--ink-space-sm);
}

.ink-queue-card-title {
  font-weight: 600;
  font-size: var(--ink-text-base);
  color: var(--ink-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.ink-queue-card-issue {
  font-size: var(--ink-text-sm);
  color: var(--ink-text-secondary);
  margin-bottom: var(--ink-space-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ink-queue-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ink-space-xs);
  margin-bottom: var(--ink-space-sm);
}

.ink-queue-card-source {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  margin-bottom: var(--ink-space-sm);
}

.ink-queue-card-progress {
  margin-top: var(--ink-space-sm);
}

.ink-queue-card-progress-label {
  display: flex;
  justify-content: space-between;
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  margin-bottom: 2px;
}

/* ── Status Pill ──────────────────────────────── */
.ink-queue-status {
  display: inline-flex;
  align-items: center;
  gap: var(--ink-space-xs);
  padding: 2px var(--ink-space-sm);
  font-size: var(--ink-text-xs);
  font-weight: 500;
  border-radius: var(--ink-radius-full);
  white-space: nowrap;
  flex-shrink: 0;
}
.ink-queue-status-queued { background: rgba(255,255,255,0.05); color: var(--ink-text-muted); }
.ink-queue-status-running { background: var(--ink-info-dim); color: var(--ink-info); }
.ink-queue-status-complete { background: var(--ink-success-dim); color: var(--ink-success); }
.ink-queue-status-error { background: var(--ink-danger-dim); color: var(--ink-danger); }
.ink-queue-status-warning { background: var(--ink-warning-dim); color: var(--ink-warning); }

/* ── Empty State ──────────────────────────────── */
.ink-queue-empty {
  text-align: center;
  padding: var(--ink-space-3xl) var(--ink-space-xl);
  color: var(--ink-text-muted);
}

.ink-queue-empty-icon {
  font-size: 2.5rem;
  margin-bottom: var(--ink-space-md);
  opacity: 0.4;
}

.ink-queue-empty-title {
  font-size: var(--ink-text-lg);
  font-weight: 600;
  color: var(--ink-text-secondary);
  margin-bottom: var(--ink-space-sm);
}

/* ── Error ─────────────────────────────────────── */
.ink-queue-error {
  padding: var(--ink-space-lg) var(--ink-space-xl);
  background: var(--ink-danger-dim);
  border: 1px solid rgba(244, 67, 54, 0.25);
  border-radius: var(--ink-radius-lg);
  color: var(--ink-danger);
  font-size: var(--ink-text-sm);
  margin-bottom: var(--ink-space-lg);
}

/* ── Run Button ───────────────────────────────── */
.ink-queue-run-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--ink-space-xs);
}

.ink-queue-run-btn.ink-queue-running {
  opacity: 0.7;
  pointer-events: none;
}

/* ── Responsive ────────────────────────────────── */
@media (max-width: 768px) {
  .ink-queue-grid { grid-template-columns: 1fr; }
}
`;

class QueuePage extends Component {
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
      runLoading: false,
    };
    this._load = this._load.bind(this);
    this._handleRun = this._handleRun.bind(this);
    this._setFilter = this._setFilter.bind(this);
  }

  componentDidMount() {
    this._load();
  }

  componentWillUnmount() {
    // cleanup if needed
  }

  async _load() {
    try {
      const params = { summary_mode: 'compact', row_mode: 'compact_card' };
      if (this.state.activeFilter) {
        params.filter = this.state.activeFilter;
      }

      const res = await api.state.view('queue', params);
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
          error: res.error || 'Failed to load queue',
        });
      }
    } catch (err) {
      this.setState({
        loading: false,
        error: err.message || 'Failed to load queue data',
      });
    }
  }

  async _handleRun() {
    this.setState({ runLoading: true });
    try {
      const res = await api.state.queueRun({});
      if (res.ok) {
        toast('Queue run started', 'success');
        // Refresh after a short delay to pick up new state
        setTimeout(() => this._load(), 1000);
      } else {
        toast(res.error || 'Failed to start queue run', 'error');
      }
    } catch (err) {
      toast(err.message || 'Failed to start queue run', 'error');
    } finally {
      this.setState({ runLoading: false });
    }
  }

  _setFilter(filter) {
    this.setState(
      prev => ({ activeFilter: prev.activeFilter === filter ? null : filter, loading: true }),
      this._load
    );
  }

  _statusClass(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('queue') || s.includes('wait')) return 'ink-queue-status-queued';
    if (s.includes('run') || s.includes('active') || s.includes('progress')) return 'ink-queue-status-running';
    if (s.includes('complete') || s.includes('done') || s.includes('success')) return 'ink-queue-status-complete';
    if (s.includes('error') || s.includes('fail')) return 'ink-queue-status-error';
    if (s.includes('warn')) return 'ink-queue-status-warning';
    return 'ink-queue-status-queued';
  }

  _renderFilters() {
    const { filters, activeFilter } = this.state;
    if (!filters || filters.length === 0) return null;

    return (
      <div class="ink-queue-filters">
        {filters.map(f => {
          const key = f.key || f.id || f;
          const label = f.label || (typeof f === 'string' ? f : key);
          return (
            <button
              key={key}
              class={`ink-queue-filter-btn${activeFilter === key ? ' ink-queue-filter-active' : ''}`}
              onClick={() => this._setFilter(key)}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  _renderCard(item) {
    const progress = item.progress != null ? Math.min(Math.max(item.progress, 0), 100) : null;

    return (
      <div class="ink-queue-card" key={item.id || item._id}>
        <div class="ink-queue-card-header">
          <span class="ink-queue-card-title" title={item.series_name || item.series}>
            {item.series_name || item.series || '—'}
          </span>
          <span class={`ink-queue-status ${this._statusClass(item.status || item.stage)}`}>
            {item.status || item.stage || '—'}
          </span>
        </div>

        <div class="ink-queue-card-issue" title={item.issue || item.title}>
          {item.issue || item.title || '—'}
        </div>

        <div class="ink-queue-card-meta">
          {item.source && (
            <span class="ink-pill ink-pill-muted">{item.source}</span>
          )}
          {item.type && (
            <span class="ink-pill ink-pill-muted">{item.type}</span>
          )}
        </div>

        {item.source_name && (
          <div class="ink-queue-card-source">
            Source: {item.source_name}
          </div>
        )}

        {progress != null && (
          <div class="ink-queue-card-progress">
            <div class="ink-queue-card-progress-label">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div class="ink-progress">
              <div class="ink-progress-bar" style={`width: ${progress}%`} />
            </div>
          </div>
        )}
      </div>
    );
  }

  render() {
    const { loading, error, rows, totalCount, runLoading } = this.state;

    return (
      <div class="ink-page ink-queue-page">
        <style>{styles}</style>

        {error && (
          <div class="ink-queue-error">
            {error}
          </div>
        )}

        {loading ? (
          <div class="ink-loading">
            <div class="ink-spinner" />
          </div>
        ) : (
          <div>
            <div class="ink-queue-toolbar">
              <div class="ink-queue-toolbar-left">
                <span>{totalCount} item{totalCount !== 1 ? 's' : ''} in queue</span>
              </div>
              <div class="ink-queue-toolbar-right">
                <button
                  class={`ink-btn-primary ink-btn-sm ink-queue-run-btn${runLoading ? ' ink-queue-running' : ''}`}
                  onClick={this._handleRun}
                  disabled={runLoading}
                >
                  {runLoading ? '⟳ Running…' : '▶ Run Queue'}
                </button>
                <button class="ink-btn-ghost ink-btn-sm" onClick={this._load}>
                  ↻ Refresh
                </button>
              </div>
            </div>

            {this._renderFilters()}

            {rows.length === 0 ? (
              <div class="ink-queue-empty">
                <div class="ink-queue-empty-icon">📋</div>
                <div class="ink-queue-empty-title">Queue is Empty</div>
                <p>No items are currently queued for processing.</p>
              </div>
            ) : (
              <div class="ink-queue-grid">
                {rows.map(item => this._renderCard(item))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}

export { QueuePage };
