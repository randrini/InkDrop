/**
 * InkDrop — Activity Page
 * Dashboard showing current transfers, downloads, and import activity.
 */

import { h, Component, Fragment } from 'preact';
import api from '../api/client.jsx';
import { toast } from '../main.jsx';

const styles = `
.ink-activity-page { padding-bottom: var(--ink-space-2xl); }

/* ── Summary Chips ─────────────────────────────── */
.ink-activity-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ink-space-md);
  margin-bottom: var(--ink-space-xl);
}

.ink-activity-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 100px;
  padding: var(--ink-space-lg) var(--ink-space-xl);
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
  transition: border-color var(--ink-transition-fast), transform var(--ink-transition-fast);
  cursor: default;
}
.ink-activity-chip:hover {
  border-color: var(--ink-border-default);
  transform: translateY(-1px);
}

.ink-activity-chip-value {
  font-size: var(--ink-text-2xl);
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.ink-activity-chip-label {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: var(--ink-space-xs);
}

.ink-activity-chip-total .ink-activity-chip-value { color: var(--ink-text-primary); }
.ink-activity-chip-downloading .ink-activity-chip-value { color: var(--ink-info); }
.ink-activity-chip-importing .ink-activity-chip-value { color: var(--ink-accent-gold); }
.ink-activity-chip-queued .ink-activity-chip-value { color: var(--ink-text-secondary); }
.ink-activity-chip-other .ink-activity-chip-value { color: var(--ink-text-muted); }

/* ── Toolbar ──────────────────────────────────── */
.ink-activity-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ink-space-md);
  margin-bottom: var(--ink-space-lg);
  flex-wrap: wrap;
}

.ink-activity-toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
  color: var(--ink-text-secondary);
  font-size: var(--ink-text-sm);
}

.ink-activity-toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
}

.ink-activity-poll-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-success);
  animation: ink-activity-pulse 2s ease-in-out infinite;
}
@keyframes ink-activity-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── Table ────────────────────────────────────── */
.ink-activity-table-wrap {
  overflow-x: auto;
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
}

.ink-activity-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--ink-text-sm);
}

.ink-activity-table th {
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

.ink-activity-table td {
  padding: var(--ink-space-sm) var(--ink-space-md);
  border-bottom: 1px solid var(--ink-border-subtle);
  vertical-align: middle;
}

.ink-activity-table tbody tr {
  transition: background var(--ink-transition-fast);
  cursor: pointer;
}
.ink-activity-table tbody tr:hover { background: var(--ink-bg-hover); }
.ink-activity-table tbody tr:last-child td { border-bottom: none; }

.ink-activity-series-name {
  font-weight: 500;
  color: var(--ink-text-primary);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ink-activity-issue {
  color: var(--ink-text-secondary);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ink-activity-progress-cell {
  min-width: 140px;
}

.ink-activity-progress-wrap {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
}

.ink-activity-progress-bar {
  flex: 1;
  height: 6px;
  background: var(--ink-bg-elevated);
  border-radius: var(--ink-radius-full);
  overflow: hidden;
  position: relative;
}

.ink-activity-progress-fill {
  height: 100%;
  border-radius: var(--ink-radius-full);
  transition: width var(--ink-transition-base);
}

.ink-activity-progress-fill-downloading { background: var(--ink-info); }
.ink-activity-progress-fill-importing { background: var(--ink-accent-gold); }
.ink-activity-progress-fill-queued { background: var(--ink-text-muted); }
.ink-activity-progress-fill-complete { background: var(--ink-success); }
.ink-activity-progress-fill-error { background: var(--ink-danger); }

.ink-activity-progress-pct {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 36px;
  text-align: right;
}

.ink-activity-speed {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ink-activity-eta {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ── Stage Pill ───────────────────────────────── */
.ink-activity-stage {
  display: inline-flex;
  align-items: center;
  gap: var(--ink-space-xs);
  padding: 2px var(--ink-space-sm);
  font-size: var(--ink-text-xs);
  font-weight: 500;
  border-radius: var(--ink-radius-full);
  white-space: nowrap;
}
.ink-activity-stage-downloading { background: var(--ink-info-dim); color: var(--ink-info); }
.ink-activity-stage-importing { background: var(--ink-accent-gold-dim); color: var(--ink-accent-gold); }
.ink-activity-stage-queued { background: rgba(255,255,255,0.05); color: var(--ink-text-muted); }
.ink-activity-stage-complete { background: var(--ink-success-dim); color: var(--ink-success); }
.ink-activity-stage-error { background: var(--ink-danger-dim); color: var(--ink-danger); }

/* ── Expanded Detail ──────────────────────────── */
.ink-activity-detail-row td {
  padding: 0;
}

.ink-activity-detail-inner {
  padding: var(--ink-space-lg) var(--ink-space-xl);
  background: var(--ink-bg-surface-alt);
  border-bottom: 1px solid var(--ink-border-subtle);
  animation: ink-fade-in var(--ink-transition-fast) ease-out;
}

.ink-activity-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--ink-space-md);
}

.ink-activity-detail-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ink-activity-detail-field-label {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ink-activity-detail-field-value {
  font-size: var(--ink-text-sm);
  color: var(--ink-text-primary);
  word-break: break-all;
}

.ink-activity-detail-loading {
  padding: var(--ink-space-lg);
  text-align: center;
  color: var(--ink-text-muted);
  font-size: var(--ink-text-sm);
}

/* ── Empty State ──────────────────────────────── */
.ink-activity-empty {
  text-align: center;
  padding: var(--ink-space-3xl) var(--ink-space-xl);
  color: var(--ink-text-muted);
}

.ink-activity-empty-icon {
  font-size: 2.5rem;
  margin-bottom: var(--ink-space-md);
  opacity: 0.4;
}

.ink-activity-empty-title {
  font-size: var(--ink-text-lg);
  font-weight: 600;
  color: var(--ink-text-secondary);
  margin-bottom: var(--ink-space-sm);
}

/* ── Error ─────────────────────────────────────── */
.ink-activity-error {
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
  .ink-activity-chips { gap: var(--ink-space-sm); }
  .ink-activity-chip { min-width: 80px; padding: var(--ink-space-md); }
  .ink-activity-chip-value { font-size: var(--ink-text-xl); }
  .ink-activity-detail-grid { grid-template-columns: 1fr 1fr; }
}
`;

class ActivityPage extends Component {
  constructor() {
    super();
    this.state = {
      loading: true,
      error: null,
      summary: null,
      activity: [],
      total: 0,
      expandedId: null,
      detailCache: {},
      detailLoading: null,
    };
    this._pollTimer = null;
    this._load = this._load.bind(this);
    this._toggleDetail = this._toggleDetail.bind(this);
  }

  componentDidMount() {
    this._load();
    this._pollTimer = setInterval(this._load, 30000);
  }

  componentWillUnmount() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  async _load() {
    try {
      const [summaryRes, currentRes] = await Promise.all([
        api.activity.summary(),
        api.activity.current({ limit: 50 }),
      ]);

      this.setState({
        loading: false,
        error: null,
        summary: summaryRes.ok ? summaryRes.summary : null,
        activity: currentRes.ok ? currentRes.activity : [],
        total: currentRes.ok ? currentRes.total : 0,
      });
    } catch (err) {
      this.setState({
        loading: false,
        error: err.message || 'Failed to load activity data',
      });
    }
  }

  async _toggleDetail(id) {
    if (this.state.expandedId === id) {
      this.setState({ expandedId: null });
      return;
    }

    if (this.state.detailCache[id]) {
      this.setState({ expandedId: id });
      return;
    }

    this.setState({ detailLoading: id });

    try {
      const res = await api.activity.detail(id);
      if (res.ok) {
        this.setState(prev => ({
          expandedId: id,
          detailLoading: null,
          detailCache: { ...prev.detailCache, [id]: res.activity },
        }));
      } else {
        this.setState({ detailLoading: null });
        toast('Failed to load activity detail', 'error');
      }
    } catch (err) {
      this.setState({ detailLoading: null });
      toast(err.message || 'Failed to load activity detail', 'error');
    }
  }

  _stageClass(stage) {
    const s = (stage || '').toLowerCase();
    if (s.includes('download')) return 'ink-activity-stage-downloading';
    if (s.includes('import')) return 'ink-activity-stage-importing';
    if (s.includes('queue') || s.includes('wait')) return 'ink-activity-stage-queued';
    if (s.includes('complete') || s.includes('done')) return 'ink-activity-stage-complete';
    if (s.includes('error') || s.includes('fail')) return 'ink-activity-stage-error';
    return 'ink-activity-stage-queued';
  }

  _progressFillClass(stage) {
    const s = (stage || '').toLowerCase();
    if (s.includes('download')) return 'ink-activity-progress-fill-downloading';
    if (s.includes('import')) return 'ink-activity-progress-fill-importing';
    if (s.includes('queue') || s.includes('wait')) return 'ink-activity-progress-fill-queued';
    if (s.includes('complete') || s.includes('done')) return 'ink-activity-progress-fill-complete';
    if (s.includes('error') || s.includes('fail')) return 'ink-activity-progress-fill-error';
    return 'ink-activity-progress-fill-queued';
  }

  _formatSpeed(bytesPerSec) {
    if (bytesPerSec == null || isNaN(bytesPerSec)) return '—';
    if (bytesPerSec === 0) return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let i = 0;
    let val = bytesPerSec;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(1)} ${units[i]}`;
  }

  _formatETA(seconds) {
    if (seconds == null || isNaN(seconds) || seconds < 0) return '—';
    if (seconds === 0) return 'Complete';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  _renderSummaryChips() {
    const { summary } = this.state;
    if (!summary) return null;

    const chips = [
      { key: 'total', label: 'Total', value: summary.total ?? 0, cls: 'ink-activity-chip-total' },
      { key: 'downloading', label: 'Downloading', value: summary.downloading ?? 0, cls: 'ink-activity-chip-downloading' },
      { key: 'importing', label: 'Importing', value: summary.importing ?? 0, cls: 'ink-activity-chip-importing' },
      { key: 'queued', label: 'Queued', value: summary.queued ?? 0, cls: 'ink-activity-chip-queued' },
    ];

    // Add any extra keys from the summary that aren't the standard ones
    const known = new Set(['total', 'downloading', 'importing', 'queued']);
    for (const [key, value] of Object.entries(summary)) {
      if (!known.has(key) && typeof value === 'number') {
        chips.push({
          key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          value,
          cls: 'ink-activity-chip-other',
        });
      }
    }

    return (
      <div class="ink-activity-chips">
        {chips.map(chip => (
          <div key={chip.key} class={`ink-activity-chip ${chip.cls}`}>
            <span class="ink-activity-chip-value">{chip.value}</span>
            <span class="ink-activity-chip-label">{chip.label}</span>
          </div>
        ))}
      </div>
    );
  }

  _renderTable() {
    const { activity, expandedId, detailCache, detailLoading } = this.state;

    if (!activity || activity.length === 0) {
      return (
        <div class="ink-activity-empty">
          <div class="ink-activity-empty-icon">⚡</div>
          <div class="ink-activity-empty-title">No Current Activity</div>
          <p>No active transfers, downloads, or imports right now.</p>
        </div>
      );
    }

    return (
      <div class="ink-activity-table-wrap">
        <table class="ink-activity-table">
          <thead>
            <tr>
              <th>Series</th>
              <th>Issue</th>
              <th>Stage</th>
              <th>Progress</th>
              <th>Speed</th>
              <th>ETA</th>
            </tr>
          </thead>
          <tbody>
            {activity.map(item => (
              <Fragment key={item.id || item._id}>
                <tr onClick={() => this._toggleDetail(item.id || item._id)}>
                  <td>
                    <span class="ink-activity-series-name" title={item.series_name || item.series}>
                      {item.series_name || item.series || '—'}
                    </span>
                  </td>
                  <td>
                    <span class="ink-activity-issue" title={item.issue || item.title}>
                      {item.issue || item.title || '—'}
                    </span>
                  </td>
                  <td>
                    <span class={`ink-activity-stage ${this._stageClass(item.stage)}`}>
                      {item.stage || '—'}
                    </span>
                  </td>
                  <td class="ink-activity-progress-cell">
                    <div class="ink-activity-progress-wrap">
                      <div class="ink-activity-progress-bar">
                        <div
                          class={`ink-activity-progress-fill ${this._progressFillClass(item.stage)}`}
                          style={`width: ${Math.min(item.progress ?? 0, 100)}%`}
                        />
                      </div>
                      <span class="ink-activity-progress-pct">
                        {item.progress != null ? `${Math.round(item.progress)}%` : '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span class="ink-activity-speed">
                      {this._formatSpeed(item.speed || item.download_speed)}
                    </span>
                  </td>
                  <td>
                    <span class="ink-activity-eta">
                      {this._formatETA(item.eta || item.estimated_seconds)}
                    </span>
                  </td>
                </tr>
                {expandedId === (item.id || item._id) && (
                  <tr class="ink-activity-detail-row">
                    <td colspan="6">
                      <div class="ink-activity-detail-inner">
                        {detailLoading === (item.id || item._id) ? (
                          <div class="ink-activity-detail-loading">
                            <div class="ink-spinner" />
                          </div>
                        ) : detailCache[item.id || item._id] ? (
                          this._renderDetail(detailCache[item.id || item._id])
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  _renderDetail(detail) {
    if (!detail) return null;

    const fields = [];
    for (const [key, value] of Object.entries(detail)) {
      if (value == null || value === '' || key.startsWith('_')) continue;
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const display = typeof value === 'object' ? JSON.stringify(value, null, 1) : String(value);
      fields.push({ key, label, value: display });
    }

    return (
      <div class="ink-activity-detail-grid">
        {fields.map(f => (
          <div key={f.key} class="ink-activity-detail-field">
            <span class="ink-activity-detail-field-label">{f.label}</span>
            <span class="ink-activity-detail-field-value">{f.value}</span>
          </div>
        ))}
      </div>
    );
  }

  render() {
    const { loading, error, total } = this.state;

    return (
      <div class="ink-page ink-activity-page">
        <style>{styles}</style>

        {error && (
          <div class="ink-activity-error">
            {error}
          </div>
        )}

        {loading ? (
          <div class="ink-loading">
            <div class="ink-spinner" />
          </div>
        ) : (
          <div>
            {this._renderSummaryChips()}

            <div class="ink-activity-toolbar">
              <div class="ink-activity-toolbar-left">
                <span class="ink-activity-poll-dot" />
                <span>Auto-refreshing every 30s</span>
                {total > 0 && <span>· {total} item{total !== 1 ? 's' : ''}</span>}
              </div>
              <div class="ink-activity-toolbar-right">
                <button class="ink-btn-ghost ink-btn-sm" onClick={this._load}>
                  ↻ Refresh Now
                </button>
              </div>
            </div>

            {this._renderTable()}
          </div>
        )}
      </div>
    );
  }
}

export { ActivityPage };
