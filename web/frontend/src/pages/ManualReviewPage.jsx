/**
 * InkDrop — ManualReviewPage
 * Shows a decision table for items needing manual review.
 * Supports Approve, Ignore, Bad Match decisions plus pack review and SLSKD probe data.
 */

import { h, Component } from "preact";
import api from "../api/client.jsx";
import { toast } from "../main.jsx";

const styles = `
.ink-review-table-wrap {
  overflow-x: auto;
}
.ink-review-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--ink-text-sm);
}
.ink-review-table th {
  text-align: left;
  padding: var(--ink-space-sm) var(--ink-space-md);
  color: var(--ink-text-muted);
  font-weight: 500;
  border-bottom: 1px solid var(--ink-border-subtle);
  white-space: nowrap;
}
.ink-review-table td {
  padding: var(--ink-space-sm) var(--ink-space-md);
  border-bottom: 1px solid var(--ink-border-subtle);
  vertical-align: middle;
}
.ink-review-table tbody tr {
  transition: background var(--ink-transition-fast);
}
.ink-review-table tbody tr:hover {
  background: var(--ink-bg-hover);
}
.ink-review-actions {
  display: flex;
  gap: var(--ink-space-xs);
  flex-wrap: nowrap;
}
.ink-review-actions button {
  min-height: 28px;
  padding: var(--ink-space-xs) var(--ink-space-sm);
  font-size: var(--ink-text-xs);
  white-space: nowrap;
}
.ink-review-issue-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
.ink-review-source {
  color: var(--ink-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}
.ink-review-pack {
  margin-top: var(--ink-space-xl);
}
.ink-review-pack-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ink-space-sm) var(--ink-space-md);
  border-bottom: 1px solid var(--ink-border-subtle);
  font-size: var(--ink-text-sm);
}
.ink-review-pack-item:last-child {
  border-bottom: none;
}
.ink-review-slskd {
  margin-top: var(--ink-space-xl);
}
.ink-review-slskd-data {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--ink-space-md);
  margin-top: var(--ink-space-md);
}
.ink-review-slskd-item {
  background: var(--ink-bg-elevated);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-md);
  padding: var(--ink-space-md);
}
.ink-review-slskd-item-label {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--ink-space-xs);
}
.ink-review-slskd-item-value {
  font-size: var(--ink-text-sm);
  color: var(--ink-text-primary);
  font-weight: 500;
}
.ink-review-count {
  font-size: var(--ink-text-sm);
  color: var(--ink-text-muted);
  margin-bottom: var(--ink-space-md);
}
.ink-review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ink-space-lg);
  flex-wrap: wrap;
  margin-bottom: var(--ink-space-lg);
}
@media (max-width: 768px) {
  .ink-review-table td,
  .ink-review-table th {
    padding: var(--ink-space-xs) var(--ink-space-sm);
  }
  .ink-review-issue-name,
  .ink-review-source {
    max-width: 120px;
  }
  .ink-review-actions {
    flex-direction: column;
  }
}
`;

class ManualReviewPage extends Component {
  constructor() {
    super();
    this.state = {
      loading: true,
      error: null,
      items: [],
      packReviewState: null,
      slskdProbeData: null,
      processingIds: new Set(),
    };
    this._loadData = this._loadData.bind(this);
    this._handleApprove = this._handleApprove.bind(this);
    this._handleIgnore = this._handleIgnore.bind(this);
    this._handleBadMatch = this._handleBadMatch.bind(this);
  }

  componentDidMount() {
    this._loadData();
  }

  async _loadData() {
    this.setState({ loading: true, error: null });
    try {
      const data = await api.manualReview.list();
      if (data.ok) {
        this.setState({
          items: data.items || data.results || data.rows || [],
          packReviewState: data.pack_review_state || data.pack_review || null,
          slskdProbeData: data.slskd_probe || data.slskd || null,
          loading: false,
        });
      } else {
        this.setState({ error: data.error || "Failed to load review items", loading: false });
      }
    } catch (err) {
      this.setState({ error: err.message || "Failed to load review items", loading: false });
    }
  }

  async _handleDecision(action, id) {
    if (!id) return;
    this.setState((prev) => {
      const next = new Set(prev.processingIds);
      next.add(id);
      return { processingIds: next };
    });

    try {
      let data;
      if (action === "approve") {
        data = await api.manualReview.approve({ id });
      } else if (action === "ignore") {
        data = await api.manualReview.ignore({ id });
      } else if (action === "bad_match") {
        data = await api.manualReview.badMatch({ id });
      }

      if (data && data.ok) {
        const label = action === "approve" ? "Approved" : action === "ignore" ? "Ignored" : "Marked as bad match";
        toast(`${label} successfully`, "success");
        this.setState((prev) => ({
          items: prev.items.filter((item) => (item.id || item.issue_id) !== id),
        }));
      } else {
        toast(data?.error || `Failed to ${action} item`, "error");
      }
    } catch (err) {
      toast(err.message || `Failed to ${action} item`, "error");
    } finally {
      this.setState((prev) => {
        const next = new Set(prev.processingIds);
        next.delete(id);
        return { processingIds: next };
      });
    }
  }

  _handleApprove(item) {
    this._handleDecision("approve", item.id || item.issue_id);
  }

  _handleIgnore(item) {
    this._handleDecision("ignore", item.id || item.issue_id);
  }

  _handleBadMatch(item) {
    this._handleDecision("bad_match", item.id || item.issue_id);
  }

  render() {
    const { loading, error, items, packReviewState, slskdProbeData, processingIds } = this.state;

    return (
      <div class="ink-page">
        <style>{styles}</style>

        {/* Header */}
        <div class="ink-review-header">
          <div class="ink-review-count">
            {items.length > 0
              ? `${items.length} item${items.length !== 1 ? "s" : ""} awaiting review`
              : "No items awaiting review"}
          </div>
          <button class="ink-btn-ghost" onClick={this._loadData}>
            ↻ Refresh
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div class="ink-loading">
            <div class="ink-spinner" />
            <span style="margin-left: var(--ink-space-sm);">Loading review items...</span>
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

        {/* Empty state */}
        {!loading && !error && items.length === 0 && (
          <div class="ink-empty">
            <div class="ink-empty-icon">🔍</div>
            <div class="ink-empty-title">Nothing to review</div>
            <p>All items have been processed. Check back later.</p>
          </div>
        )}

        {/* Decision table */}
        {!loading && items.length > 0 && (
          <div class="ink-section">
            <div class="ink-review-table-wrap">
              <table class="ink-review-table">
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>Source Candidate</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const id = item.id || item.issue_id;
                    const isProcessing = processingIds.has(id);
                    return (
                      <tr key={id || Math.random()}>
                        <td>
                          <div class="ink-review-issue-name">
                            {item.issue_name || item.issue || item.title || "Unknown"}
                          </div>
                          {item.series_name && <div class="ink-mini">{item.series_name}</div>}
                          {item.issue_number && <div class="ink-mini">#{item.issue_number}</div>}
                        </td>
                        <td>
                          <div class="ink-review-source">
                            {item.source_candidate || item.source || item.candidate || "—"}
                          </div>
                          {item.source_info && <div class="ink-mini">{item.source_info}</div>}
                        </td>
                        <td>
                          <div class="ink-review-actions">
                            <button
                              class="ink-btn-primary ink-btn-sm"
                              onClick={() => this._handleApprove(item)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? <span class="ink-spinner" /> : null}
                              Approve
                            </button>
                            <button
                              class="ink-btn-ghost ink-btn-sm"
                              onClick={() => this._handleIgnore(item)}
                              disabled={isProcessing}
                            >
                              Ignore
                            </button>
                            <button
                              class="ink-btn-danger ink-btn-sm"
                              onClick={() => this._handleBadMatch(item)}
                              disabled={isProcessing}
                            >
                              Bad Match
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pack Review State */}
        {packReviewState && (
          <div class="ink-review-pack">
            <div class="ink-section">
              <div class="ink-section-head">
                <h3>Pack Review</h3>
              </div>
              <div class="ink-section-body">
                {packReviewState.packs && packReviewState.packs.length > 0 ? (
                  packReviewState.packs.map((pack, idx) => (
                    <div class="ink-review-pack-item" key={pack.id || idx}>
                      <div>
                        <strong>{pack.name || pack.title || `Pack #${idx + 1}`}</strong>
                        {pack.size && (
                          <span class="ink-mini" style="margin-left: var(--ink-space-sm);">
                            {pack.size}
                          </span>
                        )}
                      </div>
                      <span
                        class={`ink-pill ${pack.status === "ready" ? "ink-pill-success" : pack.status === "pending" ? "ink-pill-warning" : "ink-pill-muted"}`}
                      >
                        {pack.status || "unknown"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p class="ink-mini">No packs pending review.</p>
                )}
                {packReviewState.message && (
                  <p style="margin-top: var(--ink-space-sm); font-size: var(--ink-text-sm); color: var(--ink-text-secondary);">
                    {packReviewState.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SLSKD Probe Data */}
        {slskdProbeData && (
          <div class="ink-review-slskd">
            <div class="ink-section">
              <div class="ink-section-head">
                <h3>SLSKD Probe</h3>
              </div>
              <div class="ink-section-body">
                <div class="ink-review-slskd-data">
                  {Object.entries(slskdProbeData).map(([key, value]) => {
                    if (key === "id" || key.startsWith("_")) return null;
                    return (
                      <div class="ink-review-slskd-item" key={key}>
                        <div class="ink-review-slskd-item-label">{key.replace(/_/g, " ")}</div>
                        <div class="ink-review-slskd-item-value">
                          {typeof value === "boolean" ? (
                            <span class={`ink-pill ${value ? "ink-pill-success" : "ink-pill-muted"}`}>
                              {String(value)}
                            </span>
                          ) : (
                            String(value)
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export { ManualReviewPage };
export default ManualReviewPage;
