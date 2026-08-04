/**
 * InkDrop — CalendarPage
 * Shows releases in a calendar-style grid grouped by week/day.
 * Supports window selectors: Last 2 weeks, Last month, Last 3 months.
 */

import { h, Component } from "preact";
import api from "../api/client.jsx";
import { toast } from "../main.jsx";

const styles = `
.ink-calendar-window {
  display: flex;
  gap: var(--ink-space-sm);
  margin-bottom: var(--ink-space-lg);
  flex-wrap: wrap;
}
.ink-calendar-window button {
  min-height: 32px;
  padding: var(--ink-space-xs) var(--ink-space-md);
  font-size: var(--ink-text-sm);
  background: transparent;
  border: 1px solid var(--ink-border-subtle);
  color: var(--ink-text-secondary);
  border-radius: var(--ink-radius-md);
  transition: all var(--ink-transition-fast);
}
.ink-calendar-window button:hover {
  border-color: var(--ink-border-default);
  color: var(--ink-text-primary);
}
.ink-calendar-window button.ink-calendar-window-active {
  background: var(--ink-accent-gold-dim);
  border-color: var(--ink-accent-gold);
  color: var(--ink-accent-gold);
}
.ink-calendar-week {
  margin-bottom: var(--ink-space-xl);
}
.ink-calendar-week-header {
  display: flex;
  align-items: center;
  gap: var(--ink-space-md);
  margin-bottom: var(--ink-space-md);
  padding-bottom: var(--ink-space-sm);
  border-bottom: 1px solid var(--ink-border-subtle);
}
.ink-calendar-week-label {
  font-family: var(--ink-font-display);
  font-size: var(--ink-text-lg);
  font-weight: 400;
  color: var(--ink-text-primary);
}
.ink-calendar-week-range {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
}
.ink-calendar-day {
  margin-bottom: var(--ink-space-md);
}
.ink-calendar-day-header {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
  margin-bottom: var(--ink-space-sm);
}
.ink-calendar-day-label {
  font-size: var(--ink-text-sm);
  font-weight: 600;
  color: var(--ink-text-secondary);
}
.ink-calendar-day-date {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
}
.ink-calendar-entries {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--ink-space-sm);
}
.ink-calendar-entry {
  display: flex;
  gap: var(--ink-space-sm);
  padding: var(--ink-space-sm);
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-md);
  transition: border-color var(--ink-transition-fast);
  align-items: flex-start;
}
.ink-calendar-entry:hover {
  border-color: var(--ink-border-default);
}
.ink-calendar-entry-cover {
  width: 36px;
  height: 50px;
  border-radius: var(--ink-radius-sm);
  object-fit: cover;
  background: var(--ink-bg-elevated);
  flex-shrink: 0;
}
.ink-calendar-entry-info {
  flex: 1;
  min-width: 0;
}
.ink-calendar-entry-title {
  font-size: var(--ink-text-sm);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ink-calendar-entry-meta {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  margin-top: 2px;
}
.ink-calendar-entry-owned {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.ink-calendar-count {
  font-size: var(--ink-text-sm);
  color: var(--ink-text-muted);
  margin-bottom: var(--ink-space-md);
}
.ink-calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ink-space-lg);
  flex-wrap: wrap;
  margin-bottom: var(--ink-space-lg);
}
@media (max-width: 768px) {
  .ink-calendar-entries {
    grid-template-columns: 1fr;
  }
  .ink-calendar-week-header {
    flex-wrap: wrap;
  }
}
`;

const WINDOW_OPTIONS = [
  { label: "Last 2 weeks", days: 14 },
  { label: "Last month", days: 30 },
  { label: "Last 3 months", days: 90 },
];

class CalendarPage extends Component {
  constructor() {
    super();
    this.state = {
      loading: true,
      error: null,
      entries: [],
      groupedByWeek: {},
      totalCount: 0,
      windowDays: 30,
    };
    this._loadData = this._loadData.bind(this);
    this._handleWindowChange = this._handleWindowChange.bind(this);
  }

  componentDidMount() {
    this._loadData();
  }

  async _loadData(daysBack = this.state.windowDays) {
    this.setState({ loading: true, error: null });
    try {
      const data = await api.state.calendar({
        days_back: daysBack,
        days_ahead: daysBack,
      });
      if (data.ok) {
        const stateData = data.state || data;
        const entries = stateData.items || stateData.entries || stateData.results || [];
        this.setState(
          {
            entries,
            totalCount: stateData.total_count || stateData.total || entries.length,
            loading: false,
          },
          () => this._groupByWeek(),
        );
      } else {
        this.setState({ error: data.error || "Failed to load calendar", loading: false });
      }
    } catch (err) {
      this.setState({ error: err.message || "Failed to load calendar", loading: false });
    }
  }

  _groupByWeek() {
    const { entries } = this.state;
    const weeks = {};

    for (const entry of entries) {
      const dateStr = entry.release_date || entry.date || entry.publish_date;
      if (!dateStr) continue;

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue;

      // Get Monday of the week
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day; // Monday start
      const monday = new Date(date);
      monday.setDate(date.getDate() + diff);
      const weekKey = monday.toISOString().split("T")[0];

      if (!weeks[weekKey]) {
        weeks[weekKey] = {
          monday,
          label: `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          days: {},
        };
      }

      const dayKey = dateStr;
      if (!weeks[weekKey].days[dayKey]) {
        weeks[weekKey].days[dayKey] = {
          date,
          label: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
          entries: [],
        };
      }
      weeks[weekKey].days[dayKey].entries.push(entry);
    }

    // Sort weeks by date
    const sortedWeeks = Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce((acc, [key, val]) => {
        // Sort days within each week
        const sortedDays = Object.entries(val.days)
          .sort(([a], [b]) => a.localeCompare(b))
          .reduce((dAcc, [dKey, dVal]) => {
            dAcc[dKey] = dVal;
            return dAcc;
          }, {});
        acc[key] = { ...val, days: sortedDays };
        return acc;
      }, {});

    this.setState({ groupedByWeek: sortedWeeks });
  }

  _handleWindowChange(days) {
    this.setState({ windowDays: days });
    this._loadData(days);
  }

  render() {
    const { loading, error, groupedByWeek, totalCount, windowDays } = this.state;

    return (
      <div class="ink-page">
        <style>{styles}</style>

        {/* Header */}
        <div class="ink-calendar-header">
          <div class="ink-calendar-count">
            {totalCount > 0 ? `${totalCount} release${totalCount !== 1 ? "s" : ""}` : "No releases"}
          </div>
          <button class="ink-btn-ghost" onClick={() => this._loadData()}>
            ↻ Refresh
          </button>
        </div>

        {/* Window selector */}
        <div class="ink-calendar-window">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              class={windowDays === opt.days ? "ink-calendar-window-active" : ""}
              onClick={() => this._handleWindowChange(opt.days)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {loading && (
          <div class="ink-loading">
            <div class="ink-spinner" />
            <span style="margin-left: var(--ink-space-sm);">Loading calendar...</span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div class="ink-section">
            <div class="ink-section-body" style="text-align: center; color: var(--ink-text-danger);">
              <p>{error}</p>
              <button class="ink-btn-ghost" style="margin-top: var(--ink-space-md);" onClick={() => this._loadData()}>
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && Object.keys(groupedByWeek).length === 0 && (
          <div class="ink-empty">
            <div class="ink-empty-icon">📅</div>
            <div class="ink-empty-title">No upcoming releases</div>
            <p>There are no releases in the selected time window.</p>
          </div>
        )}

        {/* Calendar grid */}
        {!loading && Object.keys(groupedByWeek).length > 0 && (
          <div>
            {Object.entries(groupedByWeek).map(([weekKey, week]) => (
              <div class="ink-calendar-week" key={weekKey}>
                <div class="ink-calendar-week-header">
                  <span class="ink-calendar-week-label">{week.label}</span>
                  <span class="ink-calendar-week-range">
                    {Object.values(week.days).reduce((sum, d) => sum + d.entries.length, 0)} releases
                  </span>
                </div>

                {Object.entries(week.days).map(([dayKey, day]) => (
                  <div class="ink-calendar-day" key={dayKey}>
                    <div class="ink-calendar-day-header">
                      <span class="ink-calendar-day-label">{day.label}</span>
                      <span class="ink-calendar-day-date">
                        {day.date.toLocaleDateString("en-US", { year: "numeric" })}
                      </span>
                    </div>

                    <div class="ink-calendar-entries">
                      {day.entries.map((entry, idx) => (
                        <div class="ink-calendar-entry" key={entry.id || entry.issue_id || idx}>
                          {entry.cover_url && (
                            <img
                              class="ink-calendar-entry-cover"
                              src={api.cover.url(entry.cover_url)}
                              alt=""
                              loading="lazy"
                            />
                          )}
                          <div class="ink-calendar-entry-info">
                            <div class="ink-calendar-entry-title">
                              {entry.title || entry.series_name || entry.series || "Unknown"}
                            </div>
                            <div class="ink-calendar-entry-meta">
                              {entry.issue_number || entry.issue ? `#${entry.issue_number || entry.issue}` : ""}
                              {entry.publisher ? ` · ${entry.publisher}` : ""}
                            </div>
                          </div>
                          <div class="ink-calendar-entry-owned">
                            {entry.owned || entry.owned_status ? (
                              <span class="ink-pill ink-pill-success" title="Owned">
                                ✓
                              </span>
                            ) : (
                              <span class="ink-pill ink-pill-muted" title="Not owned">
                                ○
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}

export { CalendarPage };
export default CalendarPage;
