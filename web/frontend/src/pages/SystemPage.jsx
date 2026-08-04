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
.ink-system-advanced {
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-lg);
}
.ink-system-advanced details {
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
  overflow: hidden;
}
.ink-system-advanced details summary {
  padding: var(--ink-space-md) var(--ink-space-lg);
  font-weight: 600;
  font-size: var(--ink-text-base);
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
}
.ink-system-advanced details summary::-webkit-details-marker {
  color: var(--ink-text-muted);
}
.ink-system-advanced details[open] summary {
  border-bottom: 1px solid var(--ink-border-subtle);
}
.ink-advanced-drawer-body {
  padding: var(--ink-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-md);
}
.ink-advanced-row {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
  flex-wrap: wrap;
}
.ink-advanced-row label {
  font-size: var(--ink-text-sm);
  font-weight: 500;
  color: var(--ink-text-secondary);
  min-width: 100px;
}
.ink-advanced-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--ink-text-sm);
}
.ink-advanced-table th {
  text-align: left;
  padding: var(--ink-space-xs) var(--ink-space-sm);
  border-bottom: 1px solid var(--ink-border-subtle);
  color: var(--ink-text-muted);
  font-weight: 500;
  text-transform: uppercase;
  font-size: var(--ink-text-xs);
  letter-spacing: 0.05em;
}
.ink-advanced-table td {
  padding: var(--ink-space-xs) var(--ink-space-sm);
  border-bottom: 1px solid var(--ink-border-subtle);
  color: var(--ink-text-primary);
}
.ink-advanced-table tr:last-child td {
  border-bottom: none;
}
.ink-advanced-pre {
  background: var(--ink-bg-elevated);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-md);
  padding: var(--ink-space-md);
  font-family: var(--ink-font-mono);
  font-size: var(--ink-text-xs);
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.ink-advanced-watch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ink-space-sm) var(--ink-space-md);
  background: var(--ink-bg-elevated);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-md);
  font-size: var(--ink-text-sm);
}
.ink-advanced-watch-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ink-advanced-watch-name {
  font-weight: 500;
}
.ink-advanced-watch-meta {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
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

const TABS = ["about", "health", "tasks", "logs", "advanced"];

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
      // Advanced tab state
      searchQuery: "",
      searchType: "comic",
      searchLimit: 10,
      searchResults: null,
      searchRaw: null,
      searching: false,
      probing: false,
      processingReady: false,
      freshSweeping: false,
      rssSweeping: false,
      comicscodesSweeping: false,
      importing: false,
      autopiloting: false,
      watchQuery: "",
      watchType: "comic",
      watchLimit: 10,
      watchAutoMonitor: true,
      watches: [],
      watchesLoading: false,
      addingWatch: false,
      scanningWatches: false,
    };
    this._loadData = this._loadData.bind(this);
    this._handleTabChange = this._handleTabChange.bind(this);
    this._handleDownloadLogs = this._handleDownloadLogs.bind(this);
    this._handleSearch = this._handleSearch.bind(this);
    this._handleProbeSources = this._handleProbeSources.bind(this);
    this._handleProcessReady = this._handleProcessReady.bind(this);
    this._handleFreshSweep = this._handleFreshSweep.bind(this);
    this._handleRssSweep = this._handleRssSweep.bind(this);
    this._handleComicscodesSweep = this._handleComicscodesSweep.bind(this);
    this._handleImportNow = this._handleImportNow.bind(this);
    this._handleAutopilotRun = this._handleAutopilotRun.bind(this);
    this._handleAddWatch = this._handleAddWatch.bind(this);
    this._handleScanWatches = this._handleScanWatches.bind(this);
    this._loadWatches = this._loadWatches.bind(this);
  }

  componentDidMount() {
    this._mounted = true;
    this._loadData();
  }

  componentWillUnmount() {
    this._mounted = false;
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

  // ── Advanced: Raw Search ──────────────────────────────────────

  async _handleSearch() {
    const { searchQuery, searchType, searchLimit } = this.state;
    if (!searchQuery.trim()) {
      toast("Please enter a search query", "warning");
      return;
    }
    this.setState({ searching: true, searchResults: null, searchRaw: null });
    try {
      const data = await api.search.search(searchQuery.trim(), searchType, searchLimit);
      if (this._mounted === false) return;
      if (data && data.ok) {
        const state = data.state || data;
        this.setState({
          searchResults: state.results || state.data || state,
          searchRaw: state,
        });
        toast("Search completed", "success");
      } else {
        this.setState({ searchRaw: data });
        toast(data?.error || "Search failed", "error");
      }
    } catch (err) {
      if (this._mounted === false) return;
      this.setState({ searchRaw: { error: err.message } });
      toast(err.message || "Search failed", "error");
    } finally {
      if (this._mounted) this.setState({ searching: false });
    }
  }

  async _handleProbeSources() {
    const { searchQuery, searchType } = this.state;
    if (!searchQuery.trim()) {
      toast("Please enter a search query", "warning");
      return;
    }
    this.setState({ probing: true, searchResults: null, searchRaw: null });
    try {
      const data = await api.search.sourceProbe({ query: searchQuery.trim(), type: searchType });
      if (this._mounted === false) return;
      if (data && data.ok) {
        const state = data.state || data;
        this.setState({
          searchResults: state.results || state.data || state,
          searchRaw: state,
        });
        toast("Source probe completed", "success");
      } else {
        this.setState({ searchRaw: data });
        toast(data?.error || "Source probe failed", "error");
      }
    } catch (err) {
      if (this._mounted === false) return;
      this.setState({ searchRaw: { error: err.message } });
      toast(err.message || "Source probe failed", "error");
    } finally {
      if (this._mounted) this.setState({ probing: false });
    }
  }

  // ── Advanced: Process Commands ─────────────────────────────────

  async _handleProcessReady() {
    this.setState({ processingReady: true });
    try {
      const data = await api.missing.process({ action: "process_ready" });
      if (this._mounted === false) return;
      if (data && data.ok) {
        toast("Process All Ready completed", "success");
      } else {
        toast(data?.error || "Process All Ready failed", "error");
      }
    } catch (err) {
      if (this._mounted === false) return;
      toast(err.message || "Process All Ready failed", "error");
    } finally {
      if (this._mounted) this.setState({ processingReady: false });
    }
  }

  async _handleFreshSweep() {
    this.setState({ freshSweeping: true });
    try {
      const data = await api.missing.fresh();
      if (this._mounted === false) return;
      if (data && data.ok) {
        toast("Fast Fresh Sweep completed", "success");
      } else {
        toast(data?.error || "Fast Fresh Sweep failed", "error");
      }
    } catch (err) {
      if (this._mounted === false) return;
      toast(err.message || "Fast Fresh Sweep failed", "error");
    } finally {
      if (this._mounted) this.setState({ freshSweeping: false });
    }
  }

  async _handleRssSweep() {
    this.setState({ rssSweeping: true });
    try {
      const data = await api.missing.rssDiscover({});
      if (this._mounted === false) return;
      if (data && data.ok) {
        toast("RSS Discovery Sweep completed", "success");
      } else {
        toast(data?.error || "RSS Discovery Sweep failed", "error");
      }
    } catch (err) {
      if (this._mounted === false) return;
      toast(err.message || "RSS Discovery Sweep failed", "error");
    } finally {
      if (this._mounted) this.setState({ rssSweeping: false });
    }
  }

  async _handleComicscodesSweep() {
    this.setState({ comicscodesSweeping: true });
    try {
      const data = await api.missing.comicscodesDiscover({});
      if (this._mounted === false) return;
      if (data && data.ok) {
        toast("ComicsCodes Sweep completed", "success");
      } else {
        toast(data?.error || "ComicsCodes Sweep failed", "error");
      }
    } catch (err) {
      if (this._mounted === false) return;
      toast(err.message || "ComicsCodes Sweep failed", "error");
    } finally {
      if (this._mounted) this.setState({ comicscodesSweeping: false });
    }
  }

  async _handleImportNow() {
    this.setState({ importing: true });
    try {
      const data = await api.imports.run({});
      if (this._mounted === false) return;
      if (data && data.ok) {
        toast("Import Now completed", "success");
      } else {
        toast(data?.error || "Import Now failed", "error");
      }
    } catch (err) {
      if (this._mounted === false) return;
      toast(err.message || "Import Now failed", "error");
    } finally {
      if (this._mounted) this.setState({ importing: false });
    }
  }

  async _handleAutopilotRun() {
    this.setState({ autopiloting: true });
    try {
      const data = await api.autopilot.run({});
      if (this._mounted === false) return;
      if (data && data.ok) {
        toast("Autopilot Run completed", "success");
      } else {
        toast(data?.error || "Autopilot Run failed", "error");
      }
    } catch (err) {
      if (this._mounted === false) return;
      toast(err.message || "Autopilot Run failed", "error");
    } finally {
      if (this._mounted) this.setState({ autopiloting: false });
    }
  }

  // ── Advanced: Source Watches ───────────────────────────────────

  async _loadWatches() {
    this.setState({ watchesLoading: true });
    try {
      const data = await api.watches.list();
      if (this._mounted === false) return;
      if (data && data.ok) {
        const state = data.state || data;
        this.setState({ watches: state.watches || state.data || state });
      } else {
        toast(data?.error || "Failed to load watches", "error");
      }
    } catch (err) {
      if (this._mounted === false) return;
      toast(err.message || "Failed to load watches", "error");
    } finally {
      if (this._mounted) this.setState({ watchesLoading: false });
    }
  }

  async _handleAddWatch() {
    const { watchQuery, watchType, watchLimit, watchAutoMonitor } = this.state;
    if (!watchQuery.trim()) {
      toast("Please enter a watch query", "warning");
      return;
    }
    this.setState({ addingWatch: true });
    try {
      const data = await api.watches.add({
        query: watchQuery.trim(),
        type: watchType,
        limit: watchLimit,
        autoGrab: watchAutoMonitor,
      });
      if (this._mounted === false) return;
      if (data && data.ok) {
        toast("Watch added", "success");
        this.setState({ watchQuery: "" });
        this._loadWatches();
      } else {
        toast(data?.error || "Failed to add watch", "error");
      }
    } catch (err) {
      if (this._mounted === false) return;
      toast(err.message || "Failed to add watch", "error");
    } finally {
      if (this._mounted) this.setState({ addingWatch: false });
    }
  }

  async _handleScanWatches() {
    this.setState({ scanningWatches: true });
    try {
      const data = await api.watches.scan({});
      if (this._mounted === false) return;
      if (data && data.ok) {
        toast("Scan All Watches completed", "success");
        this._loadWatches();
      } else {
        toast(data?.error || "Scan All Watches failed", "error");
      }
    } catch (err) {
      if (this._mounted === false) return;
      toast(err.message || "Scan All Watches failed", "error");
    } finally {
      if (this._mounted) this.setState({ scanningWatches: false });
    }
  }

  _renderSearchResults() {
    const { searchResults, searchRaw } = this.state;
    if (!searchResults && !searchRaw) return null;

    const results = Array.isArray(searchResults) ? searchResults : [];

    return (
      <div style="display: flex; flex-direction: column; gap: var(--ink-space-md);">
        {results.length > 0 && (
          <table class="ink-advanced-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Provider</th>
                <th>Size</th>
                <th>Age</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item, idx) => (
                <tr key={item.id || item.title || idx}>
                  <td>{item.title || item.name || "-"}</td>
                  <td>{item.provider || item.source || "-"}</td>
                  <td>{item.size != null ? item.size : "-"}</td>
                  <td>{item.age != null ? item.age : "-"}</td>
                  <td>{item.score != null ? item.score : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {searchRaw && (
          <details>
            <summary style="font-size: var(--ink-text-sm); font-weight: 500; cursor: pointer;">Raw Output</summary>
            <pre class="ink-advanced-pre">{JSON.stringify(searchRaw, null, 2)}</pre>
          </details>
        )}
      </div>
    );
  }

  _renderWatchesList() {
    const { watches, watchesLoading } = this.state;
    if (watchesLoading) {
      return (
        <div class="ink-loading">
          <div class="ink-spinner" />
          <span style="margin-left: var(--ink-space-sm);">Loading watches...</span>
        </div>
      );
    }
    if (!watches || (Array.isArray(watches) && watches.length === 0)) {
      return <p style="font-size: var(--ink-text-sm); color: var(--ink-text-muted);">No watches configured.</p>;
    }
    const list = Array.isArray(watches) ? watches : watches.watches || [];
    if (list.length === 0) {
      return <p style="font-size: var(--ink-text-sm); color: var(--ink-text-muted);">No watches configured.</p>;
    }
    return (
      <div style="display: flex; flex-direction: column; gap: var(--ink-space-sm);">
        {list.map((w, idx) => (
          <div class="ink-advanced-watch-item" key={w.id || w.name || idx}>
            <div class="ink-advanced-watch-info">
              <span class="ink-advanced-watch-name">{w.name || w.query || w.title || "Watch"}</span>
              <span class="ink-advanced-watch-meta">
                {w.type && <span>Type: {w.type} &middot; </span>}
                {w.autoGrab != null && <span>Auto-grab: {w.autoGrab ? "Yes" : "No"} &middot; </span>}
                {w.last_scan && <span>Last scan: {w.last_scan}</span>}
                {!w.last_scan && <span>Not scanned yet</span>}
              </span>
            </div>
            <span class={`ink-pill ${w.autoGrab ? "ink-pill-success" : "ink-pill-muted"}`}>
              {w.autoGrab ? "Auto" : "Manual"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  _renderAdvancedTab() {
    const {
      searchQuery,
      searchType,
      searchLimit,
      searching,
      probing,
      processingReady,
      freshSweeping,
      rssSweeping,
      comicscodesSweeping,
      importing,
      autopiloting,
      watchQuery,
      watchType,
      watchLimit,
      watchAutoMonitor,
      addingWatch,
      scanningWatches,
    } = this.state;

    return (
      <div class="ink-system-advanced">
        {/* ── Drawer 1: Raw Search ──────────────────────────────── */}
        <details>
          <summary>🔍 Raw Search</summary>
          <div class="ink-advanced-drawer-body">
            <div class="ink-advanced-row">
              <label for="search-query">Search Query</label>
              <input
                id="search-query"
                class="ink-field"
                type="text"
                value={searchQuery}
                onInput={(e) => this.setState({ searchQuery: e.target.value })}
                placeholder="Enter search term..."
                style="flex: 1;"
              />
            </div>
            <div class="ink-advanced-row">
              <label for="search-type">Type</label>
              <select
                id="search-type"
                class="ink-field"
                value={searchType}
                onChange={(e) => this.setState({ searchType: e.target.value })}
              >
                <option value="comic">Comics / Manga</option>
                <option value="manga">Manga only</option>
              </select>
            </div>
            <div class="ink-advanced-row">
              <label for="search-limit">Limit</label>
              <select
                id="search-limit"
                class="ink-field"
                value={searchLimit}
                onChange={(e) => this.setState({ searchLimit: Number(e.target.value) })}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
              </select>
            </div>
            <div class="ink-advanced-row">
              <button class="ink-btn-primary" onClick={this._handleSearch} disabled={searching}>
                {searching ? <span class="ink-spinner" /> : null}
                {searching ? "Searching..." : "Search"}
              </button>
              <button class="ink-btn-ghost" onClick={this._handleProbeSources} disabled={probing}>
                {probing ? <span class="ink-spinner" /> : null}
                {probing ? "Probing..." : "Probe Sources"}
              </button>
            </div>
            {this._renderSearchResults()}
          </div>
        </details>

        {/* ── Drawer 2: Process Commands ────────────────────────── */}
        <details>
          <summary>⚙️ Process Commands</summary>
          <div class="ink-advanced-drawer-body">
            <p style="font-size: var(--ink-text-sm); color: var(--ink-text-secondary); margin: 0;">
              Trigger server-side maintenance operations.
            </p>
            <div class="ink-advanced-row">
              <button class="ink-btn-primary" onClick={this._handleProcessReady} disabled={processingReady}>
                {processingReady ? <span class="ink-spinner" /> : null}
                {processingReady ? "Processing..." : "Process All Ready"}
              </button>
              <button class="ink-btn-ghost" onClick={this._handleFreshSweep} disabled={freshSweeping}>
                {freshSweeping ? <span class="ink-spinner" /> : null}
                {freshSweeping ? "Sweeping..." : "Fast Fresh Sweep"}
              </button>
            </div>
            <div class="ink-advanced-row">
              <button class="ink-btn-ghost" onClick={this._handleRssSweep} disabled={rssSweeping}>
                {rssSweeping ? <span class="ink-spinner" /> : null}
                {rssSweeping ? "Discovering..." : "RSS Discovery Sweep"}
              </button>
              <button class="ink-btn-ghost" onClick={this._handleComicscodesSweep} disabled={comicscodesSweeping}>
                {comicscodesSweeping ? <span class="ink-spinner" /> : null}
                {comicscodesSweeping ? "Discovering..." : "ComicsCodes Sweep"}
              </button>
            </div>
            <div class="ink-advanced-row">
              <button class="ink-btn-ghost" onClick={this._handleImportNow} disabled={importing}>
                {importing ? <span class="ink-spinner" /> : null}
                {importing ? "Importing..." : "Import Now"}
              </button>
              <button class="ink-btn-ghost" onClick={this._handleAutopilotRun} disabled={autopiloting}>
                {autopiloting ? <span class="ink-spinner" /> : null}
                {autopiloting ? "Running..." : "Autopilot Run"}
              </button>
            </div>
          </div>
        </details>

        {/* ── Drawer 3: Source Watches ──────────────────────────── */}
        <details>
          <summary>👁️ Source Watches</summary>
          <div class="ink-advanced-drawer-body">
            <div class="ink-advanced-row">
              <label for="watch-query">Watch Query</label>
              <input
                id="watch-query"
                class="ink-field"
                type="text"
                value={watchQuery}
                onInput={(e) => this.setState({ watchQuery: e.target.value })}
                placeholder="Enter search term to watch..."
                style="flex: 1;"
              />
            </div>
            <div class="ink-advanced-row">
              <label for="watch-type">Type</label>
              <select
                id="watch-type"
                class="ink-field"
                value={watchType}
                onChange={(e) => this.setState({ watchType: e.target.value })}
              >
                <option value="comic">Comics / Manga</option>
              </select>
            </div>
            <div class="ink-advanced-row">
              <label for="watch-limit">Limit</label>
              <select
                id="watch-limit"
                class="ink-field"
                value={watchLimit}
                onChange={(e) => this.setState({ watchLimit: Number(e.target.value) })}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
              </select>
            </div>
            <div class="ink-advanced-row">
              <label for="watch-auto">Auto-monitor</label>
              <input
                id="watch-auto"
                type="checkbox"
                checked={watchAutoMonitor}
                onChange={(e) => this.setState({ watchAutoMonitor: e.target.checked })}
              />
            </div>
            <div class="ink-advanced-row">
              <button class="ink-btn-primary" onClick={this._handleAddWatch} disabled={addingWatch}>
                {addingWatch ? <span class="ink-spinner" /> : null}
                {addingWatch ? "Adding..." : "Add Watch"}
              </button>
              <button class="ink-btn-ghost" onClick={this._handleScanWatches} disabled={scanningWatches}>
                {scanningWatches ? <span class="ink-spinner" /> : null}
                {scanningWatches ? "Scanning..." : "Scan All Watches"}
              </button>
              <button class="ink-btn-ghost ink-btn-sm" onClick={this._loadWatches} disabled={watchesLoading}>
                ↻ Refresh
              </button>
            </div>
            {this._renderWatchesList()}
          </div>
        </details>
      </div>
    );
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

        {/* ── Advanced Tab ────────────────────────────────────────── */}
        {!loading && activeTab === "advanced" && this._renderAdvancedTab()}
      </div>
    );
  }
}

export { SystemPage };
export default SystemPage;
