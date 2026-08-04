/**
 * InkDrop — ManualReviewPage
 * Shows a decision table for items needing manual review.
 * Supports Approve, Ignore, Bad Match, Add Alias, Resolve Noop decisions
 * plus Pack Review, Unmatched Downloads, SAB Failures, and Manual Intake sections.
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
.ink-review-section {
  margin-top: var(--ink-space-xl);
}
.ink-review-section summary {
  cursor: pointer;
  font-weight: 600;
  font-size: var(--ink-text-base);
  padding: var(--ink-space-sm) 0;
  user-select: none;
}
.ink-review-section summary:hover {
  color: var(--ink-text-primary);
}
.ink-review-section[open] summary {
  margin-bottom: var(--ink-space-md);
}
.ink-review-section-content {
  padding: 0 0 var(--ink-space-md) 0;
}
.ink-review-unmatched-item,
.ink-review-failure-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ink-space-sm) var(--ink-space-md);
  border-bottom: 1px solid var(--ink-border-subtle);
  font-size: var(--ink-text-sm);
  gap: var(--ink-space-sm);
  flex-wrap: wrap;
}
.ink-review-unmatched-item:last-child,
.ink-review-failure-item:last-child {
  border-bottom: none;
}
.ink-review-unmatched-info,
.ink-review-failure-info {
  display: flex;
  align-items: center;
  gap: var(--ink-space-md);
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}
.ink-review-unmatched-name,
.ink-review-failure-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}
.ink-review-unmatched-meta,
.ink-review-failure-meta {
  color: var(--ink-text-muted);
  font-size: var(--ink-text-xs);
  white-space: nowrap;
}
.ink-review-section-actions {
  display: flex;
  gap: var(--ink-space-xs);
  flex-wrap: nowrap;
  align-items: center;
}
.ink-review-section-actions button {
  min-height: 28px;
  padding: var(--ink-space-xs) var(--ink-space-sm);
  font-size: var(--ink-text-xs);
  white-space: nowrap;
}
.ink-review-intake-info {
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-sm);
  padding: var(--ink-space-sm) var(--ink-space-md);
  font-size: var(--ink-text-sm);
}
.ink-review-intake-path {
  font-family: var(--ink-font-mono, monospace);
  font-size: var(--ink-text-xs);
  color: var(--ink-text-secondary);
  background: var(--ink-bg-elevated);
  padding: var(--ink-space-xs) var(--ink-space-sm);
  border-radius: var(--ink-radius-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ink-review-intake-actions {
  display: flex;
  gap: var(--ink-space-sm);
  margin-top: var(--ink-space-sm);
}
.ink-review-facts-grid {
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-xs);
  font-size: var(--ink-text-sm);
  margin-bottom: var(--ink-space-md);
}
.ink-review-facts-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--ink-space-md);
}
.ink-review-facts-label {
  color: var(--ink-text-muted);
  font-weight: 500;
  white-space: nowrap;
}
.ink-review-facts-value {
  color: var(--ink-text-primary);
  word-break: break-word;
}
.ink-review-safety-note {
  background: var(--ink-bg-warning, #fff3cd);
  border: 1px solid var(--ink-border-warning, #ffc107);
  border-radius: var(--ink-radius-md);
  padding: var(--ink-space-md);
  margin-bottom: var(--ink-space-md);
  font-size: var(--ink-text-sm);
  color: var(--ink-text-warning, #856404);
}
.ink-review-safety-note-label {
  font-weight: 600;
  text-transform: uppercase;
  font-size: var(--ink-text-xs);
  letter-spacing: 0.05em;
  margin-bottom: var(--ink-space-xs);
}
.ink-review-detail-actions {
  display: flex;
  gap: var(--ink-space-xs);
  flex-wrap: wrap;
}
.ink-review-detail-actions button {
  min-height: 28px;
  padding: var(--ink-space-xs) var(--ink-space-sm);
  font-size: var(--ink-text-xs);
  white-space: nowrap;
}
.ink-review-alias-input {
  display: flex;
  gap: var(--ink-space-xs);
  align-items: center;
}
.ink-review-alias-input input {
  min-height: 28px;
  font-size: var(--ink-text-xs);
  padding: var(--ink-space-xs) var(--ink-space-sm);
  border: 1px solid var(--ink-border-default);
  border-radius: var(--ink-radius-sm);
  background: var(--ink-bg-input);
  color: var(--ink-text-primary);
  width: 180px;
}
.ink-review-alias-input input:focus {
  outline: none;
  border-color: var(--ink-accent);
}
.ink-review-pack-detail {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-secondary);
  margin-top: var(--ink-space-xs);
  padding: var(--ink-space-xs) var(--ink-space-md);
  background: var(--ink-bg-elevated);
  border-radius: var(--ink-radius-sm);
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
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
      // Detail modal
      detailItem: null,
      // Pack review
      packReviewLoading: false,
      packReviewDetail: null,
      packReviewDetailLoading: false,
      // Unmatched downloads
      unmatchedItems: null,
      unmatchedLoading: false,
      // SAB failures
      sabFailures: null,
      sabFailuresLoading: false,
      // Manual intake
      intakeInfo: null,
      intakeLoading: false,
      // Alias input
      aliasInputs: {},
    };
    this._mounted = false;
    this._loadData = this._loadData.bind(this);
    this._handleApprove = this._handleApprove.bind(this);
    this._handleIgnore = this._handleIgnore.bind(this);
    this._handleBadMatch = this._handleBadMatch.bind(this);
    this._handleResolveNoop = this._handleResolveNoop.bind(this);
    this._handleAddAlias = this._handleAddAlias.bind(this);
    this._handleApprovePack = this._handleApprovePack.bind(this);
    this._openDetail = this._openDetail.bind(this);
    this._closeDetail = this._closeDetail.bind(this);
    this._loadPackReview = this._loadPackReview.bind(this);
    this._handlePackInspect = this._handlePackInspect.bind(this);
    this._handlePackImport = this._handlePackImport.bind(this);
    this._handlePackClear = this._handlePackClear.bind(this);
    this._handlePackAutoImport = this._handlePackAutoImport.bind(this);
    this._handlePackRefresh = this._handlePackRefresh.bind(this);
    this._loadUnmatched = this._loadUnmatched.bind(this);
    this._handleUnmatchedImport = this._handleUnmatchedImport.bind(this);
    this._handleUnmatchedQuarantine = this._handleUnmatchedQuarantine.bind(this);
    this._loadSabFailures = this._loadSabFailures.bind(this);
    this._handleSabLearn = this._handleSabLearn.bind(this);
    this._loadIntake = this._loadIntake.bind(this);
    this._handleIntakePreview = this._handleIntakePreview.bind(this);
    this._handleIntakeProcess = this._handleIntakeProcess.bind(this);
  }

  componentDidMount() {
    this._mounted = true;
    this._loadData();
    this._loadPackReview();
    this._loadUnmatched();
    this._loadSabFailures();
    this._loadIntake();
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  _safeSetState(update) {
    if (this._mounted) this.setState(update);
  }

  // ── Main data load ────────────────────────────────────────────────

  async _loadData() {
    this.setState({ loading: true, error: null });
    try {
      const data = await api.manualReview.list();
      if (data.ok) {
        this._safeSetState({
          items: data.items || data.results || data.rows || [],
          packReviewState: data.pack_review_state || data.pack_review || null,
          slskdProbeData: data.slskd_probe || data.slskd || null,
          loading: false,
        });
      } else {
        this._safeSetState({ error: data.error || "Failed to load review items", loading: false });
      }
    } catch (err) {
      this._safeSetState({ error: err.message || "Failed to load review items", loading: false });
    }
  }

  // ── Decision handlers ──────────────────────────────────────────────

  async _handleDecision(action, id, extra) {
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
      } else if (action === "resolve_noop") {
        data = await api.manualReview.resolveNoop();
      } else if (action === "add_alias") {
        data = await api.manualReview.addAlias({ id, alias: extra?.alias || "" });
      } else if (action === "approve_pack") {
        data = await api.manualReview.approvePack({ id });
      }

      if (data && data.ok) {
        const labels = {
          approve: "Approved",
          ignore: "Ignored",
          bad_match: "Marked as bad match",
          resolve_noop: "Resolved as no-op",
          add_alias: "Alias added",
          approve_pack: "Pack approved",
        };
        toast(labels[action] || `${action} successfully`, "success");
        this.setState((prev) => ({
          items: prev.items.filter((item) => (item.id || item.issue_id) !== id),
          detailItem:
            prev.detailItem && (prev.detailItem.id || prev.detailItem.issue_id) === id ? null : prev.detailItem,
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

  _handleResolveNoop(item) {
    this._handleDecision("resolve_noop", item.id || item.issue_id);
  }

  _handleAddAlias(item) {
    const id = item.id || item.issue_id;
    const alias = this.state.aliasInputs[id] || "";
    if (!alias.trim()) {
      toast("Please enter an alias name", "error");
      return;
    }
    this._handleDecision("add_alias", id, { alias: alias.trim() });
    this.setState((prev) => {
      const next = { ...prev.aliasInputs };
      delete next[id];
      return { aliasInputs: next };
    });
  }

  _handleApprovePack(item) {
    this._handleDecision("approve_pack", item.id || item.issue_id);
  }

  // ── Detail modal ──────────────────────────────────────────────────

  _openDetail(item) {
    this.setState({ detailItem: item });
  }

  _closeDetail() {
    this.setState({ detailItem: null });
  }

  // ── Pack Review ──────────────────────────────────────────────────

  async _loadPackReview() {
    this.setState({ packReviewLoading: true });
    try {
      const data = await api.packReview.state();
      if (data.ok) {
        this._safeSetState({ packReviewState: data, packReviewLoading: false });
      } else {
        this._safeSetState({ packReviewLoading: false });
      }
    } catch (err) {
      this._safeSetState({ packReviewLoading: false });
    }
  }

  async _handlePackInspect(packPath) {
    this.setState({ packReviewDetailLoading: true, packReviewDetail: null });
    try {
      const data = await api.packReview.inspect({ pack_path: packPath });
      if (data.ok) {
        this._safeSetState({ packReviewDetail: data, packReviewDetailLoading: false });
      } else {
        toast(data?.error || "Failed to inspect pack", "error");
        this._safeSetState({ packReviewDetailLoading: false });
      }
    } catch (err) {
      toast(err.message || "Failed to inspect pack", "error");
      this._safeSetState({ packReviewDetailLoading: false });
    }
  }

  async _handlePackImport(packPath) {
    try {
      const data = await api.packReview.importPack({ pack_path: packPath });
      if (data.ok) {
        toast("Pack imported successfully", "success");
        this._loadPackReview();
      } else {
        toast(data?.error || "Failed to import pack", "error");
      }
    } catch (err) {
      toast(err.message || "Failed to import pack", "error");
    }
  }

  async _handlePackClear(packPath) {
    try {
      const data = await api.packReview.clear({ pack_path: packPath });
      if (data.ok) {
        toast("Pack cleared", "success");
        this._loadPackReview();
      } else {
        toast(data?.error || "Failed to clear pack", "error");
      }
    } catch (err) {
      toast(err.message || "Failed to clear pack", "error");
    }
  }

  async _handlePackAutoImport() {
    try {
      const data = await api.packReview.autoImport();
      if (data.ok) {
        toast("Auto-import completed", "success");
        this._loadPackReview();
      } else {
        toast(data?.error || "Auto-import failed", "error");
      }
    } catch (err) {
      toast(err.message || "Auto-import failed", "error");
    }
  }

  async _handlePackRefresh() {
    try {
      const data = await api.packReview.refresh();
      if (data.ok) {
        toast("Pack review refreshed", "success");
        this._loadPackReview();
      } else {
        toast(data?.error || "Refresh failed", "error");
      }
    } catch (err) {
      toast(err.message || "Refresh failed", "error");
    }
  }

  // ── Unmatched Downloads ──────────────────────────────────────────

  async _loadUnmatched() {
    this.setState({ unmatchedLoading: true });
    try {
      const data = await api.unmatched.list();
      if (data.ok) {
        this._safeSetState({
          unmatchedItems: data.items || data.results || data.rows || [],
          unmatchedLoading: false,
        });
      } else {
        this._safeSetState({ unmatchedLoading: false });
      }
    } catch (err) {
      this._safeSetState({ unmatchedLoading: false });
    }
  }

  async _handleUnmatchedImport(path) {
    try {
      const data = await api.unmatched.importItem({ path });
      if (data.ok) {
        toast("Item imported", "success");
        this._loadUnmatched();
      } else {
        toast(data?.error || "Failed to import item", "error");
      }
    } catch (err) {
      toast(err.message || "Failed to import item", "error");
    }
  }

  async _handleUnmatchedQuarantine(path) {
    try {
      const data = await api.unmatched.quarantine({ path });
      if (data.ok) {
        toast("Item quarantined", "success");
        this._loadUnmatched();
      } else {
        toast(data?.error || "Failed to quarantine item", "error");
      }
    } catch (err) {
      toast(err.message || "Failed to quarantine item", "error");
    }
  }

  // ── SAB Failures ─────────────────────────────────────────────────

  async _loadSabFailures() {
    this.setState({ sabFailuresLoading: true });
    try {
      const data = await api.sab.failures();
      if (data.ok) {
        this._safeSetState({
          sabFailures: data.items || data.results || data.rows || data.failures || [],
          sabFailuresLoading: false,
        });
      } else {
        this._safeSetState({ sabFailuresLoading: false });
      }
    } catch (err) {
      this._safeSetState({ sabFailuresLoading: false });
    }
  }

  async _handleSabLearn(id) {
    try {
      const data = await api.sab.learn({ id });
      if (data.ok) {
        toast("Learned from failure", "success");
        this._loadSabFailures();
      } else {
        toast(data?.error || "Failed to learn from failure", "error");
      }
    } catch (err) {
      toast(err.message || "Failed to learn from failure", "error");
    }
  }

  // ── Manual Intake ────────────────────────────────────────────────

  async _loadIntake() {
    this.setState({ intakeLoading: true });
    try {
      // Try to get inbox info from the imports reconcile endpoint or settings
      const data = await api.imports.reconcile();
      if (data.ok) {
        this._safeSetState({
          intakeInfo: data,
          intakeLoading: false,
        });
      } else {
        this._safeSetState({ intakeLoading: false });
      }
    } catch (err) {
      // Silently fail — intake info is optional
      this._safeSetState({ intakeLoading: false });
    }
  }

  async _handleIntakePreview() {
    try {
      const data = await api.imports.run({ mode: "preview" });
      if (data.ok) {
        toast("Preview completed", "success");
      } else {
        toast(data?.error || "Preview failed", "error");
      }
    } catch (err) {
      toast(err.message || "Preview failed", "error");
    }
  }

  async _handleIntakeProcess() {
    try {
      const data = await api.imports.run({ mode: "process" });
      if (data.ok) {
        toast("Import process started", "success");
      } else {
        toast(data?.error || "Process failed", "error");
      }
    } catch (err) {
      toast(err.message || "Process failed", "error");
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  _getItemId(item) {
    return item.id || item.issue_id;
  }

  _isPackItem(item) {
    return item.reason === "pack" || item.type === "pack" || item.item_type === "pack";
  }

  _getAllowedActions(item) {
    if (item.allowed_actions || item.available_actions) {
      return item.allowed_actions || item.available_actions;
    }
    // Default actions based on item type
    const actions = ["approve", "ignore", "bad_match"];
    if (this._isPackItem(item)) {
      actions.push("approve_pack");
    }
    actions.push("resolve_noop", "add_alias");
    return actions;
  }

  _formatBytes(bytes) {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  _formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  }

  // ── Render ───────────────────────────────────────────────────────

  render() {
    const {
      loading,
      error,
      items,
      packReviewState,
      slskdProbeData,
      processingIds,
      detailItem,
      packReviewLoading,
      packReviewDetail,
      packReviewDetailLoading,
      unmatchedItems,
      unmatchedLoading,
      sabFailures,
      sabFailuresLoading,
      intakeInfo,
      intakeLoading,
      aliasInputs,
    } = this.state;

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
                    const id = this._getItemId(item);
                    const isProcessing = processingIds.has(id);
                    const allowedActions = this._getAllowedActions(item);
                    return (
                      <tr key={id || Math.random()}>
                        <td>
                          <div class="ink-review-issue-name">
                            {item.issue_name || item.issue || item.title || "Unknown"}
                          </div>
                          {item.series_name && <div class="ink-mini">{item.series_name}</div>}
                          {item.issue_number && <div class="ink-mini">#{item.issue_number}</div>}
                          {this._isPackItem(item) && (
                            <span class="ink-pill ink-pill-info" style="font-size: var(--ink-text-xs);">
                              Pack
                            </span>
                          )}
                        </td>
                        <td>
                          <div class="ink-review-source">
                            {item.source_candidate || item.source || item.candidate || "—"}
                          </div>
                          {item.source_info && <div class="ink-mini">{item.source_info}</div>}
                        </td>
                        <td>
                          <div class="ink-review-actions">
                            {allowedActions.includes("approve") && (
                              <button
                                class="ink-btn-primary ink-btn-sm"
                                onClick={() => this._handleApprove(item)}
                                disabled={isProcessing}
                              >
                                {isProcessing ? <span class="ink-spinner" /> : null}
                                Approve
                              </button>
                            )}
                            {allowedActions.includes("ignore") && (
                              <button
                                class="ink-btn-ghost ink-btn-sm"
                                onClick={() => this._handleIgnore(item)}
                                disabled={isProcessing}
                              >
                                Ignore
                              </button>
                            )}
                            {allowedActions.includes("bad_match") && (
                              <button
                                class="ink-btn-danger ink-btn-sm"
                                onClick={() => this._handleBadMatch(item)}
                                disabled={isProcessing}
                              >
                                Bad Match
                              </button>
                            )}
                            <button
                              class="ink-btn-ghost ink-btn-sm"
                              onClick={() => this._openDetail(item)}
                              disabled={isProcessing}
                            >
                              Inspect
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

        {/* Detail Modal */}
        {detailItem && this._renderDetailModal()}

        {/* Pack Review Section */}
        <details class="ink-review-section" open>
          <summary>Pack Review {packReviewState?.packs?.length ? `(${packReviewState.packs.length})` : ""}</summary>
          <div class="ink-review-section-content">
            {packReviewLoading ? (
              <div class="ink-loading">
                <div class="ink-spinner" />
                <span style="margin-left: var(--ink-space-sm);">Loading pack review...</span>
              </div>
            ) : packReviewState && packReviewState.packs && packReviewState.packs.length > 0 ? (
              <div class="ink-section">
                <div class="ink-section-body" style="padding: 0;">
                  {packReviewState.packs.map((pack, idx) => (
                    <div class="ink-review-pack-item" key={pack.id || pack.path || idx}>
                      <div style="flex: 1; min-width: 0;">
                        <strong>{pack.name || pack.title || `Pack #${idx + 1}`}</strong>
                        {pack.size && (
                          <span class="ink-mini" style="margin-left: var(--ink-space-sm);">
                            {this._formatBytes(pack.size)}
                          </span>
                        )}
                      </div>
                      <span
                        class={`ink-pill ${pack.status === "ready" ? "ink-pill-success" : pack.status === "pending" ? "ink-pill-warning" : "ink-pill-muted"}`}
                      >
                        {pack.status || "unknown"}
                      </span>
                      <div class="ink-review-section-actions" style="margin-left: var(--ink-space-sm);">
                        <button
                          class="ink-btn-ghost ink-btn-sm"
                          onClick={() => this._handlePackInspect(pack.path || pack.id)}
                        >
                          Inspect
                        </button>
                        <button
                          class="ink-btn-primary ink-btn-sm"
                          onClick={() => this._handlePackImport(pack.path || pack.id)}
                        >
                          Import
                        </button>
                        <button
                          class="ink-btn-danger ink-btn-sm"
                          onClick={() => this._handlePackClear(pack.path || pack.id)}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {packReviewDetailLoading && (
                  <div class="ink-loading" style="margin-top: var(--ink-space-sm);">
                    <div class="ink-spinner" />
                    <span style="margin-left: var(--ink-space-sm);">Loading pack details...</span>
                  </div>
                )}
                {packReviewDetail && packReviewDetail.detail && (
                  <div class="ink-review-pack-detail">
                    {typeof packReviewDetail.detail === "string"
                      ? packReviewDetail.detail
                      : JSON.stringify(packReviewDetail.detail, null, 2)}
                  </div>
                )}
                {packReviewState.message && (
                  <p style="margin-top: var(--ink-space-sm); font-size: var(--ink-text-sm); color: var(--ink-text-secondary); padding: 0 var(--ink-space-md);">
                    {packReviewState.message}
                  </p>
                )}
              </div>
            ) : (
              <p class="ink-mini" style="padding: 0 var(--ink-space-md);">
                No packs pending review.
              </p>
            )}
            <div
              class="ink-review-section-actions"
              style="margin-top: var(--ink-space-sm); padding: 0 var(--ink-space-md);"
            >
              <button class="ink-btn-ghost ink-btn-sm" onClick={this._handlePackAutoImport}>
                Auto-Import All
              </button>
              <button class="ink-btn-ghost ink-btn-sm" onClick={this._handlePackRefresh}>
                ↻ Refresh
              </button>
            </div>
          </div>
        </details>

        {/* Unmatched Downloads Section */}
        <details class="ink-review-section">
          <summary>Unmatched Downloads {unmatchedItems?.length ? `(${unmatchedItems.length})` : ""}</summary>
          <div class="ink-review-section-content">
            {unmatchedLoading ? (
              <div class="ink-loading">
                <div class="ink-spinner" />
                <span style="margin-left: var(--ink-space-sm);">Loading unmatched downloads...</span>
              </div>
            ) : unmatchedItems && unmatchedItems.length > 0 ? (
              <div class="ink-section">
                <div class="ink-section-body" style="padding: 0;">
                  {unmatchedItems.map((item, idx) => (
                    <div class="ink-review-unmatched-item" key={item.path || item.id || idx}>
                      <div class="ink-review-unmatched-info">
                        <span class="ink-review-unmatched-name">
                          {item.filename || item.name || item.path || "Unknown"}
                        </span>
                        {item.size ? (
                          <span class="ink-review-unmatched-meta">{this._formatBytes(item.size)}</span>
                        ) : null}
                        {item.date ? (
                          <span class="ink-review-unmatched-meta">{this._formatDate(item.date)}</span>
                        ) : null}
                        {item.status && (
                          <span class={`ink-pill ${item.status === "ready" ? "ink-pill-success" : "ink-pill-muted"}`}>
                            {item.status}
                          </span>
                        )}
                      </div>
                      <div class="ink-review-section-actions">
                        <button
                          class="ink-btn-primary ink-btn-sm"
                          onClick={() => this._handleUnmatchedImport(item.path)}
                        >
                          Import
                        </button>
                        <button
                          class="ink-btn-danger ink-btn-sm"
                          onClick={() => this._handleUnmatchedQuarantine(item.path)}
                        >
                          Quarantine
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p class="ink-mini" style="padding: 0 var(--ink-space-md);">
                No unmatched downloads.
              </p>
            )}
            <div
              class="ink-review-section-actions"
              style="margin-top: var(--ink-space-sm); padding: 0 var(--ink-space-md);"
            >
              <button class="ink-btn-ghost ink-btn-sm" onClick={this._loadUnmatched}>
                ↻ Refresh
              </button>
            </div>
          </div>
        </details>

        {/* SAB Failures Section */}
        <details class="ink-review-section">
          <summary>SAB Failures {sabFailures?.length ? `(${sabFailures.length})` : ""}</summary>
          <div class="ink-review-section-content">
            {sabFailuresLoading ? (
              <div class="ink-loading">
                <div class="ink-spinner" />
                <span style="margin-left: var(--ink-space-sm);">Loading SAB failures...</span>
              </div>
            ) : sabFailures && sabFailures.length > 0 ? (
              <div class="ink-section">
                <div class="ink-section-body" style="padding: 0;">
                  {sabFailures.map((failure, idx) => (
                    <div class="ink-review-failure-item" key={failure.id || idx}>
                      <div class="ink-review-failure-info">
                        <span class="ink-review-failure-name">{failure.name || failure.title || "Unknown"}</span>
                        {failure.error && (
                          <span class="ink-review-failure-meta" style="color: var(--ink-text-danger);">
                            {failure.error}
                          </span>
                        )}
                        {failure.date && <span class="ink-review-failure-meta">{this._formatDate(failure.date)}</span>}
                      </div>
                      <div class="ink-review-section-actions">
                        <button class="ink-btn-ghost ink-btn-sm" onClick={() => this._handleSabLearn(failure.id)}>
                          Learn
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p class="ink-mini" style="padding: 0 var(--ink-space-md);">
                No SAB failures.
              </p>
            )}
            <div
              class="ink-review-section-actions"
              style="margin-top: var(--ink-space-sm); padding: 0 var(--ink-space-md);"
            >
              <button class="ink-btn-ghost ink-btn-sm" onClick={this._loadSabFailures}>
                ↻ Refresh
              </button>
            </div>
          </div>
        </details>

        {/* Manual Intake Section */}
        <details class="ink-review-section">
          <summary>Manual Intake</summary>
          <div class="ink-review-section-content">
            {intakeLoading ? (
              <div class="ink-loading">
                <div class="ink-spinner" />
                <span style="margin-left: var(--ink-space-sm);">Loading intake info...</span>
              </div>
            ) : (
              <div class="ink-section">
                <div class="ink-section-body">
                  <div class="ink-review-intake-info">
                    {intakeInfo && (intakeInfo.comics_inbox || intakeInfo.ebooks_inbox) ? (
                      <>
                        {intakeInfo.comics_inbox && (
                          <div>
                            <span class="ink-mini">Comics Inbox:</span>
                            <div class="ink-review-intake-path">{intakeInfo.comics_inbox}</div>
                          </div>
                        )}
                        {intakeInfo.ebooks_inbox && (
                          <div>
                            <span class="ink-mini">Ebooks Inbox:</span>
                            <div class="ink-review-intake-path">{intakeInfo.ebooks_inbox}</div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p class="ink-mini">Inbox paths not available. Run reconcile to detect inboxes.</p>
                    )}
                    <div class="ink-review-intake-actions">
                      <button class="ink-btn-ghost ink-btn-sm" onClick={this._handleIntakePreview}>
                        Preview
                      </button>
                      <button class="ink-btn-primary ink-btn-sm" onClick={this._handleIntakeProcess}>
                        Process
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </details>

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

  // ── Detail Modal Render ──────────────────────────────────────────

  _renderDetailModal() {
    const item = this.state.detailItem;
    if (!item) return null;
    const id = this._getItemId(item);
    const isProcessing = this.state.processingIds.has(id);
    const allowedActions = this._getAllowedActions(item);
    const aliasValue = this.state.aliasInputs[id] || "";

    // Build facts from item.facts, item.detail, or item itself
    const facts = item.facts || item.detail || {};
    const factEntries =
      typeof facts === "object" && !Array.isArray(facts)
        ? Object.entries(facts).filter(([k]) => !k.startsWith("_"))
        : [];

    // Safety note
    const safetyNote = item.safety || item.safety_note;

    return (
      <div class="ink-dialog-backdrop" onClick={(e) => e.target === e.currentTarget && this._closeDetail()}>
        <div class="ink-dialog" style="max-width: 640px;">
          <div class="ink-dialog-header">
            <h2>Review Detail</h2>
            <div class="ink-mini" style="margin-top: var(--ink-space-xs);">
              {item.issue_name || item.issue || item.title || "Unknown"}
              {item.series_name ? ` — ${item.series_name}` : ""}
              {item.issue_number ? ` #${item.issue_number}` : ""}
            </div>
          </div>
          <div class="ink-dialog-body">
            {/* Facts grid */}
            {factEntries.length > 0 && (
              <div class="ink-review-facts-grid">
                {factEntries.map(([key, value]) => (
                  <div class="ink-review-facts-row" key={key}>
                    <span class="ink-review-facts-label">{key.replace(/_/g, " ")}</span>
                    <span class="ink-review-facts-value">
                      {typeof value === "boolean"
                        ? String(value)
                        : typeof value === "object" && value !== null
                          ? JSON.stringify(value)
                          : String(value ?? "—")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Also show top-level item fields that aren't already in facts */}
            {factEntries.length === 0 && (
              <div class="ink-review-facts-grid">
                {item.issue_name && (
                  <>
                    <div>
                      <span class="ink-review-facts-label">Issue</span>
                    </div>
                    <div>
                      <span class="ink-review-facts-value">{item.issue_name}</span>
                    </div>
                  </>
                )}
                {item.series_name && (
                  <>
                    <div>
                      <span class="ink-review-facts-label">Series</span>
                    </div>
                    <div>
                      <span class="ink-review-facts-value">{item.series_name}</span>
                    </div>
                  </>
                )}
                {item.issue_number && (
                  <>
                    <div>
                      <span class="ink-review-facts-label">Number</span>
                    </div>
                    <div>
                      <span class="ink-review-facts-value">#{item.issue_number}</span>
                    </div>
                  </>
                )}
                {item.source_candidate && (
                  <>
                    <div>
                      <span class="ink-review-facts-label">Source</span>
                    </div>
                    <div>
                      <span class="ink-review-facts-value">{item.source_candidate}</span>
                    </div>
                  </>
                )}
                {item.source_info && (
                  <>
                    <div>
                      <span class="ink-review-facts-label">Source Info</span>
                    </div>
                    <div>
                      <span class="ink-review-facts-value">{item.source_info}</span>
                    </div>
                  </>
                )}
                {item.reason && (
                  <>
                    <div>
                      <span class="ink-review-facts-label">Reason</span>
                    </div>
                    <div>
                      <span class="ink-review-facts-value">{item.reason}</span>
                    </div>
                  </>
                )}
                {item.type && (
                  <>
                    <div>
                      <span class="ink-review-facts-label">Type</span>
                    </div>
                    <div>
                      <span class="ink-review-facts-value">{item.type}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Safety note */}
            {safetyNote && (
              <div class="ink-review-safety-note">
                <div class="ink-review-safety-note-label">⚠ Safety Note</div>
                <div>{safetyNote}</div>
              </div>
            )}

            {/* Actions */}
            <div style="margin-top: var(--ink-space-md);">
              <div class="ink-mini" style="margin-bottom: var(--ink-space-xs);">
                Actions
              </div>
              <div class="ink-review-detail-actions">
                {allowedActions.includes("approve") && (
                  <button
                    class="ink-btn-primary ink-btn-sm"
                    onClick={() => this._handleApprove(item)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <span class="ink-spinner" /> : null}
                    Approve
                  </button>
                )}
                {allowedActions.includes("ignore") && (
                  <button
                    class="ink-btn-ghost ink-btn-sm"
                    onClick={() => this._handleIgnore(item)}
                    disabled={isProcessing}
                  >
                    Ignore
                  </button>
                )}
                {allowedActions.includes("bad_match") && (
                  <button
                    class="ink-btn-danger ink-btn-sm"
                    onClick={() => this._handleBadMatch(item)}
                    disabled={isProcessing}
                  >
                    Bad Match
                  </button>
                )}
                {allowedActions.includes("approve_pack") && (
                  <button
                    class="ink-btn-primary ink-btn-sm"
                    onClick={() => this._handleApprovePack(item)}
                    disabled={isProcessing}
                  >
                    Approve Pack
                  </button>
                )}
                {allowedActions.includes("resolve_noop") && (
                  <button
                    class="ink-btn-ghost ink-btn-sm"
                    onClick={() => this._handleResolveNoop(item)}
                    disabled={isProcessing}
                  >
                    Resolve Noop
                  </button>
                )}
                {allowedActions.includes("add_alias") && (
                  <div class="ink-review-alias-input">
                    <input
                      type="text"
                      placeholder="Alias name..."
                      value={aliasValue}
                      onInput={(e) =>
                        this.setState((prev) => ({
                          aliasInputs: { ...prev.aliasInputs, [id]: e.target.value },
                        }))
                      }
                      disabled={isProcessing}
                    />
                    <button
                      class="ink-btn-ghost ink-btn-sm"
                      onClick={() => this._handleAddAlias(item)}
                      disabled={isProcessing || !aliasValue.trim()}
                    >
                      Add Alias
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div class="ink-dialog-footer">
            <button class="ink-btn-ghost" onClick={this._closeDetail} type="button">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export { ManualReviewPage };
export default ManualReviewPage;
