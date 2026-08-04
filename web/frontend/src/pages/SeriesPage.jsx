/**
 * InkDrop — Series Page
 * Main dashboard showing all series with filtering, sorting, pagination,
 * compact card grid layout, and focus highlighting.
 */

import { h, Component } from 'preact';
import api from '../api/client.jsx';
import { toast } from '../main.jsx';
import { appStore } from '../stores/app-store.jsx';
import { router } from '../router.jsx';

/* ── Scoped Styles ──────────────────────────────────────────────────── */
const styles = `
.series-page {
  animation: ink-fade-in 250ms ease-out;
}

/* ── Header / Toolbar ──────────────────────────────────────────────── */
.series-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ink-space-md);
  margin-bottom: var(--ink-space-xl);
}

.series-toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--ink-space-md);
  flex: 1;
  min-width: 0;
}

.series-toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
  flex-shrink: 0;
}

.series-page-title {
  font-family: var(--ink-font-display);
  font-size: var(--ink-text-2xl);
  font-weight: 400;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.series-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  font-size: var(--ink-text-xs);
  font-weight: 600;
  border-radius: var(--ink-radius-full);
  background: var(--ink-accent-gold-dim);
  color: var(--ink-accent-gold);
  line-height: 1;
}

/* ── Filter Bar ────────────────────────────────────────────────────── */
.series-filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ink-space-sm);
  margin-bottom: var(--ink-space-lg);
  padding: var(--ink-space-sm) 0;
}

.series-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--ink-space-xs);
  padding: var(--ink-space-xs) var(--ink-space-md);
  font-size: var(--ink-text-sm);
  font-weight: 500;
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-full);
  background: transparent;
  color: var(--ink-text-secondary);
  cursor: pointer;
  transition: all var(--ink-transition-fast);
  min-height: 30px;
  white-space: nowrap;
}

.series-filter-btn:hover {
  border-color: var(--ink-border-default);
  background: var(--ink-bg-hover);
  color: var(--ink-text-primary);
}

.series-filter-btn.active {
  background: var(--ink-accent-gold-dim);
  border-color: var(--ink-accent-gold);
  color: var(--ink-accent-gold);
}

.series-filter-count {
  font-size: var(--ink-text-xs);
  opacity: 0.7;
  margin-left: 2px;
}

/* ── Sort Bar ──────────────────────────────────────────────────────── */
.series-sort-bar {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
  margin-bottom: var(--ink-space-lg);
  padding: var(--ink-space-sm) var(--ink-space-md);
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
  flex-wrap: wrap;
}

.series-sort-label {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.series-sort-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--ink-space-xs);
  padding: var(--ink-space-xs) var(--ink-space-sm);
  font-size: var(--ink-text-sm);
  font-weight: 500;
  border: none;
  border-radius: var(--ink-radius-sm);
  background: transparent;
  color: var(--ink-text-secondary);
  cursor: pointer;
  transition: all var(--ink-transition-fast);
  min-height: 26px;
}

.series-sort-btn:hover {
  background: var(--ink-bg-hover);
  color: var(--ink-text-primary);
}

.series-sort-btn.active {
  color: var(--ink-accent-gold);
  background: var(--ink-accent-gold-dim);
}

.series-sort-arrow {
  font-size: 10px;
  transition: transform var(--ink-transition-fast);
}

.series-sort-arrow.desc {
  transform: rotate(180deg);
}

/* ── Card Grid ─────────────────────────────────────────────────────── */
.series-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--ink-space-lg);
}

.series-card {
  display: flex;
  flex-direction: column;
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--ink-transition-fast),
              transform var(--ink-transition-fast),
              box-shadow var(--ink-transition-fast);
  position: relative;
}

.series-card:hover {
  border-color: var(--ink-border-default);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.series-card:active {
  transform: translateY(0);
}

.series-card.series-card-focus {
  border-color: var(--ink-accent-gold);
  box-shadow: 0 0 0 1px var(--ink-accent-gold), 0 4px 24px rgba(201, 162, 39, 0.15);
  animation: series-focus-pulse 2s ease-in-out 3;
}

@keyframes series-focus-pulse {
  0%, 100% { box-shadow: 0 0 0 1px var(--ink-accent-gold), 0 4px 24px rgba(201, 162, 39, 0.15); }
  50% { box-shadow: 0 0 0 2px var(--ink-accent-gold), 0 4px 32px rgba(201, 162, 39, 0.25); }
}

.series-card-cover-wrap {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 aspect ratio */
  background: var(--ink-bg-elevated);
  overflow: hidden;
}

.series-card-cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--ink-transition-slow);
}

.series-card:hover .series-card-cover {
  transform: scale(1.05);
}

.series-card-cover-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-text-muted);
  font-size: var(--ink-text-sm);
  background: var(--ink-bg-elevated);
}

.series-card-body {
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-xs);
  padding: var(--ink-space-md) var(--ink-space-lg) var(--ink-space-lg);
  flex: 1;
}

.series-card-name {
  font-weight: 600;
  font-size: var(--ink-text-base);
  color: var(--ink-text-primary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.series-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ink-space-xs);
  font-size: var(--ink-text-xs);
  color: var(--ink-text-secondary);
  margin-top: var(--ink-space-xs);
}

.series-card-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  background: var(--ink-bg-elevated);
  border-radius: var(--ink-radius-sm);
  white-space: nowrap;
}

.series-card-meta-label {
  color: var(--ink-text-muted);
}

.series-card-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ink-space-sm);
  margin-top: auto;
  padding-top: var(--ink-space-sm);
  border-top: 1px solid var(--ink-border-subtle);
}

.series-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--ink-text-xs);
  color: var(--ink-text-secondary);
}

.series-stat-value {
  font-weight: 600;
  color: var(--ink-text-primary);
}

.series-stat-icon {
  opacity: 0.6;
}

.series-stat-wanted .series-stat-value { color: var(--ink-warning); }
.series-stat-queue .series-stat-value { color: var(--ink-info); }
.series-stat-needs-you .series-stat-value { color: var(--ink-danger); }

/* ── Ownership Badge ──────────────────────────────────────────────── */
.series-ownership {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: var(--ink-text-xs);
  font-weight: 500;
  padding: 1px 6px;
  border-radius: var(--ink-radius-sm);
}

.series-ownership-owned {
  background: var(--ink-success-dim);
  color: var(--ink-success);
}

.series-ownership-partial {
  background: var(--ink-warning-dim);
  color: var(--ink-warning);
}

.series-ownership-none {
  background: rgba(255,255,255,0.05);
  color: var(--ink-text-muted);
}

/* ── List Mode ─────────────────────────────────────────────────────── */
.series-list {
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-xs);
}

.series-list-row {
  display: grid;
  grid-template-columns: 48px 2fr 1fr 1fr 1fr auto;
  align-items: center;
  gap: var(--ink-space-md);
  padding: var(--ink-space-sm) var(--ink-space-md);
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-md);
  cursor: pointer;
  transition: border-color var(--ink-transition-fast), background var(--ink-transition-fast);
}

.series-list-row:hover {
  border-color: var(--ink-border-default);
  background: var(--ink-bg-hover);
}

.series-list-row.series-card-focus {
  border-color: var(--ink-accent-gold);
  box-shadow: 0 0 0 1px var(--ink-accent-gold);
  animation: series-focus-pulse 2s ease-in-out 3;
}

.series-list-thumb {
  width: 40px;
  height: 40px;
  border-radius: var(--ink-radius-sm);
  object-fit: cover;
  background: var(--ink-bg-elevated);
}

.series-list-thumb-placeholder {
  width: 40px;
  height: 40px;
  border-radius: var(--ink-radius-sm);
  background: var(--ink-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--ink-text-muted);
}

.series-list-name {
  font-weight: 500;
  font-size: var(--ink-text-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-list-cell {
  font-size: var(--ink-text-sm);
  color: var(--ink-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Load More ─────────────────────────────────────────────────────── */
.series-load-more {
  display: flex;
  justify-content: center;
  padding: var(--ink-space-xl) 0 var(--ink-space-2xl);
}

.series-load-more button {
  min-width: 200px;
}

/* ── Error State ───────────────────────────────────────────────────── */
.series-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ink-space-lg);
  padding: var(--ink-space-3xl) var(--ink-space-xl);
  text-align: center;
}

.series-error-icon {
  font-size: 2.5rem;
  opacity: 0.4;
}

.series-error-title {
  font-size: var(--ink-text-lg);
  font-weight: 600;
  color: var(--ink-text-secondary);
}

.series-error-message {
  font-size: var(--ink-text-sm);
  color: var(--ink-text-muted);
  max-width: 480px;
}

/* ── Responsive ────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .series-grid {
    grid-template-columns: 1fr;
  }

  .series-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .series-toolbar-right {
    justify-content: flex-end;
  }

  .series-filter-bar {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: var(--ink-space-sm);
    -webkit-overflow-scrolling: touch;
  }

  .series-filter-btn {
    flex-shrink: 0;
  }

  .series-sort-bar {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
  }

  .series-list-row {
    grid-template-columns: 36px 1fr auto;
    gap: var(--ink-space-sm);
  }

  .series-list-cell-hide-mobile {
    display: none;
  }
}
`;

/* ── Sort Options ───────────────────────────────────────────────────── */
const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'publisher', label: 'Publisher' },
  { value: 'source', label: 'Source' },
  { value: 'wanted_count', label: 'Wanted' },
  { value: 'active_queue_count', label: 'Queue' },
  { value: 'needs_you_count', label: 'Needs You' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
];

/* ── Helpers ────────────────────────────────────────────────────────── */
function formatCount(n) {
  if (n == null || n === 0) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function ownershipLabel(ownership) {
  if (!ownership || ownership === 'none') return 'None';
  if (ownership === 'all') return 'Owned';
  if (ownership === 'partial') return 'Partial';
  return ownership;
}

function ownershipClass(ownership) {
  if (!ownership || ownership === 'none') return 'series-ownership-none';
  if (ownership === 'all') return 'series-ownership-owned';
  return 'series-ownership-partial';
}

/* ── SeriesPage Component ────────────────────────────────────────────── */
export class SeriesPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      error: null,
      series: [],
      count: 0,
      totalCount: 0,
      hasMore: false,
      filters: [],
      seriesFilter: 'all',
      sortBy: 'name',
      sortDir: 'asc',
      focusId: null,
      refreshing: false,
      loadingMore: false,
      rowMode: 'compact_card',
    };

    this._mounted = false;
    this._abortController = null;
  }

  componentDidMount() {
    this._mounted = true;
    this._loadInitial();
  }

  componentWillUnmount() {
    this._mounted = false;
    if (this._abortController) {
      this._abortController.abort();
    }
  }

  /* ── Data Loading ────────────────────────────────────────────────── */
  async _loadInitial() {
    const route = router.parseHash();
    const focusId = route.params?.focus || null;

    this.setState({ focusId, loading: true, error: null });

    try {
      const [viewData, sectionsData] = await Promise.all([
        api.state.view('series', {
          summary_mode: 'compact',
          row_mode: 'compact_card',
        }),
        api.state.sections().catch(() => null),
      ]);

      if (!this._mounted) return;

      if (!viewData.ok) {
        throw new Error(viewData.error || 'Failed to load series');
      }

      this.setState({
        loading: false,
        series: viewData.rows || [],
        count: viewData.count || 0,
        totalCount: viewData.total_count || 0,
        hasMore: viewData.has_more || false,
        filters: viewData.filters || [],
        seriesFilter: viewData.series_filter || 'all',
        rowMode: viewData.row_mode || 'compact_card',
      });

      if (sectionsData && sectionsData.ok) {
        appStore.set('sectionsData', sectionsData);
      }

      // Handle focus — scroll into view after render
      if (focusId) {
        setTimeout(() => this._scrollToFocus(focusId), 100);
      }
    } catch (err) {
      if (!this._mounted) return;
      this.setState({
        loading: false,
        error: err.message || 'An unexpected error occurred',
      });
      toast(err.message || 'Failed to load series', 'error');
    }
  }

  async _loadMore() {
    if (this.state.loadingMore || !this.state.hasMore) return;

    this.setState({ loadingMore: true });

    try {
      const data = await api.state.view('series', {
        summary_mode: 'compact',
        row_mode: this.state.rowMode,
        offset: this.state.series.length,
        series_filter: this.state.seriesFilter !== 'all' ? this.state.seriesFilter : undefined,
        sort_by: this.state.sortBy,
        sort_dir: this.state.sortDir,
      });

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || 'Failed to load more series');
      }

      this.setState(prev => ({
        loadingMore: false,
        series: [...prev.series, ...(data.rows || [])],
        count: data.count || 0,
        totalCount: data.total_count || prev.totalCount,
        hasMore: data.has_more || false,
      }));
    } catch (err) {
      if (!this._mounted) return;
      this.setState({ loadingMore: false });
      toast(err.message || 'Failed to load more series', 'error');
    }
  }

  async _refresh() {
    this.setState({ refreshing: true });

    try {
      const data = await api.state.view('series', {
        summary_mode: 'compact',
        row_mode: this.state.rowMode,
        series_filter: this.state.seriesFilter !== 'all' ? this.state.seriesFilter : undefined,
        sort_by: this.state.sortBy,
        sort_dir: this.state.sortDir,
      });

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || 'Failed to refresh series');
      }

      this.setState({
        refreshing: false,
        series: data.rows || [],
        count: data.count || 0,
        totalCount: data.total_count || 0,
        hasMore: data.has_more || false,
        filters: data.filters || this.state.filters,
        seriesFilter: data.series_filter || this.state.seriesFilter,
      });

      toast('Series refreshed', 'success');
    } catch (err) {
      if (!this._mounted) return;
      this.setState({ refreshing: false });
      toast(err.message || 'Failed to refresh series', 'error');
    }
  }

  async _applyFilter(filterValue) {
    this.setState({ loading: true, seriesFilter: filterValue, error: null });

    try {
      const data = await api.state.view('series', {
        summary_mode: 'compact',
        row_mode: this.state.rowMode,
        series_filter: filterValue !== 'all' ? filterValue : undefined,
        sort_by: this.state.sortBy,
        sort_dir: this.state.sortDir,
      });

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || 'Failed to filter series');
      }

      this.setState({
        loading: false,
        series: data.rows || [],
        count: data.count || 0,
        totalCount: data.total_count || 0,
        hasMore: data.has_more || false,
        filters: data.filters || this.state.filters,
      });
    } catch (err) {
      if (!this._mounted) return;
      this.setState({ loading: false, error: err.message || 'Failed to filter' });
      toast(err.message || 'Failed to filter series', 'error');
    }
  }

  async _applySort(sortBy) {
    const sortDir = this.state.sortBy === sortBy && this.state.sortDir === 'asc' ? 'desc' : 'asc';
    this.setState({ loading: true, sortBy, sortDir, error: null });

    try {
      const data = await api.state.view('series', {
        summary_mode: 'compact',
        row_mode: this.state.rowMode,
        series_filter: this.state.seriesFilter !== 'all' ? this.state.seriesFilter : undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      });

      if (!this._mounted) return;

      if (!data.ok) {
        throw new Error(data.error || 'Failed to sort series');
      }

      this.setState({
        loading: false,
        series: data.rows || [],
        count: data.count || 0,
        totalCount: data.total_count || 0,
        hasMore: data.has_more || false,
      });
    } catch (err) {
      if (!this._mounted) return;
      this.setState({ loading: false, error: err.message || 'Failed to sort' });
      toast(err.message || 'Failed to sort series', 'error');
    }
  }

  /* ── Navigation ──────────────────────────────────────────────────── */
  _navigateToSeries(seriesId) {
    router.navigate('series', { id: seriesId });
    // Load detail into app store for potential detail panel
    api.state.seriesDetail(seriesId).then(data => {
      if (data && data.ok) {
        appStore.set('seriesDetail', data);
      }
    }).catch(() => {
      // Silently fail — detail will load on the detail page
    });
  }

  _scrollToFocus(focusId) {
    const el = document.querySelector(`[data-series-id="${focusId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ── Render Helpers ──────────────────────────────────────────────── */
  _renderFilterBar() {
    const { filters, seriesFilter, count } = this.state;

    if (!filters || filters.length === 0) return null;

    return (
      <div class="series-filter-bar">
        {filters.map(f => (
          <button
            class={`series-filter-btn${seriesFilter === f.value ? ' active' : ''}`}
            onClick={() => this._applyFilter(f.value)}
            aria-pressed={seriesFilter === f.value}
            type="button"
          >
            {f.label}
            {f.count != null && (
              <span class="series-filter-count">({formatCount(f.count)})</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  _renderSortBar() {
    const { sortBy, sortDir } = this.state;

    return (
      <div class="series-sort-bar">
        <span class="series-sort-label">Sort</span>
        {SORT_OPTIONS.map(opt => (
          <button
            class={`series-sort-btn${sortBy === opt.value ? ' active' : ''}`}
            onClick={() => this._applySort(opt.value)}
            type="button"
          >
            {opt.label}
            {sortBy === opt.value && (
              <span class={`series-sort-arrow${sortDir === 'desc' ? ' desc' : ''}`}>
                &#9650;
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  _renderCard(series) {
    const { focusId } = this.state;
    const isFocus = focusId === series.id;
    const coverUrl = series.cover_url ? api.cover.url(series.cover_url) : null;

    return (
      <div
        class={`series-card${isFocus ? ' series-card-focus' : ''}`}
        data-series-id={series.id}
        onClick={() => this._navigateToSeries(series.id)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') this._navigateToSeries(series.id); }}
      >
        <div class="series-card-cover-wrap">
          {coverUrl ? (
            <img
              class="series-card-cover"
              src={coverUrl}
              alt={`${series.name} cover`}
              loading="lazy"
              onError={e => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            class="series-card-cover-placeholder"
            style={coverUrl ? { display: 'none' } : {}}
          >
            No Cover
          </div>
        </div>
        <div class="series-card-body">
          <div class="series-card-name" title={series.name}>
            {series.name}
          </div>
          <div class="series-card-meta">
            {series.publisher && (
              <span class="series-card-meta-item">
                <span class="series-card-meta-label">Pub:</span> {series.publisher}
              </span>
            )}
            {series.source && (
              <span class="series-card-meta-item">
                <span class="series-card-meta-label">Src:</span> {series.source}
              </span>
            )}
            {series.metadata_provider && (
              <span class="series-card-meta-item">
                <span class="series-card-meta-label">Meta:</span> {series.metadata_provider}
              </span>
            )}
            <span class={`series-ownership ${ownershipClass(series.ownership)}`}>
              {ownershipLabel(series.ownership)}
            </span>
          </div>
          <div class="series-card-stats">
            {series.wanted_count > 0 && (
              <span class="series-stat series-stat-wanted" title="Wanted issues">
                <span class="series-stat-icon">&#128276;</span>
                <span class="series-stat-value">{formatCount(series.wanted_count)}</span>
              </span>
            )}
            {series.active_queue_count > 0 && (
              <span class="series-stat series-stat-queue" title="Active in queue">
                <span class="series-stat-icon">&#9881;</span>
                <span class="series-stat-value">{formatCount(series.active_queue_count)}</span>
              </span>
            )}
            {series.needs_you_count > 0 && (
              <span class="series-stat series-stat-needs-you" title="Needs attention">
                <span class="series-stat-icon">&#9888;</span>
                <span class="series-stat-value">{formatCount(series.needs_you_count)}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  _renderListRow(series) {
    const { focusId } = this.state;
    const isFocus = focusId === series.id;
    const coverUrl = series.cover_url ? api.cover.url(series.cover_url) : null;

    return (
      <div
        class={`series-list-row${isFocus ? ' series-card-focus' : ''}`}
        data-series-id={series.id}
        onClick={() => this._navigateToSeries(series.id)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') this._navigateToSeries(series.id); }}
      >
        {coverUrl ? (
          <img
            class="series-list-thumb"
            src={coverUrl}
            alt=""
            loading="lazy"
            onError={e => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          class="series-list-thumb-placeholder"
          style={coverUrl ? { display: 'none' } : {}}
        >
          N/A
        </div>
        <div class="series-list-name" title={series.name}>{series.name}</div>
        <div class="series-list-cell series-list-cell-hide-mobile">{series.publisher || '—'}</div>
        <div class="series-list-cell series-list-cell-hide-mobile">{series.source || '—'}</div>
        <div class="series-list-cell series-list-cell-hide-mobile">
          <span class={`series-ownership ${ownershipClass(series.ownership)}`}>
            {ownershipLabel(series.ownership)}
          </span>
        </div>
        <div class="series-list-cell" style="display:flex;gap:8px;align-items:center;">
          {series.wanted_count > 0 && (
            <span class="series-stat series-stat-wanted" title="Wanted">
              <span class="series-stat-value">{formatCount(series.wanted_count)}</span>
            </span>
          )}
          {series.active_queue_count > 0 && (
            <span class="series-stat series-stat-queue" title="Queue">
              <span class="series-stat-value">{formatCount(series.active_queue_count)}</span>
            </span>
          )}
          {series.needs_you_count > 0 && (
            <span class="series-stat series-stat-needs-you" title="Needs you">
              <span class="series-stat-value">{formatCount(series.needs_you_count)}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  _renderSeriesList() {
    const { series, rowMode } = this.state;

    if (!series || series.length === 0) {
      return (
        <div class="ink-empty">
          <div class="ink-empty-icon">&#128196;</div>
          <div class="ink-empty-title">No Series Found</div>
          <div class="ink-empty-description" style="color:var(--ink-text-muted);font-size:var(--ink-text-sm);">
            {this.state.seriesFilter !== 'all'
              ? 'No series match the current filter. Try a different filter.'
              : 'No series have been added yet. Add a watch or import to get started.'}
          </div>
        </div>
      );
    }

    if (rowMode === 'compact_card') {
      return (
        <div class="series-grid">
          {series.map(s => this._renderCard(s))}
        </div>
      );
    }

    return (
      <div class="series-list">
        {series.map(s => this._renderListRow(s))}
      </div>
    );
  }

  _renderLoadMore() {
    if (!this.state.hasMore) return null;

    return (
      <div class="series-load-more">
        <button
          class="ink-btn-ghost"
          onClick={() => this._loadMore()}
          disabled={this.state.loadingMore}
          type="button"
        >
          {this.state.loadingMore ? (
            <>
              <span class="ink-spinner" style="width:14px;height:14px;border-width:2px;" />
              Loading…
            </>
          ) : (
            `Load More (${this.state.totalCount - this.state.series.length} remaining)`
          )}
        </button>
      </div>
    );
  }

  _renderError() {
    return (
      <div class="series-error">
        <div class="series-error-icon">&#9888;</div>
        <div class="series-error-title">Failed to Load Series</div>
        <div class="series-error-message">{this.state.error}</div>
        <button class="ink-btn-primary" onClick={() => this._loadInitial()} type="button">
          Retry
        </button>
      </div>
    );
  }

  _renderLoading() {
    return (
      <div class="ink-loading">
        <div class="ink-spinner" />
        <span style="margin-left:var(--ink-space-md);">Loading series…</span>
      </div>
    );
  }

  /* ── Main Render ─────────────────────────────────────────────────── */
  render() {
    const { loading, error, count, totalCount, refreshing } = this.state;

    return (
      <div class="series-page ink-page">
        <style>{styles}</style>

        {/* ── Toolbar ──────────────────────────────────────────────── */}
        <div class="series-toolbar">
          <div class="series-toolbar-left">
            <h1 class="series-page-title">Series</h1>
            {!loading && !error && (
              <span class="series-count-badge" title={`${count} shown of ${totalCount} total`}>
                {formatCount(count)}
                {totalCount > count && <span style="opacity:0.6;margin-left:2px;">/{formatCount(totalCount)}</span>}
              </span>
            )}
          </div>
          <div class="series-toolbar-right">
            <button
              class="ink-btn-ghost ink-btn-sm"
              onClick={() => this._refresh()}
              disabled={refreshing}
              type="button"
              title="Refresh series list"
            >
              {refreshing ? (
                <span class="ink-spinner" style="width:14px;height:14px;border-width:2px;" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              )}
              Refresh
            </button>
          </div>
        </div>

        {/* ── Filter Bar ─────────────────────────────────────────── */}
        {!loading && !error && this._renderFilterBar()}

        {/* ── Sort Bar ────────────────────────────────────────────── */}
        {!loading && !error && this._renderSortBar()}

        {/* ── Content ─────────────────────────────────────────────── */}
        {loading && this._renderLoading()}
        {error && this._renderError()}
        {!loading && !error && (
          <>
            {this._renderSeriesList()}
            {this._renderLoadMore()}
          </>
        )}
      </div>
    );
  }
}

export default SeriesPage;
