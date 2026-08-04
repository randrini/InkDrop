/**
 * InkDrop — SystemPage
 * Shows version, build, health status with sub-navigation for About, Health, Tasks, Logs.
 */

import { h, Component } from "preact";
import api from "../api/client.jsx";
import { toast } from "../main.jsx";

const styles = `
.ink-system-subnav {
  display: flex;
  gap: var(--ink-space-xs);
  margin-bottom: var(--ink-space-xl);
  border-bottom: 1px solid var(--ink-border-subtle);
  padding-bottom: 0;
  overflow-x: auto;
}
.ink-system-subnav button {
  min-height: 36px;
  padding: var(--ink-space-sm) var(--ink-space-lg);
  font-size: var(--ink-text-sm);
  font-weight: 500;
  color: var(--ink-text-secondary);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  cursor: pointer;
  transition: color var(--ink-transition-fast), border-color var(--ink-transition-fast);
  white-space: nowrap;
}
.ink-system-subnav button:hover {
  color: var(--ink-text-primary);
  background: transparent;
}
.ink-system-subnav button.ink-system-subnav-active {
  color: var(--ink-accent-gold);
  border-bottom-color: var(--ink-accent-gold);
}
.ink-system-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--ink-space-lg);
}
.ink-system-stat {
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
  padding: var(--ink-space-lg);
}
.ink-system-stat-label {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--ink-space-xs);
}
.ink-system-stat-value {
  font-size: var(--ink-text-lg);
  font-weight: 600;
  color: var(--ink-text-primary);
  font-family: var(--ink-font-display);
}
.ink-system-stat-value.ink-system-version {
  font-family: var(--ink-font-mono);
  font-size: var(--ink-text-base);
}
.ink-system-health-list {
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-sm);
}
.ink-system-health-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ink-space-sm) var(--ink-space-md);
  background: var(--ink-bg-elevated);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-md);
  font-size: var(--ink-text-sm);
}
.ink-system-health-name {
  font-weight: 500;
}
.ink-system-tasks {
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-sm);
}
.ink-system-task {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ink-space-md) var(--ink-space-lg);
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-md);
  font-size: var(--ink-text-sm);
}
.ink-system-task-name {
  font-weight: 500;
}
.ink-system-logs-area {
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-md);
}
.ink-system-logs-actions {
  display: flex;
  gap: var(--ink-space-sm);
  flex-wrap: wrap;
}
.ink-system-update {
  margin-top: var(--ink-space-xl);
}
@media (max-width: 768px) {
  .ink-system-grid {
    grid-template-columns: 1fr;
  }
  .ink-system-subnav {
    gap: 0;
  }
  .ink-system-subnav button {
    padding: var(--ink-space-sm) var(--ink-space-md);
    font-size: var(--ink-text-xs);
  }
}
`;

const TABS = ["about", "health", "tasks", "logs"];

class SystemPage extends Component {
  constructor() {
    super();
    this.state = {
      activeTab: "about",
      loading: true,
      error: null,
      version: null,
      health: null,
      updateStatus: null,
      logsDownloading: false,
    };
    this._loadData = this._loadData.bind(this);
    this._handleTabChange = this._handleTabChange.bind(this);
    this._handleDownloadLogs = this._handleDownloadLogs.bind(this);
  }

  componentDidMount() {
    this._loadData();
  }

  async _loadData() {
    this.setState({ loading: true, error: null });
    try {
      const [versionData, healthData] = await Promise.all([api.system.version(), api.system.health()]);

      this.setState({
        version: versionData.ok ? versionData.state || versionData : null,
        health: healthData.ok ? healthData.state || healthData : null,
        loading: false,
      });

      // Load update status in background
      this._loadUpdateStatus();
    } catch (err) {
      this.setState({ error: err.message || "Failed to load system info", loading: false });
    }
  }

  async _loadUpdateStatus() {
    try {
      const data = await api.system.updateStatus();
      if (data.ok) {
        this.setState({ updateStatus: data.state || data });
      }
    } catch {
      // update status is optional
    }
  }

  _handleTabChange(tab) {
    this.setState({ activeTab: tab });
  }

  async _handleDownloadLogs() {
    this.setState({ logsDownloading: true });
    try {
      const data = await api.system.logs();
      if (data && data.ok && data.content_base64) {
        // Decode base64 and trigger browser download
        const binaryStr = atob(data.content_base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/gzip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || "inkdrop-logs.tar.gz";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast("Logs downloaded", "success");
      } else if (data && !data.ok) {
        toast(data.error || "Failed to download logs", "error");
      } else {
        toast("Logs download returned unexpected format", "warning");
      }
    } catch (err) {
      toast(err.message || "Failed to download logs", "error");
    } finally {
      this.setState({ logsDownloading: false });
    }
  }

  _renderHealthStatus(status) {
    if (!status) return <span class="ink-pill ink-pill-muted">unknown</span>;
    const s = String(status).toLowerCase();
    if (s === "ok" || s === "healthy" || s === "pass") return <span class="ink-pill ink-pill-success">OK</span>;
    if (s === "warn" || s === "warning" || s === "degraded")
      return <span class="ink-pill ink-pill-warning">Warning</span>;
    if (s === "error" || s === "fail" || s === "critical") return <span class="ink-pill ink-pill-danger">Error</span>;
    return <span class="ink-pill ink-pill-muted">{status}</span>;
  }

  render() {
    const { activeTab, loading, error, version, health, updateStatus, logsDownloading } = this.state;

    return (
      <div class="ink-page">
        <style>{styles}</style>

        {/* Sub-navigation */}
        <div class="ink-system-subnav">
          {TABS.map((tab) => (
            <button
              key={tab}
              class={activeTab === tab ? "ink-system-subnav-active" : ""}
              onClick={() => this._handleTabChange(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {loading && (
          <div class="ink-loading">
            <div class="ink-spinner" />
            <span style="margin-left: var(--ink-space-sm);">Loading system info...</span>
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

        {/* ── About Tab ─────────────────────────────────────────────── */}
        {!loading && activeTab === "about" && (
          <div>
            <div class="ink-system-grid">
              {version && (
                <>
                  {version.version != null && (
                    <div class="ink-system-stat">
                      <div class="ink-system-stat-label">Version</div>
                      <div class="ink-system-stat-value ink-system-version">{version.version}</div>
                    </div>
                  )}
                  {version.build_number != null && (
                    <div class="ink-system-stat">
                      <div class="ink-system-stat-label">Build</div>
                      <div class="ink-system-stat-value">{version.build_number}</div>
                    </div>
                  )}
                  {version.build_date != null && (
                    <div class="ink-system-stat">
                      <div class="ink-system-stat-label">Build Date</div>
                      <div class="ink-system-stat-value" style="font-size: var(--ink-text-sm);">
                        {version.build_date}
                      </div>
                    </div>
                  )}
                  {version.commit != null && (
                    <div class="ink-system-stat">
                      <div class="ink-system-stat-label">Commit</div>
                      <div class="ink-system-stat-value ink-system-version" style="font-size: var(--ink-text-xs);">
                        {version.commit}
                      </div>
                    </div>
                  )}
                  {version.branch != null && (
                    <div class="ink-system-stat">
                      <div class="ink-system-stat-label">Branch</div>
                      <div class="ink-system-stat-value" style="font-size: var(--ink-text-sm);">
                        {version.branch}
                      </div>
                    </div>
                  )}
                  {version.platform != null && (
                    <div class="ink-system-stat">
                      <div class="ink-system-stat-label">Platform</div>
                      <div class="ink-system-stat-value" style="font-size: var(--ink-text-sm);">
                        {version.platform}
                      </div>
                    </div>
                  )}
                  {version.python_version != null && (
                    <div class="ink-system-stat">
                      <div class="ink-system-stat-label">Python</div>
                      <div class="ink-system-stat-value" style="font-size: var(--ink-text-sm);">
                        {version.python_version}
                      </div>
                    </div>
                  )}
                </>
              )}
              {!version && (
                <div class="ink-system-stat">
                  <div class="ink-system-stat-label">Version</div>
                  <div class="ink-system-stat-value" style="color: var(--ink-text-muted);">
                    Unavailable
                  </div>
                </div>
              )}
            </div>

            {/* Update Status */}
            {updateStatus && (
              <div class="ink-system-update">
                <div class="ink-section">
                  <div class="ink-section-head">
                    <h3>Update Status</h3>
                    <button class="ink-btn-ghost ink-btn-sm" onClick={() => this._loadUpdateStatus()}>
                      ↻ Check
                    </button>
                  </div>
                  <div class="ink-section-body">
                    <div class="ink-system-grid">
                      {updateStatus.current_version != null && (
                        <div class="ink-system-stat">
                          <div class="ink-system-stat-label">Current</div>
                          <div class="ink-system-stat-value ink-system-version">{updateStatus.current_version}</div>
                        </div>
                      )}
                      {updateStatus.latest_version != null && (
                        <div class="ink-system-stat">
                          <div class="ink-system-stat-label">Latest</div>
                          <div class="ink-system-stat-value ink-system-version">{updateStatus.latest_version}</div>
                        </div>
                      )}
                      {updateStatus.update_available != null && (
                        <div class="ink-system-stat">
                          <div class="ink-system-stat-label">Status</div>
                          <div class="ink-system-stat-value">
                            {updateStatus.update_available ? (
                              <span class="ink-pill ink-pill-warning">Update Available</span>
                            ) : (
                              <span class="ink-pill ink-pill-success">Up to Date</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {updateStatus.message && (
                      <p style="margin-top: var(--ink-space-md); font-size: var(--ink-text-sm); color: var(--ink-text-secondary);">
                        {updateStatus.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Health Tab ───────────────────────────────────────────── */}
        {!loading && activeTab === "health" && (
          <div>
            {health ? (
              <div class="ink-section">
                <div class="ink-section-head">
                  <h3>System Health</h3>
                  {health.overall_status != null && this._renderHealthStatus(health.overall_status)}
                </div>
                <div class="ink-section-body">
                  {health.checks && health.checks.length > 0 ? (
                    <div class="ink-system-health-list">
                      {health.checks.map((check, idx) => (
                        <div class="ink-system-health-item" key={check.name || check.id || idx}>
                          <span class="ink-system-health-name">
                            {check.name || check.component || check.label || "Check"}
                          </span>
                          <div>
                            {this._renderHealthStatus(check.status || check.result)}
                            {check.message && (
                              <span class="ink-mini" style="margin-left: var(--ink-space-sm);">
                                {check.message}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div class="ink-system-grid">
                      {Object.entries(health).map(([key, value]) => {
                        if (key === "overall_status" || key === "checks" || key.startsWith("_")) return null;
                        return (
                          <div class="ink-system-stat" key={key}>
                            <div class="ink-system-stat-label">{key.replace(/_/g, " ")}</div>
                            <div class="ink-system-stat-value" style="font-size: var(--ink-text-sm);">
                              {typeof value === "boolean"
                                ? this._renderHealthStatus(value ? "ok" : "error")
                                : String(value)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {health.message && (
                    <p style="margin-top: var(--ink-space-md); font-size: var(--ink-text-sm); color: var(--ink-text-secondary);">
                      {health.message}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div class="ink-empty">
                <div class="ink-empty-icon">🖥️</div>
                <div class="ink-empty-title">Health data unavailable</div>
                <p>Could not retrieve system health information.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tasks Tab ────────────────────────────────────────────── */}
        {!loading && activeTab === "tasks" && (
          <div>
            {health && health.tasks && health.tasks.length > 0 ? (
              <div class="ink-section">
                <div class="ink-section-head">
                  <h3>Background Tasks</h3>
                </div>
                <div class="ink-section-body">
                  <div class="ink-system-tasks">
                    {health.tasks.map((task, idx) => (
                      <div class="ink-system-task" key={task.id || task.name || idx}>
                        <div>
                          <div class="ink-system-task-name">{task.name || task.title || `Task #${idx + 1}`}</div>
                          {task.description && <div class="ink-mini">{task.description}</div>}
                        </div>
                        <div style="display: flex; align-items: center; gap: var(--ink-space-sm);">
                          {task.progress != null && (
                            <span style="font-size: var(--ink-text-xs); color: var(--ink-text-muted);">
                              {task.progress}%
                            </span>
                          )}
                          <span
                            class={`ink-pill ${task.status === "running" ? "ink-pill-info" : task.status === "completed" ? "ink-pill-success" : task.status === "failed" ? "ink-pill-danger" : task.status === "pending" ? "ink-pill-warning" : "ink-pill-muted"}`}
                          >
                            {task.status || "unknown"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div class="ink-empty">
                <div class="ink-empty-icon">📋</div>
                <div class="ink-empty-title">No active tasks</div>
                <p>There are no background tasks running.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Logs Tab ────────────────────────────────────────────── */}
        {!loading && activeTab === "logs" && (
          <div>
            <div class="ink-section">
              <div class="ink-section-head">
                <h3>Logs</h3>
              </div>
              <div class="ink-section-body">
                <div class="ink-system-logs-area">
                  <p style="font-size: var(--ink-text-sm); color: var(--ink-text-secondary);">
                    Download the application logs for troubleshooting and diagnostics.
                  </p>
                  <div class="ink-system-logs-actions">
                    <button class="ink-btn-primary" onClick={this._handleDownloadLogs} disabled={logsDownloading}>
                      {logsDownloading ? <span class="ink-spinner" /> : null}
                      {logsDownloading ? "Downloading..." : "Download Logs"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export { SystemPage };
export default SystemPage;
