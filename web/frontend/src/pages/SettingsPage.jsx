/**
 * InkDrop — Settings Page
 * Full settings management: app settings, provider/indexer CRUD, backup/restore,
 * download clients placeholder, advanced toggle, search, and unsaved changes tracking.
 */

import { h, Component } from "preact";
import api from "../api/client.jsx";
import { toast } from "../main.jsx";

/* ── Scoped Styles ─────────────────────────────────────────────────────── */
const styles = `
/* ── Page Layout ──────────────────────────────────────────────────── */
.ink-settings-page {
  max-width: 960px;
  margin: 0 auto;
}

.ink-settings-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ink-space-md);
  flex-wrap: wrap;
  margin-bottom: var(--ink-space-xl);
}

.ink-settings-toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--ink-space-md);
  flex-wrap: wrap;
}

.ink-settings-toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
}

.ink-settings-search {
  position: relative;
  min-width: 200px;
}

.ink-settings-search input {
  width: 100%;
  padding-left: 32px;
  font-size: var(--ink-text-sm);
}

.ink-settings-search::before {
  content: '🔍';
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  opacity: 0.5;
  pointer-events: none;
}

.ink-settings-advanced-toggle {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
  font-size: var(--ink-text-sm);
  color: var(--ink-text-secondary);
  cursor: pointer;
  user-select: none;
}

.ink-settings-advanced-toggle input[type="checkbox"] {
  min-height: auto;
  width: 16px;
  height: 16px;
  accent-color: var(--ink-accent-gold);
  cursor: pointer;
}

.ink-settings-unsaved {
  display: inline-flex;
  align-items: center;
  gap: var(--ink-space-xs);
  font-size: var(--ink-text-xs);
  color: var(--ink-warning);
  background: var(--ink-warning-dim);
  padding: 2px 8px;
  border-radius: var(--ink-radius-full);
  white-space: nowrap;
}

/* ── Section Cards ────────────────────────────────────────────────── */
.ink-settings-section {
  background: var(--ink-bg-surface);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
  margin-bottom: var(--ink-space-lg);
  overflow: hidden;
  transition: border-color var(--ink-transition-fast);
}

.ink-settings-section:hover {
  border-color: var(--ink-border-default);
}

.ink-settings-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ink-space-md);
  padding: var(--ink-space-lg) var(--ink-space-xl);
  border-bottom: 1px solid var(--ink-border-subtle);
  cursor: pointer;
  user-select: none;
}

.ink-settings-section-header h3 {
  font-size: var(--ink-text-base);
  font-weight: 600;
  color: var(--ink-text-primary);
}

.ink-settings-section-header .ink-section-desc {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  margin-top: 2px;
}

.ink-settings-section-header .ink-section-toggle {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  transition: transform var(--ink-transition-fast);
}

.ink-settings-section-header .ink-section-toggle.open {
  transform: rotate(180deg);
}

.ink-settings-section-body {
  padding: var(--ink-space-lg) var(--ink-space-xl);
}

/* ── Form Fields ──────────────────────────────────────────────────── */
.ink-settings-field {
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-xs);
  margin-bottom: var(--ink-space-lg);
}

.ink-settings-field:last-child {
  margin-bottom: 0;
}

.ink-settings-field-row {
  display: flex;
  align-items: flex-start;
  gap: var(--ink-space-lg);
}

.ink-settings-field-row .ink-settings-field {
  flex: 1;
  margin-bottom: 0;
}

.ink-settings-field-label {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
  font-size: var(--ink-text-sm);
  font-weight: 500;
  color: var(--ink-text-secondary);
}

.ink-settings-field-label .ink-advanced-badge {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: var(--ink-radius-sm);
  background: var(--ink-accent-gold-dim);
  color: var(--ink-accent-gold);
}

.ink-settings-field-hint {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  line-height: 1.4;
}

.ink-settings-field-error {
  font-size: var(--ink-text-xs);
  color: var(--ink-danger);
}

.ink-settings-field input[type="text"],
.ink-settings-field input[type="number"],
.ink-settings-field input[type="password"],
.ink-settings-field input[type="url"],
.ink-settings-field select,
.ink-settings-field textarea {
  width: 100%;
  font-size: var(--ink-text-sm);
}

.ink-settings-field textarea {
  min-height: 80px;
  resize: vertical;
  font-family: var(--ink-font-mono);
  font-size: var(--ink-text-xs);
}

.ink-settings-field input[type="checkbox"] {
  width: 18px;
  height: 18px;
  min-height: auto;
  accent-color: var(--ink-accent-gold);
  cursor: pointer;
}

.ink-settings-field .ink-checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
  padding: var(--ink-space-xs) 0;
}

.ink-settings-field .ink-checkbox-wrapper label {
  font-size: var(--ink-text-sm);
  cursor: pointer;
}

.ink-settings-field input[type="range"] {
  width: 100%;
  min-height: auto;
  padding: 0;
  border: none;
  background: transparent;
  accent-color: var(--ink-accent-gold);
}

.ink-settings-range-value {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  text-align: right;
}

/* ── Provider Cards ───────────────────────────────────────────────── */
.ink-settings-providers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--ink-space-md);
}

.ink-settings-provider-card {
  background: var(--ink-bg-elevated);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
  padding: var(--ink-space-lg);
  transition: border-color var(--ink-transition-fast);
}

.ink-settings-provider-card:hover {
  border-color: var(--ink-border-default);
}

.ink-settings-provider-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ink-space-sm);
  margin-bottom: var(--ink-space-sm);
}

.ink-settings-provider-card-name {
  font-weight: 600;
  font-size: var(--ink-text-base);
  color: var(--ink-text-primary);
}

.ink-settings-provider-card-type {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-muted);
  margin-top: 2px;
}

.ink-settings-provider-card-actions {
  display: flex;
  gap: var(--ink-space-xs);
  flex-shrink: 0;
}

.ink-settings-provider-card-actions button {
  min-height: 28px;
  padding: 2px 8px;
  font-size: var(--ink-text-xs);
}

.ink-settings-provider-card-config {
  font-size: var(--ink-text-xs);
  color: var(--ink-text-secondary);
  margin-top: var(--ink-space-sm);
}

.ink-settings-provider-card-config dt {
  color: var(--ink-text-muted);
  display: inline;
}

.ink-settings-provider-card-config dd {
  display: inline;
  margin-right: var(--ink-space-md);
}

/* ── Provider Form (Add/Edit) ─────────────────────────────────────── */
.ink-settings-provider-form {
  background: var(--ink-bg-elevated);
  border: 1px solid var(--ink-border-default);
  border-radius: var(--ink-radius-lg);
  padding: var(--ink-space-xl);
  margin-bottom: var(--ink-space-lg);
}

.ink-settings-provider-form h4 {
  font-size: var(--ink-text-base);
  font-weight: 600;
  margin-bottom: var(--ink-space-lg);
  color: var(--ink-text-primary);
}

.ink-settings-provider-form-actions {
  display: flex;
  gap: var(--ink-space-sm);
  margin-top: var(--ink-space-lg);
  padding-top: var(--ink-space-lg);
  border-top: 1px solid var(--ink-border-subtle);
}

/* ── Download Clients Placeholder ────────────────────────────────── */
.ink-settings-dc-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--ink-space-3xl) var(--ink-space-xl);
  text-align: center;
  gap: var(--ink-space-lg);
}

.ink-settings-dc-placeholder p {
  color: var(--ink-text-secondary);
  font-size: var(--ink-text-sm);
  max-width: 400px;
}

/* ── Backup Section ───────────────────────────────────────────────── */
.ink-settings-backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ink-space-sm);
  margin-top: var(--ink-space-md);
}

.ink-settings-backup-preview {
  margin-top: var(--ink-space-lg);
  background: var(--ink-bg-elevated);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-md);
  padding: var(--ink-space-md);
  max-height: 300px;
  overflow-y: auto;
}

.ink-settings-backup-preview pre {
  font-family: var(--ink-font-mono);
  font-size: var(--ink-text-xs);
  color: var(--ink-text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}

.ink-settings-backup-restore-area {
  margin-top: var(--ink-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--ink-space-sm);
}

.ink-settings-backup-restore-area textarea {
  min-height: 120px;
  font-family: var(--ink-font-mono);
  font-size: var(--ink-text-xs);
}

/* ── Loading / Error ──────────────────────────────────────────────── */
.ink-settings-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ink-space-3xl);
  color: var(--ink-text-muted);
  gap: var(--ink-space-md);
}

.ink-settings-error {
  background: var(--ink-danger-dim);
  border: 1px solid rgba(244, 67, 54, 0.2);
  border-radius: var(--ink-radius-lg);
  padding: var(--ink-space-lg) var(--ink-space-xl);
  color: var(--ink-danger);
  font-size: var(--ink-text-sm);
  margin-bottom: var(--ink-space-lg);
}

.ink-settings-error button {
  margin-top: var(--ink-space-sm);
}

/* ── Empty State ──────────────────────────────────────────────────── */
.ink-settings-empty {
  text-align: center;
  padding: var(--ink-space-2xl);
  color: var(--ink-text-muted);
  font-size: var(--ink-text-sm);
}

/* ── Notification Styles ──────────────────────────────────────────── */
.ink-notif-channel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ink-space-md);
  padding: var(--ink-space-md);
  background: var(--ink-bg-elevated);
  border: 1px solid var(--ink-border-subtle);
  border-radius: var(--ink-radius-lg);
}

.ink-notif-channel-info {
  display: flex;
  align-items: center;
  gap: var(--ink-space-sm);
  flex: 1;
  min-width: 0;
}

.ink-notif-channel-name {
  font-weight: 600;
  font-size: var(--ink-text-sm);
  color: var(--ink-text-primary);
}

.ink-notif-channel-actions {
  display: flex;
  gap: var(--ink-space-xs);
  flex-shrink: 0;
}

.ink-notif-deliveries-table {
  overflow-x: auto;
}

.ink-notif-deliveries-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--ink-text-sm);
}

.ink-notif-deliveries-table th {
  text-align: left;
  padding: var(--ink-space-sm) var(--ink-space-md);
  font-weight: 600;
  color: var(--ink-text-secondary);
  border-bottom: 1px solid var(--ink-border-subtle);
  white-space: nowrap;
}

.ink-notif-deliveries-table td {
  padding: var(--ink-space-sm) var(--ink-space-md);
  border-bottom: 1px solid var(--ink-border-subtle);
  color: var(--ink-text-primary);
}

.ink-notif-deliveries-table tr:last-child td {
  border-bottom: none;
}

/* ── Responsive ───────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .ink-settings-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .ink-settings-toolbar-left,
  .ink-settings-toolbar-right {
    justify-content: stretch;
  }

  .ink-settings-search {
    min-width: auto;
    flex: 1;
  }

  .ink-settings-providers {
    grid-template-columns: 1fr;
  }

  .ink-settings-field-row {
    flex-direction: column;
  }

  .ink-settings-section-header {
    padding: var(--ink-space-md) var(--ink-space-lg);
  }

  .ink-settings-section-body {
    padding: var(--ink-space-md) var(--ink-space-lg);
  }
}
`;

/* ── Helpers ──────────────────────────────────────────────────────────── */

function getAreaFromHash() {
  try {
    const hash = window.location.hash || "";
    const m = hash.match(/[?&]area=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : "setup";
  } catch {
    return "setup";
  }
}

function getFieldType(schema) {
  if (!schema) return "text";
  if (schema.type === "boolean") return "checkbox";
  if (schema.type === "integer" || schema.type === "number") return "number";
  if (schema.enum && Array.isArray(schema.enum)) return "select";
  if (schema.type === "password") return "password";
  if (schema.format === "uri" || schema.format === "url") return "url";
  if (schema.type === "textarea") return "textarea";
  if (schema.type === "range") return "range";
  return "text";
}

function getFieldDefault(schema) {
  if (!schema) return "";
  if (schema.default !== undefined && schema.default !== null) return schema.default;
  if (schema.type === "boolean") return false;
  if (schema.type === "integer" || schema.type === "number") return 0;
  return "";
}

function coerceValue(value, schema) {
  if (schema.type === "boolean") return !!value;
  if (schema.type === "integer") return parseInt(value, 10) || 0;
  if (schema.type === "number") return parseFloat(value) || 0;
  return value;
}

function isAdvancedField(schema) {
  return schema && (schema.advanced === true || schema.category === "advanced");
}

function fieldMatchesSearch(fieldKey, schema, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const key = (fieldKey || "").toLowerCase();
  const label = ((schema && schema.label) || "").toLowerCase();
  const hint = ((schema && schema.hint) || "").toLowerCase();
  return key.includes(q) || label.includes(q) || hint.includes(q);
}

function sectionMatchesSearch(section, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const name = (section.name || section.key || "").toLowerCase();
  const desc = (section.description || "").toLowerCase();
  return name.includes(q) || desc.includes(q);
}

/* ── SettingsPage Component ──────────────────────────────────────────── */

class SettingsPage extends Component {
  constructor() {
    super();
    this.state = {
      area: getAreaFromHash(),
      loading: true,
      error: null,
      data: null,
      showAdvanced: false,
      searchQuery: "",
      unsavedChanges: false,
      dirtyFields: {},
      // Provider editing
      editingProvider: null,
      providerFormData: null,
      providerFormErrors: null,
      testingProvider: null,
      // Backup
      backupLoading: false,
      backupData: null,
      backupPreview: null,
      backupPreviewLoading: false,
      restoreText: "",
      restoreLoading: false,
      // Collapsed sections
      collapsedSections: {},
      // Download clients
      dcLoading: false,
      dcList: [],
      dcRegistry: [],
      dcStatus: null,
      dcShowForm: false,
      dcEditing: null,
      dcFormData: {
        name: "",
        client_type: "",
        base_url: "",
        username: "",
        password: "",
        api_key: "",
        category: "",
        download_path: "",
        enabled: true,
        priority: 100,
      },
      dcTesting: false,
      dcTestResult: null,
      dcTestAllResult: null,
      // Notifications
      notifConfig: null,
      notifLoading: false,
      notifError: null,
      notifSettingsDirty: null,
      notifSaving: false,
      notifShowAddChannel: false,
      notifEditingChannel: null,
      notifChannelForm: { name: "", type: "discord_webhook", config: "{}", enabled: true },
      notifChannelFormError: null,
      notifDeliveries: null,
      notifDeliveriesLoading: false,
    };

    this._onHashChange = this._onHashChange.bind(this);
    this._handleFieldChange = this._handleFieldChange.bind(this);
    this._handleSave = this._handleSave.bind(this);
    this._handleSync = this._handleSync.bind(this);
    this._handleProviderAdd = this._handleProviderAdd.bind(this);
    this._handleProviderEdit = this._handleProviderEdit.bind(this);
    this._handleProviderDelete = this._handleProviderDelete.bind(this);
    this._handleProviderTest = this._handleProviderTest.bind(this);
    this._handleProviderFormChange = this._handleProviderFormChange.bind(this);
    this._handleProviderFormSubmit = this._handleProviderFormSubmit.bind(this);
    this._handleProviderFormCancel = this._handleProviderFormCancel.bind(this);
    this._handleBackupExport = this._handleBackupExport.bind(this);
    this._handleBackupPreview = this._handleBackupPreview.bind(this);
    this._handleBackupRestore = this._handleBackupRestore.bind(this);
    this._toggleSection = this._toggleSection.bind(this);
    this._loadDownloadClients = this._loadDownloadClients.bind(this);
    this._handleDcAdd = this._handleDcAdd.bind(this);
    this._handleDcEdit = this._handleDcEdit.bind(this);
    this._handleDcSave = this._handleDcSave.bind(this);
    this._handleDcDelete = this._handleDcDelete.bind(this);
    this._handleDcTest = this._handleDcTest.bind(this);
    this._handleDcTestAll = this._handleDcTestAll.bind(this);
    this._handleDcFormChange = this._handleDcFormChange.bind(this);
    this._loadNotifConfig = this._loadNotifConfig.bind(this);
    this._loadNotifDeliveries = this._loadNotifDeliveries.bind(this);
    this._handleNotifSettingsChange = this._handleNotifSettingsChange.bind(this);
    this._handleNotifSaveSettings = this._handleNotifSaveSettings.bind(this);
    this._handleNotifAddChannel = this._handleNotifAddChannel.bind(this);
    this._handleNotifEditChannel = this._handleNotifEditChannel.bind(this);
    this._handleNotifChannelFormChange = this._handleNotifChannelFormChange.bind(this);
    this._handleNotifSaveChannel = this._handleNotifSaveChannel.bind(this);
    this._handleNotifDeleteChannel = this._handleNotifDeleteChannel.bind(this);
    this._handleNotifCancelChannelForm = this._handleNotifCancelChannelForm.bind(this);
  }

  componentDidMount() {
    this._mounted = true;
    window.addEventListener("hashchange", this._onHashChange);
    this._loadSettings();
    this._loadDownloadClients();
  }

  componentWillUnmount() {
    this._mounted = false;
    window.removeEventListener("hashchange", this._onHashChange);
  }

  _onHashChange() {
    const newArea = getAreaFromHash();
    if (newArea !== this.state.area) {
      this.setState(
        {
          area: newArea,
          loading: true,
          error: null,
          data: null,
          unsavedChanges: false,
          dirtyFields: {},
          editingProvider: null,
          providerFormData: null,
          providerFormErrors: null,
          testingProvider: null,
          backupData: null,
          backupPreview: null,
          restoreText: "",
          searchQuery: "",
        },
        () => this._loadSettings(),
      );
    }
  }

  async _loadSettings() {
    const { area } = this.state;
    this.setState({ loading: true, error: null });

    // Notifications area uses its own API
    if (area === "notifications") {
      this.setState({ loading: false });
      this._loadNotifConfig();
      return;
    }

    try {
      const data = await api.settings.get(area);
      if (data && data.ok) {
        this.setState({ data: data.settings || data, loading: false });
      } else {
        this.setState({
          error: (data && data.error) || "Failed to load settings",
          loading: false,
        });
      }
    } catch (err) {
      this.setState({
        error: api.friendlyMessage ? api.friendlyMessage(err) : err.message || "Failed to load settings",
        loading: false,
      });
    }
  }

  async _handleSync() {
    const { area } = this.state;
    toast("Syncing settings from disk…", "info");
    try {
      const data = await api.settings.sync(area);
      if (data && data.ok) {
        toast("Settings synced", "success");
        this._loadSettings();
        this._loadDownloadClients();
      } else {
        toast((data && data.error) || "Sync failed", "error");
      }
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : "Sync failed", "error");
    }
  }

  /* ── Field Change Handling ─────────────────────────────────────────── */

  _handleFieldChange(sectionKey, fieldKey, schema, value) {
    const coerced = coerceValue(value, schema);
    this.setState((prev) => {
      const dirtyFields = { ...prev.dirtyFields };
      if (!dirtyFields[sectionKey]) dirtyFields[sectionKey] = {};
      dirtyFields[sectionKey][fieldKey] = coerced;
      return {
        dirtyFields,
        unsavedChanges: Object.keys(dirtyFields).some((sk) => Object.keys(dirtyFields[sk]).length > 0),
      };
    });
  }

  _getCurrentValue(sectionKey, fieldKey, schema) {
    const { dirtyFields, data } = this.state;
    if (dirtyFields[sectionKey] && dirtyFields[sectionKey][fieldKey] !== undefined) {
      return dirtyFields[sectionKey][fieldKey];
    }
    if (data && data.app && data.app[fieldKey] !== undefined) {
      return data.app[fieldKey];
    }
    return getFieldDefault(schema);
  }

  /* ── Save ──────────────────────────────────────────────────────────── */

  async _handleSave() {
    const { dirtyFields, area } = this.state;
    const keys = Object.keys(dirtyFields);
    if (keys.length === 0) {
      toast("No changes to save", "info");
      return;
    }

    let saved = 0;
    let errors = 0;

    for (const sectionKey of keys) {
      const fields = dirtyFields[sectionKey];
      for (const [fieldKey, value] of Object.entries(fields)) {
        try {
          const result = await api.settings.appUpdate({ key: fieldKey, value });
          if (result && result.ok) {
            saved++;
          } else {
            errors++;
            toast(`Failed to save ${fieldKey}: ${(result && result.error) || "unknown error"}`, "error");
          }
        } catch (err) {
          errors++;
          toast(`Failed to save ${fieldKey}: ${api.friendlyMessage ? api.friendlyMessage(err) : err.message}`, "error");
        }
      }
    }

    if (errors === 0 && saved > 0) {
      toast(`Saved ${saved} setting${saved !== 1 ? "s" : ""}`, "success");
      this.setState({ dirtyFields: {}, unsavedChanges: false });
      this._loadSettings();
    } else if (saved > 0) {
      toast(`Saved ${saved} setting${saved !== 1 ? "s" : ""} (${errors} failed)`, "warning");
      this.setState({ dirtyFields: {}, unsavedChanges: false });
      this._loadSettings();
    }
  }

  /* ── Provider CRUD ─────────────────────────────────────────────────── */

  _handleProviderAdd() {
    this.setState({
      editingProvider: "__new__",
      providerFormData: { name: "", type: "", config: {} },
      providerFormErrors: null,
    });
  }

  _handleProviderEdit(provider) {
    this.setState({
      editingProvider: provider.id,
      providerFormData: {
        name: provider.name || "",
        type: provider.type || "",
        config: { ...(provider.config || {}) },
        revision: provider.revision,
      },
      providerFormErrors: null,
    });
  }

  async _handleProviderDelete(provider) {
    if (!confirm(`Delete provider "${provider.name || provider.id}"?`)) return;
    try {
      const result = await api.settings.providerDelete({ id: provider.id, revision: provider.revision });
      if (result && result.ok) {
        toast("Provider deleted", "success");
        this._loadSettings();
      } else {
        toast((result && result.error) || "Failed to delete provider", "error");
      }
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : "Failed to delete provider", "error");
    }
  }

  async _handleProviderTest(provider) {
    this.setState({ testingProvider: provider.id });
    try {
      const result = await api.settings.providerTest({ id: provider.id, revision: provider.revision });
      if (result && result.ok) {
        toast(`Test successful: ${result.message || "Provider is reachable"}`, "success");
      } else {
        toast((result && result.error) || "Test failed", "error");
      }
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : "Test failed", "error");
    } finally {
      this.setState({ testingProvider: null });
    }
  }

  _handleProviderFormChange(field, value) {
    this.setState((prev) => ({
      providerFormData: { ...prev.providerFormData, [field]: value },
      providerFormErrors: null,
    }));
  }

  async _handleProviderFormSubmit() {
    const { editingProvider, providerFormData } = this.state;
    if (!providerFormData.name || !providerFormData.type) {
      this.setState({ providerFormErrors: "Name and type are required" });
      return;
    }

    try {
      let result;
      if (editingProvider === "__new__") {
        result = await api.settings.providerAdd({
          name: providerFormData.name,
          type: providerFormData.type,
          config: providerFormData.config || {},
        });
      } else {
        result = await api.settings.providerUpdate({
          id: editingProvider,
          name: providerFormData.name,
          type: providerFormData.type,
          config: providerFormData.config || {},
          revision: providerFormData.revision,
        });
      }

      if (result && result.ok) {
        toast(editingProvider === "__new__" ? "Provider added" : "Provider updated", "success");
        this.setState({
          editingProvider: null,
          providerFormData: null,
          providerFormErrors: null,
        });
        this._loadSettings();
      } else {
        this.setState({ providerFormErrors: (result && result.error) || "Operation failed" });
      }
    } catch (err) {
      this.setState({
        providerFormErrors: api.friendlyMessage ? api.friendlyMessage(err) : err.message,
      });
    }
  }

  _handleProviderFormCancel() {
    this.setState({
      editingProvider: null,
      providerFormData: null,
      providerFormErrors: null,
    });
  }

  /* ── Backup ─────────────────────────────────────────────────────────── */

  async _handleBackupExport() {
    this.setState({ backupLoading: true });
    try {
      const result = await api.settings.backupExport();
      if (result && result.ok) {
        const blob = new Blob([result.document_text || JSON.stringify(result, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `inkdrop-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast("Backup exported", "success");
      } else {
        toast((result && result.error) || "Export failed", "error");
      }
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : "Export failed", "error");
    } finally {
      this.setState({ backupLoading: false });
    }
  }

  async _handleBackupPreview() {
    this.setState({ backupPreviewLoading: true, backupPreview: null });
    try {
      const result = await api.settings.backupPreview(this.state.restoreText);
      if (result && result.ok) {
        this.setState({ backupPreview: result.preview || result });
        toast("Preview generated", "success");
      } else {
        toast((result && result.error) || "Preview failed", "error");
      }
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : "Preview failed", "error");
    } finally {
      this.setState({ backupPreviewLoading: false });
    }
  }

  async _handleBackupRestore() {
    if (!this.state.restoreText.trim()) {
      toast("Paste backup data first", "warning");
      return;
    }
    if (!confirm("Are you sure you want to restore from this backup? This will overwrite current settings.")) return;

    this.setState({ restoreLoading: true });
    try {
      const result = await api.settings.backupRestore(this.state.restoreText);
      if (result && result.ok) {
        toast("Backup restored successfully", "success");
        this.setState({ restoreText: "", backupPreview: null });
        this._loadSettings();
      } else {
        toast((result && result.error) || "Restore failed", "error");
      }
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : "Restore failed", "error");
    } finally {
      this.setState({ restoreLoading: false });
    }
  }

  /* ── Section Collapse ───────────────────────────────────────────────── */

  _toggleSection(key) {
    this.setState((prev) => {
      const collapsedSections = { ...prev.collapsedSections };
      if (collapsedSections[key]) {
        delete collapsedSections[key];
      } else {
        collapsedSections[key] = true;
      }
      return { collapsedSections };
    });
  }

  /* ── Render Helpers ────────────────────────────────────────────────── */

  _renderField(sectionKey, fieldKey, schema) {
    if (!schema) return null;

    const isAdvanced = isAdvancedField(schema);
    if (isAdvanced && !this.state.showAdvanced) return null;

    const query = this.state.searchQuery;
    if (query && !fieldMatchesSearch(fieldKey, schema, query)) return null;

    const value = this._getCurrentValue(sectionKey, fieldKey, schema);
    const type = getFieldType(schema);
    const inputId = `setting-${sectionKey}-${fieldKey}`;

    const handleChange = (e) => {
      let val;
      if (type === "checkbox") {
        val = e.target.checked;
      } else if (type === "number" || type === "range") {
        val = e.target.value;
      } else {
        val = e.target.value;
      }
      this._handleFieldChange(sectionKey, fieldKey, schema, val);
    };

    let input;
    switch (type) {
      case "checkbox":
        input = (
          <div class="ink-checkbox-wrapper">
            <input id={inputId} type="checkbox" checked={!!value} onChange={handleChange} />
            <label for={inputId}>{schema.label || fieldKey}</label>
          </div>
        );
        break;

      case "select":
        input = (
          <select id={inputId} value={String(value)} onChange={handleChange}>
            {schema.enum.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
        break;

      case "textarea":
        input = (
          <textarea id={inputId} value={String(value)} onInput={handleChange} placeholder={schema.placeholder || ""} />
        );
        break;

      case "range":
        input = (
          <div>
            <input
              id={inputId}
              type="range"
              min={schema.minimum || 0}
              max={schema.maximum || 100}
              step={schema.step || 1}
              value={Number(value)}
              onChange={handleChange}
            />
            <div class="ink-settings-range-value">
              {value}
              {schema.unit || ""}
            </div>
          </div>
        );
        break;

      case "password":
        input = (
          <input
            id={inputId}
            type="password"
            value={String(value)}
            onInput={handleChange}
            placeholder={schema.placeholder || ""}
            autocomplete="off"
            spellcheck="false"
          />
        );
        break;

      case "url":
        input = (
          <input
            id={inputId}
            type="url"
            value={String(value)}
            onInput={handleChange}
            placeholder={schema.placeholder || "https://…"}
            spellcheck="false"
          />
        );
        break;

      case "number":
        input = (
          <input
            id={inputId}
            type="number"
            value={value}
            onInput={handleChange}
            min={schema.minimum}
            max={schema.maximum}
            step={schema.step || "any"}
            placeholder={schema.placeholder || ""}
          />
        );
        break;

      default:
        input = (
          <input
            id={inputId}
            type="text"
            value={String(value)}
            onInput={handleChange}
            placeholder={schema.placeholder || ""}
            spellcheck="false"
          />
        );
    }

    return (
      <div class="ink-settings-field" key={fieldKey}>
        {type !== "checkbox" && (
          <label class="ink-settings-field-label" for={inputId}>
            {schema.label || fieldKey}
            {isAdvanced && <span class="ink-advanced-badge">Advanced</span>}
          </label>
        )}
        {input}
        {schema.hint && <span class="ink-settings-field-hint">{schema.hint}</span>}
        {schema.error && <span class="ink-settings-field-error">{schema.error}</span>}
      </div>
    );
  }

  _renderSection(section) {
    const sectionKey = section.key || section.name || "unknown";
    const isCollapsed = !!this.state.collapsedSections[sectionKey];
    const fields = section.fields || {};
    const fieldKeys = Object.keys(fields);

    // Filter by search
    const query = this.state.searchQuery;
    const visibleFields = fieldKeys.filter((k) => {
      const schema = fields[k];
      if (isAdvancedField(schema) && !this.state.showAdvanced) return false;
      if (query && !fieldMatchesSearch(k, schema, query)) return false;
      return true;
    });

    if (query && visibleFields.length === 0) return null;

    return (
      <div class="ink-settings-section" key={sectionKey}>
        <div
          class="ink-settings-section-header"
          onClick={() => this._toggleSection(sectionKey)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") this._toggleSection(sectionKey);
          }}
        >
          <div>
            <h3>{section.label || section.name || sectionKey}</h3>
            {section.description && <div class="ink-section-desc">{section.description}</div>}
          </div>
          <span class={`ink-section-toggle${isCollapsed ? "" : " open"}`}>▼</span>
        </div>
        {!isCollapsed && (
          <div class="ink-settings-section-body">
            {visibleFields.length > 0 ? (
              visibleFields.map((fk) => this._renderField(sectionKey, fk, fields[fk]))
            ) : (
              <div class="ink-settings-empty">No settings in this section</div>
            )}
          </div>
        )}
      </div>
    );
  }

  _renderProviderForm() {
    const { providerFormData, providerFormErrors } = this.state;
    if (!providerFormData) return null;

    return (
      <div class="ink-settings-provider-form">
        <h4>{this.state.editingProvider === "__new__" ? "Add Provider" : "Edit Provider"}</h4>

        {providerFormErrors && (
          <div class="ink-settings-field-error" style="margin-bottom:var(--ink-space-md)">
            {providerFormErrors}
          </div>
        )}

        <div class="ink-settings-field-row">
          <div class="ink-settings-field">
            <label class="ink-settings-field-label">Name</label>
            <input
              type="text"
              value={providerFormData.name}
              onInput={(e) => this._handleProviderFormChange("name", e.target.value)}
              placeholder="My Indexer"
            />
          </div>
          <div class="ink-settings-field">
            <label class="ink-settings-field-label">Type</label>
            <input
              type="text"
              value={providerFormData.type}
              onInput={(e) => this._handleProviderFormChange("type", e.target.value)}
              placeholder="newznab / torznab / etc."
            />
          </div>
        </div>

        <div class="ink-settings-field">
          <label class="ink-settings-field-label">Config (JSON)</label>
          <textarea
            value={JSON.stringify(providerFormData.config || {}, null, 2)}
            onInput={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                this._handleProviderFormChange("config", parsed);
              } catch {
                // Allow editing even if invalid JSON temporarily
              }
            }}
            placeholder='{"url": "https://…", "api_key": "…"}'
          />
          <span class="ink-settings-field-hint">Enter provider configuration as JSON</span>
        </div>

        <div class="ink-settings-provider-form-actions">
          <button class="ink-btn-primary" onClick={this._handleProviderFormSubmit}>
            {this.state.editingProvider === "__new__" ? "Add Provider" : "Update Provider"}
          </button>
          <button class="ink-btn-ghost" onClick={this._handleProviderFormCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  _renderProviders() {
    const { data } = this.state;
    const providers = (data && data.providers) || [];

    return (
      <div>
        {this._renderProviderForm()}

        {providers.length === 0 && !this.state.editingProvider ? (
          <div class="ink-settings-empty">No providers configured. Click "Add Provider" to get started.</div>
        ) : (
          <div class="ink-settings-providers">
            {providers.map((provider) => (
              <div class="ink-settings-provider-card" key={provider.id}>
                <div class="ink-settings-provider-card-header">
                  <div>
                    <div class="ink-settings-provider-card-name">{provider.name || provider.id}</div>
                    <div class="ink-settings-provider-card-type">{provider.type || "Unknown type"}</div>
                  </div>
                  <div class="ink-settings-provider-card-actions">
                    <button
                      class="ink-btn-ghost ink-btn-sm"
                      onClick={() => this._handleProviderEdit(provider)}
                      title="Edit provider"
                    >
                      ✏️
                    </button>
                    <button
                      class="ink-btn-ghost ink-btn-sm"
                      onClick={() => this._handleProviderTest(provider)}
                      disabled={this.state.testingProvider === provider.id}
                      title="Test provider"
                    >
                      {this.state.testingProvider === provider.id ? "…" : "🔍"}
                    </button>
                    <button
                      class="ink-btn-ghost ink-btn-sm"
                      onClick={() => this._handleProviderDelete(provider)}
                      title="Delete provider"
                      style="color:var(--ink-danger)"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                {provider.config && Object.keys(provider.config).length > 0 && (
                  <dl class="ink-settings-provider-card-config">
                    {Object.entries(provider.config)
                      .slice(0, 4)
                      .map(([k, v]) => (
                        <span key={k}>
                          <dt>{k}:</dt>{" "}
                          <dd>
                            {typeof v === "string" && v.length > 40 ? v.slice(0, 40) + "…" : JSON.stringify(v)}
                          </dd>{" "}
                        </span>
                      ))}
                    {Object.keys(provider.config).length > 4 && (
                      <span class="ink-mini">+{Object.keys(provider.config).length - 4} more</span>
                    )}
                  </dl>
                )}
              </div>
            ))}
          </div>
        )}

        <div style="margin-top:var(--ink-space-md)">
          <button class="ink-btn-primary ink-btn-sm" onClick={this._handleProviderAdd}>
            + Add Provider
          </button>
        </div>
      </div>
    );
  }

  /* ── Download Client Methods ──────────────────────────────────────── */

  async _loadDownloadClients() {
    this.setState({ dcLoading: true });
    try {
      const [dcListRes, dcRegistryRes, dcStatusRes] = await Promise.all([
        api.downloadClients.list().catch(() => null),
        api.downloadClients.registry().catch(() => null),
        api.downloadClients.status().catch(() => null),
      ]);
      const dcList = Array.isArray(dcListRes) ? dcListRes : dcListRes?.instances || [];
      // Registry API returns {ok, clients: [...], implemented: [...], addable: [...]}
      // dcRegistryRes IS the full object; .clients is the array of type definitions
      const dcRegistry = dcRegistryRes || {};
      const dcStatus = dcStatusRes || null;
      this.setState({ dcList, dcRegistry, dcStatus, dcLoading: false });
    } catch (err) {
      this.setState({ dcLoading: false });
      toast(api.friendlyMessage ? api.friendlyMessage(err) : "Failed to load download clients", "error");
    }
  }

  _handleDcAdd() {
    this.setState({
      dcShowForm: true,
      dcEditing: null,
      dcFormData: {
        name: "",
        client_type: "",
        base_url: "",
        username: "",
        password: "",
        api_key: "",
        category: "",
        download_path: "",
        enabled: true,
        priority: 100,
      },
    });
  }

  _handleDcEdit(client) {
    this.setState({
      dcShowForm: true,
      dcEditing: client,
      dcFormData: {
        name: client.name || "",
        client_type: client.client_type || "",
        base_url: client.base_url || "",
        username: client.username || "",
        password: "", // never pre-fill secrets
        api_key: "", // never pre-fill secrets
        category: client.category || "",
        download_path: client.download_path || "",
        enabled: client.enabled !== false,
        priority: client.priority || 100,
      },
    });
  }

  async _handleDcSave() {
    const { dcEditing, dcFormData } = this.state;

    // Validation
    if (!dcFormData.name?.trim()) {
      toast("Name is required", "error");
      return;
    }
    if (!dcFormData.client_type) {
      toast("Client type is required", "error");
      return;
    }
    if (dcFormData.enabled && !dcFormData.base_url?.trim()) {
      toast("Base URL is required when enabled", "error");
      return;
    }

    const { password, api_key, ...topLevel } = dcFormData;
    const payload = {
      ...topLevel,
      name: dcFormData.name.trim(),
      base_url: dcFormData.base_url?.trim() || undefined,
      secrets: {},
    };
    if (password) payload.secrets.password = password;
    if (api_key) payload.secrets.api_key = api_key;
    if (Object.keys(payload.secrets).length === 0) delete payload.secrets;
    // Remove undefined values
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    try {
      if (dcEditing) {
        payload.revision = dcEditing.revision;
        await api.downloadClients.update(dcEditing.id, payload);
        toast("Download client updated", "success");
      } else {
        await api.downloadClients.create(payload);
        toast("Download client created", "success");
      }
      this.setState({ dcShowForm: false, dcEditing: null });
      this._loadDownloadClients();
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : "Failed to save download client", "error");
    }
  }

  async _handleDcDelete(client) {
    if (!confirm(`Delete download client "${client.name}"?`)) return;
    try {
      await api.downloadClients.delete(client.id, client.revision);
      toast("Download client deleted", "success");
      this._loadDownloadClients();
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : "Failed to delete download client", "error");
    }
  }

  async _handleDcTest(client) {
    this.setState({ dcTesting: true, dcTestResult: null });
    try {
      const result = await api.downloadClients.testInstance(client.id);
      const ok = result?.status?.result?.ok === true;
      const msg = result?.status?.result?.message || result?.status?.message || result?.message || "Test completed";
      toast(msg, ok ? "success" : "error");
      this.setState({ dcTesting: false, dcTestResult: result });
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : "Test failed", "error");
      this.setState({ dcTesting: false });
    }
  }

  async _handleDcTestAll() {
    this.setState({ dcTesting: true, dcTestAllResult: null });
    try {
      const result = await api.downloadClients.testAll();
      toast("Tests started for all download clients", "success");
      this.setState({ dcTesting: false, dcTestAllResult: result });
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : "Test all failed", "error");
      this.setState({ dcTesting: false });
    }
  }

  _handleDcFormChange(field, value) {
    this.setState((prev) => ({
      dcFormData: { ...prev.dcFormData, [field]: value },
    }));
  }

  _renderDownloadClients() {
    const { dcLoading, dcList, dcRegistry, dcStatus, dcShowForm, dcEditing, dcFormData, dcTesting } = this.state;
    const clients = Array.isArray(dcList) ? dcList : [];

    if (dcLoading && clients.length === 0) {
      return (
        <div class="ink-empty">
          <div class="ink-spinner" />
          <div class="ink-empty-title">Loading download clients...</div>
        </div>
      );
    }

    // Client type registry for form dropdown
    // dcRegistry is the full registry object: { schema, clients: [...], implemented: [...], addable: [...] }
    const addableTypes = (dcRegistry?.clients || []).filter((c) => c.addable !== false);
    const selectedType = (dcRegistry?.clients || []).find((c) => c.client_type === dcFormData.client_type);
    // Determine which credential fields this type needs
    const typeNeedsPassword = selectedType?.fields?.password != null;
    const typeNeedsApiKey = selectedType?.fields?.api_key != null;

    return (
      <div>
        {/* Client list */}
        {clients.length === 0 ? (
          <div class="ink-empty">
            <div class="ink-empty-icon">📥</div>
            <div class="ink-empty-title">No Download Clients</div>
            <p class="ink-mini">Add a download client to enable automatic grabbing.</p>
          </div>
        ) : (
          <div style="display:flex;flex-direction:column;gap:var(--ink-space-md);">
            {clients.map((client) => {
              const status = dcStatus?.clients?.find((c) => c.id === client.id);
              const isOnline = status?.connected === true;
              return (
                <div
                  key={client.id}
                  style="display:flex;align-items:center;gap:var(--ink-space-md);padding:var(--ink-space-md);background:var(--ink-bg-surface);border:1px solid var(--ink-border-subtle);border-radius:var(--ink-radius-lg);"
                >
                  <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:var(--ink-space-sm);">
                      <span style="font-weight:600;font-size:var(--ink-text-base);">{client.name}</span>
                      <span class={`ink-pill ${isOnline ? "ink-pill-success" : "ink-pill-muted"}`}>
                        {client.client_type}
                      </span>
                      {isOnline && <span class="ink-pill ink-pill-success">Online</span>}
                      {status && !isOnline && <span class="ink-pill ink-pill-danger">Offline</span>}
                    </div>
                    <div style="font-size:var(--ink-text-sm);color:var(--ink-text-secondary);margin-top:2px;">
                      {client.base_url || "—"}
                    </div>
                    {status?.message && (
                      <div style="font-size:var(--ink-text-xs);color:var(--ink-text-muted);margin-top:2px;">
                        {status.message}
                      </div>
                    )}
                  </div>
                  <div style="display:flex;gap:var(--ink-space-xs);flex-shrink:0;">
                    <button class="ink-btn-ghost ink-btn-sm" onClick={() => this._handleDcTest(client)} type="button">
                      Test
                    </button>
                    <button class="ink-btn-ghost ink-btn-sm" onClick={() => this._handleDcEdit(client)} type="button">
                      Edit
                    </button>
                    <button
                      class="ink-btn-ghost ink-btn-sm"
                      style="color:var(--ink-danger)"
                      onClick={() => this._handleDcDelete(client)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add / Test All buttons */}
        <div style="display:flex;gap:var(--ink-space-sm);margin-top:var(--ink-space-md);">
          <button class="ink-btn-primary ink-btn-sm" onClick={() => this._handleDcAdd()} type="button">
            + Add Download Client
          </button>
          {clients.length > 0 && (
            <button
              class="ink-btn-ghost ink-btn-sm"
              onClick={() => this._handleDcTestAll()}
              type="button"
              disabled={dcTesting}
            >
              Test All
            </button>
          )}
        </div>

        {/* Add/Edit form modal */}
        {dcShowForm && (
          <div
            class="ink-dialog-backdrop"
            onClick={(e) => e.target === e.currentTarget && this.setState({ dcShowForm: false })}
          >
            <div class="ink-dialog" style="max-width:560px;">
              <div class="ink-dialog-header">
                <h2>{dcEditing ? "Edit Download Client" : "Add Download Client"}</h2>
              </div>
              <div class="ink-dialog-body">
                <div class="ink-field">
                  <label class="ink-field-label">Name</label>
                  <input
                    type="text"
                    value={dcFormData.name}
                    onInput={(e) => this._handleDcFormChange("name", e.target.value)}
                    placeholder="My SABnzbd"
                  />
                </div>
                <div class="ink-field">
                  <label class="ink-field-label">Type</label>
                  <select
                    value={dcFormData.client_type}
                    onChange={(e) => this._handleDcFormChange("client_type", e.target.value)}
                  >
                    <option value="">Select type...</option>
                    {addableTypes.map((t) => (
                      <option key={t.client_id || t.client_type} value={t.client_type}>
                        {t.display_name || t.client_type}
                      </option>
                    ))}
                  </select>
                </div>
                <div class="ink-field">
                  <label class="ink-field-label">Base URL</label>
                  <input
                    type="url"
                    value={dcFormData.base_url}
                    onInput={(e) => this._handleDcFormChange("base_url", e.target.value)}
                    placeholder="http://localhost:8080"
                  />
                </div>
                <div class="ink-field">
                  <label class="ink-field-label">Username</label>
                  <input
                    type="text"
                    value={dcFormData.username}
                    onInput={(e) => this._handleDcFormChange("username", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div class="ink-field">
                  <label class="ink-field-label">Category</label>
                  <input
                    type="text"
                    value={dcFormData.category}
                    onInput={(e) => this._handleDcFormChange("category", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div class="ink-field">
                  <label class="ink-field-label">Download Path</label>
                  <input
                    type="text"
                    value={dcFormData.download_path}
                    onInput={(e) => this._handleDcFormChange("download_path", e.target.value)}
                    placeholder="/downloads/"
                  />
                </div>
                <div class="ink-field">
                  <div class="ink-checkbox-wrapper">
                    <input
                      id="dc-enabled"
                      type="checkbox"
                      checked={dcFormData.enabled}
                      onChange={(e) => this._handleDcFormChange("enabled", e.target.checked)}
                    />
                    <label for="dc-enabled">Enabled</label>
                  </div>
                </div>
                <div class="ink-field">
                  <label class="ink-field-label">Priority</label>
                  <input
                    type="number"
                    value={dcFormData.priority}
                    onInput={(e) => this._handleDcFormChange("priority", parseInt(e.target.value, 10) || 0)}
                    placeholder="100"
                  />
                </div>
                <div style="border-top:1px solid var(--ink-border-subtle);padding-top:var(--ink-space-md);margin-top:var(--ink-space-md);">
                  <label class="ink-field-label">Credentials</label>
                  {dcEditing && (
                    <span class="ink-settings-field-hint" style="display:block;margin-bottom:var(--ink-space-sm);">
                      Leave blank to keep existing values. Secrets are never returned by the API.
                    </span>
                  )}
                  {typeNeedsApiKey && (
                    <div class="ink-field">
                      <label class="ink-field-label">API Key</label>
                      <input
                        type="password"
                        value={dcFormData.api_key}
                        onInput={(e) => this._handleDcFormChange("api_key", e.target.value)}
                        placeholder={dcEditing ? "Leave blank to keep current" : "Required when enabled"}
                        autocomplete="off"
                      />
                    </div>
                  )}
                  {typeNeedsPassword && (
                    <div class="ink-field">
                      <label class="ink-field-label">Password</label>
                      <input
                        type="password"
                        value={dcFormData.password}
                        onInput={(e) => this._handleDcFormChange("password", e.target.value)}
                        placeholder={dcEditing ? "Leave blank to keep current" : "Optional"}
                        autocomplete="off"
                      />
                    </div>
                  )}
                  {!typeNeedsApiKey && !typeNeedsPassword && !dcFormData.client_type && (
                    <span class="ink-settings-field-hint">Select a type to see credential fields.</span>
                  )}
                  {!typeNeedsApiKey && !typeNeedsPassword && dcFormData.client_type && (
                    <span class="ink-settings-field-hint">
                      This client type does not require credentials beyond the base URL.
                    </span>
                  )}
                </div>
              </div>
              <div class="ink-dialog-footer">
                <button class="ink-btn-ghost" onClick={() => this.setState({ dcShowForm: false })} type="button">
                  Cancel
                </button>
                <button class="ink-btn-primary" onClick={() => this._handleDcSave()} type="button">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Notification Methods ──────────────────────────────────────────── */

  async _loadNotifConfig() {
    if (!this._mounted) return;
    this.setState({ notifLoading: true, notifError: null });
    try {
      const res = await api.notifications.config();
      if (!this._mounted) return;
      if (res && res.ok) {
        this.setState({ notifConfig: res, notifLoading: false, notifSettingsDirty: null });
      } else {
        this.setState({
          notifError: (res && res.error) || "Failed to load notification config",
          notifLoading: false,
        });
      }
    } catch (err) {
      if (!this._mounted) return;
      this.setState({
        notifError: api.friendlyMessage
          ? api.friendlyMessage(err)
          : err.message || "Failed to load notification config",
        notifLoading: false,
      });
    }
  }

  async _loadNotifDeliveries() {
    if (!this._mounted) return;
    this.setState({ notifDeliveriesLoading: true });
    try {
      const res = await api.notifications.deliveries({ limit: 25 });
      if (!this._mounted) return;
      if (res && res.ok) {
        this.setState({ notifDeliveries: res.deliveries || [], notifDeliveriesLoading: false });
      } else {
        this.setState({ notifDeliveries: [], notifDeliveriesLoading: false });
      }
    } catch (err) {
      if (!this._mounted) return;
      this.setState({ notifDeliveries: [], notifDeliveriesLoading: false });
    }
  }

  _handleNotifSettingsChange(field, value) {
    this.setState((prev) => ({
      notifSettingsDirty: { ...(prev.notifSettingsDirty || {}), [field]: value },
    }));
  }

  _getNotifSetting(field, fallback) {
    const { notifConfig, notifSettingsDirty } = this.state;
    if (notifSettingsDirty && notifSettingsDirty[field] !== undefined) {
      return notifSettingsDirty[field];
    }
    if (notifConfig && notifConfig.settings && notifConfig.settings[field] !== undefined) {
      return notifConfig.settings[field];
    }
    return fallback !== undefined ? fallback : false;
  }

  async _handleNotifSaveSettings() {
    const { notifSettingsDirty } = this.state;
    if (!notifSettingsDirty || Object.keys(notifSettingsDirty).length === 0) {
      toast("No changes to save", "info");
      return;
    }
    this.setState({ notifSaving: true });
    try {
      const res = await api.notifications.saveSettings(notifSettingsDirty);
      if (!this._mounted) return;
      if (res && res.ok) {
        toast("Notification settings saved", "success");
        this.setState({ notifSettingsDirty: null, notifSaving: false });
        this._loadNotifConfig();
      } else {
        toast((res && res.error) || "Failed to save notification settings", "error");
        this.setState({ notifSaving: false });
      }
    } catch (err) {
      if (!this._mounted) return;
      toast(api.friendlyMessage ? api.friendlyMessage(err) : "Failed to save notification settings", "error");
      this.setState({ notifSaving: false });
    }
  }

  _handleNotifAddChannel() {
    this.setState({
      notifShowAddChannel: true,
      notifEditingChannel: null,
      notifChannelForm: { name: "", type: "discord_webhook", config: "{}", enabled: true },
      notifChannelFormError: null,
    });
  }

  _handleNotifEditChannel(channel) {
    this.setState({
      notifShowAddChannel: true,
      notifEditingChannel: channel,
      notifChannelForm: {
        name: channel.name || "",
        type: channel.type || "discord_webhook",
        config: JSON.stringify(channel.config || {}, null, 2),
        enabled: channel.enabled !== false,
      },
      notifChannelFormError: null,
    });
  }

  _handleNotifChannelFormChange(field, value) {
    this.setState((prev) => ({
      notifChannelForm: { ...prev.notifChannelForm, [field]: value },
      notifChannelFormError: null,
    }));
  }

  async _handleNotifSaveChannel() {
    const { notifChannelForm, notifEditingChannel } = this.state;
    if (!notifChannelForm.name.trim()) {
      this.setState({ notifChannelFormError: "Name is required" });
      return;
    }
    let config;
    try {
      config = JSON.parse(notifChannelForm.config || "{}");
    } catch {
      this.setState({ notifChannelFormError: "Config must be valid JSON" });
      return;
    }
    const body = {
      name: notifChannelForm.name.trim(),
      type: notifChannelForm.type,
      config,
      enabled: notifChannelForm.enabled,
    };
    if (notifEditingChannel && notifEditingChannel.id) {
      body.id = notifEditingChannel.id;
    }
    this.setState({ notifSaving: true });
    try {
      const res = await api.notifications.saveChannel(body);
      if (!this._mounted) return;
      if (res && res.ok) {
        toast(notifEditingChannel ? "Channel updated" : "Channel added", "success");
        this.setState({
          notifShowAddChannel: false,
          notifEditingChannel: null,
          notifSaving: false,
        });
        this._loadNotifConfig();
      } else {
        this.setState({
          notifChannelFormError: (res && res.error) || "Failed to save channel",
          notifSaving: false,
        });
      }
    } catch (err) {
      if (!this._mounted) return;
      this.setState({
        notifChannelFormError: api.friendlyMessage ? api.friendlyMessage(err) : err.message,
        notifSaving: false,
      });
    }
  }

  async _handleNotifDeleteChannel(channel) {
    if (!confirm(`Delete channel "${channel.name || channel.id}"?`)) return;
    this.setState({ notifSaving: true });
    try {
      const res = await api.notifications.saveChannel({ id: channel.id, enabled: false, _delete: true });
      if (!this._mounted) return;
      if (res && res.ok) {
        toast("Channel deleted", "success");
        this.setState({ notifSaving: false });
        this._loadNotifConfig();
      } else {
        toast((res && res.error) || "Failed to delete channel", "error");
        this.setState({ notifSaving: false });
      }
    } catch (err) {
      if (!this._mounted) return;
      toast(api.friendlyMessage ? api.friendlyMessage(err) : "Failed to delete channel", "error");
      this.setState({ notifSaving: false });
    }
  }

  _handleNotifCancelChannelForm() {
    this.setState({ notifShowAddChannel: false, notifEditingChannel: null, notifChannelFormError: null });
  }

  _renderNotifications() {
    const {
      notifConfig,
      notifLoading,
      notifError,
      notifSettingsDirty,
      notifSaving,
      notifShowAddChannel,
      notifEditingChannel,
      notifChannelForm,
      notifChannelFormError,
      notifDeliveries,
      notifDeliveriesLoading,
    } = this.state;

    if (notifLoading && !notifConfig) {
      return (
        <div class="ink-settings-loading">
          <div class="ink-spinner" />
          <span>Loading notification settings…</span>
        </div>
      );
    }

    if (notifError) {
      return (
        <div class="ink-settings-error">
          <div>{notifError}</div>
          <button class="ink-btn-ghost ink-btn-sm" onClick={() => this._loadNotifConfig()}>
            Retry
          </button>
        </div>
      );
    }

    const settings = (notifConfig && notifConfig.settings) || {};
    const channels = (notifConfig && notifConfig.channels) || [];
    const hasDirty = notifSettingsDirty && Object.keys(notifSettingsDirty).length > 0;

    return (
      <div>
        {/* ── Notification Settings Section ── */}
        <div class="ink-settings-section">
          <div
            class="ink-settings-section-header"
            onClick={() => this._toggleSection("__notif_settings__")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") this._toggleSection("__notif_settings__");
            }}
          >
            <div>
              <h3>Notification Settings</h3>
              <div class="ink-section-desc">Global notification preferences</div>
            </div>
            <span class={`ink-section-toggle${this.state.collapsedSections["__notif_settings__"] ? "" : " open"}`}>
              ▼
            </span>
          </div>
          {!this.state.collapsedSections["__notif_settings__"] && (
            <div class="ink-settings-section-body">
              <div class="ink-settings-field">
                <div class="ink-checkbox-wrapper">
                  <input
                    id="notif-enabled"
                    type="checkbox"
                    checked={this._getNotifSetting("enabled", true)}
                    onChange={(e) => this._handleNotifSettingsChange("enabled", e.target.checked)}
                  />
                  <label for="notif-enabled">Enabled</label>
                </div>
              </div>
              {Object.keys(settings).filter((k) => k !== "enabled").length > 0 &&
                Object.keys(settings)
                  .filter((k) => k !== "enabled")
                  .map((key) => {
                    const val = this._getNotifSetting(key);
                    const isBool = typeof val === "boolean";
                    return (
                      <div class="ink-settings-field" key={key}>
                        {isBool ? (
                          <div class="ink-checkbox-wrapper">
                            <input
                              id={`notif-${key}`}
                              type="checkbox"
                              checked={!!val}
                              onChange={(e) => this._handleNotifSettingsChange(key, e.target.checked)}
                            />
                            <label for={`notif-${key}`}>
                              {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            </label>
                          </div>
                        ) : (
                          <>
                            <label class="ink-settings-field-label" for={`notif-${key}`}>
                              {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            </label>
                            <input
                              id={`notif-${key}`}
                              type={typeof val === "number" ? "number" : "text"}
                              value={String(val)}
                              onInput={(e) => this._handleNotifSettingsChange(key, e.target.value)}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
              <div style="margin-top:var(--ink-space-md);display:flex;gap:var(--ink-space-sm);">
                <button
                  class="ink-btn-primary ink-btn-sm"
                  onClick={() => this._handleNotifSaveSettings()}
                  disabled={!hasDirty || notifSaving}
                >
                  {notifSaving ? "Saving…" : "Save Settings"}
                </button>
                {hasDirty && (
                  <button class="ink-btn-ghost ink-btn-sm" onClick={() => this.setState({ notifSettingsDirty: null })}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Notification Channels Section ── */}
        <div class="ink-settings-section">
          <div
            class="ink-settings-section-header"
            onClick={() => this._toggleSection("__notif_channels__")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") this._toggleSection("__notif_channels__");
            }}
          >
            <div>
              <h3>Notification Channels</h3>
              <div class="ink-section-desc">Configure where notifications are sent</div>
            </div>
            <span class={`ink-section-toggle${this.state.collapsedSections["__notif_channels__"] ? "" : " open"}`}>
              ▼
            </span>
          </div>
          {!this.state.collapsedSections["__notif_channels__"] && (
            <div class="ink-settings-section-body">
              {channels.length === 0 && !notifShowAddChannel ? (
                <div class="ink-settings-empty">No channels configured. Add one to start receiving notifications.</div>
              ) : (
                <div style="display:flex;flex-direction:column;gap:var(--ink-space-sm);">
                  {channels.map((ch) => (
                    <div class="ink-notif-channel-row" key={ch.id || ch.name}>
                      <div class="ink-notif-channel-info">
                        <span class="ink-notif-channel-name">{ch.name || ch.id}</span>
                        <span class={`ink-pill ${ch.enabled !== false ? "ink-pill-success" : "ink-pill-muted"}`}>
                          {ch.type || "unknown"}
                        </span>
                        {ch.enabled !== false ? (
                          <span class="ink-pill ink-pill-success">Enabled</span>
                        ) : (
                          <span class="ink-pill ink-pill-muted">Disabled</span>
                        )}
                      </div>
                      <div class="ink-notif-channel-actions">
                        <button
                          class="ink-btn-ghost ink-btn-sm"
                          onClick={() => this._handleNotifEditChannel(ch)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          class="ink-btn-ghost ink-btn-sm"
                          style="color:var(--ink-danger)"
                          onClick={() => this._handleNotifDeleteChannel(ch)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Channel Form */}
              {notifShowAddChannel && (
                <div class="ink-settings-provider-form" style="margin-top:var(--ink-space-md);">
                  <h4>{notifEditingChannel ? "Edit Channel" : "Add Channel"}</h4>
                  {notifChannelFormError && (
                    <div class="ink-settings-field-error" style="margin-bottom:var(--ink-space-md);">
                      {notifChannelFormError}
                    </div>
                  )}
                  <div class="ink-settings-field">
                    <label class="ink-settings-field-label" for="notif-ch-name">
                      Name
                    </label>
                    <input
                      id="notif-ch-name"
                      type="text"
                      value={notifChannelForm.name}
                      onInput={(e) => this._handleNotifChannelFormChange("name", e.target.value)}
                      placeholder="My Discord Webhook"
                    />
                  </div>
                  <div class="ink-settings-field">
                    <label class="ink-settings-field-label" for="notif-ch-type">
                      Type
                    </label>
                    <select
                      id="notif-ch-type"
                      value={notifChannelForm.type}
                      onChange={(e) => this._handleNotifChannelFormChange("type", e.target.value)}
                    >
                      <option value="discord_webhook">Discord Webhook</option>
                      <option value="slack_webhook">Slack Webhook</option>
                      <option value="email">Email</option>
                      <option value="webhook">Generic Webhook</option>
                      <option value="gotify">Gotify</option>
                      <option value="pushover">Pushover</option>
                      <option value="telegram">Telegram</option>
                    </select>
                  </div>
                  <div class="ink-settings-field">
                    <label class="ink-settings-field-label" for="notif-ch-config">
                      Config (JSON)
                    </label>
                    <textarea
                      id="notif-ch-config"
                      value={notifChannelForm.config}
                      onInput={(e) => this._handleNotifChannelFormChange("config", e.target.value)}
                      placeholder='{"url": "https://discord.com/api/webhooks/…"}'
                    />
                    <span class="ink-settings-field-hint">Channel-specific configuration as JSON</span>
                  </div>
                  <div class="ink-settings-field">
                    <div class="ink-checkbox-wrapper">
                      <input
                        id="notif-ch-enabled"
                        type="checkbox"
                        checked={notifChannelForm.enabled}
                        onChange={(e) => this._handleNotifChannelFormChange("enabled", e.target.checked)}
                      />
                      <label for="notif-ch-enabled">Enabled</label>
                    </div>
                  </div>
                  <div class="ink-settings-provider-form-actions">
                    <button
                      class="ink-btn-primary ink-btn-sm"
                      onClick={() => this._handleNotifSaveChannel()}
                      disabled={notifSaving}
                    >
                      {notifSaving ? "Saving…" : notifEditingChannel ? "Update Channel" : "Add Channel"}
                    </button>
                    <button
                      class="ink-btn-ghost ink-btn-sm"
                      onClick={() => this._handleNotifCancelChannelForm()}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!notifShowAddChannel && (
                <div style="margin-top:var(--ink-space-md);">
                  <button
                    class="ink-btn-primary ink-btn-sm"
                    onClick={() => this._handleNotifAddChannel()}
                    type="button"
                  >
                    + Add Channel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Recent Deliveries Section (collapsible) ── */}
        <div class="ink-settings-section">
          <div
            class="ink-settings-section-header"
            onClick={() => {
              const wasCollapsed = this.state.collapsedSections["__notif_deliveries__"];
              this._toggleSection("__notif_deliveries__");
              if (wasCollapsed && !notifDeliveries) {
                this._loadNotifDeliveries();
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                const wasCollapsed = this.state.collapsedSections["__notif_deliveries__"];
                this._toggleSection("__notif_deliveries__");
                if (wasCollapsed && !notifDeliveries) {
                  this._loadNotifDeliveries();
                }
              }
            }}
          >
            <div>
              <h3>Recent Deliveries</h3>
              <div class="ink-section-desc">Last 25 notification delivery attempts</div>
            </div>
            <span class={`ink-section-toggle${this.state.collapsedSections["__notif_deliveries__"] ? "" : " open"}`}>
              ▼
            </span>
          </div>
          {!this.state.collapsedSections["__notif_deliveries__"] && (
            <div class="ink-settings-section-body">
              <div style="display:flex;gap:var(--ink-space-sm);margin-bottom:var(--ink-space-md);">
                <button
                  class="ink-btn-ghost ink-btn-sm"
                  onClick={() => this._loadNotifDeliveries()}
                  disabled={notifDeliveriesLoading}
                  type="button"
                >
                  {notifDeliveriesLoading ? "Loading…" : "↻ Refresh"}
                </button>
              </div>
              {notifDeliveriesLoading && !notifDeliveries ? (
                <div class="ink-settings-loading">
                  <div class="ink-spinner" />
                  <span>Loading deliveries…</span>
                </div>
              ) : notifDeliveries && notifDeliveries.length > 0 ? (
                <div class="ink-notif-deliveries-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Recipient</th>
                        <th>Channel</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifDeliveries.map((d, i) => (
                        <tr key={d.id || i}>
                          <td>{d.recipient || d.to || "—"}</td>
                          <td>
                            <span class={`ink-pill ${d.channel_type ? "ink-pill-info" : "ink-pill-muted"}`}>
                              {d.channel_type || d.channel || "—"}
                            </span>
                          </td>
                          <td>
                            <span
                              class={`ink-pill ${
                                d.status === "success" || d.status === "sent"
                                  ? "ink-pill-success"
                                  : d.status === "failed" || d.status === "error"
                                    ? "ink-pill-danger"
                                    : "ink-pill-muted"
                              }`}
                            >
                              {d.status || "unknown"}
                            </span>
                          </td>
                          <td style="white-space:nowrap;font-size:var(--ink-text-xs);color:var(--ink-text-muted);">
                            {d.created_at || d.date || d.timestamp
                              ? new Date(d.created_at || d.date || d.timestamp).toLocaleString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div class="ink-settings-empty">No deliveries yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  _renderBackupSection() {
    return (
      <div class="ink-settings-section">
        <div
          class="ink-settings-section-header"
          onClick={() => this._toggleSection("__backup__")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") this._toggleSection("__backup__");
          }}
        >
          <div>
            <h3>Backup & Restore</h3>
            <div class="ink-section-desc">Export, preview, and restore your InkDrop settings</div>
          </div>
          <span class={`ink-section-toggle${this.state.collapsedSections["__backup__"] ? "" : " open"}`}>▼</span>
        </div>
        {!this.state.collapsedSections["__backup__"] && (
          <div class="ink-settings-section-body">
            <div class="ink-settings-backup-actions">
              <button
                class="ink-btn-primary ink-btn-sm"
                onClick={this._handleBackupExport}
                disabled={this.state.backupLoading}
              >
                {this.state.backupLoading ? "Exporting…" : "📤 Export Backup"}
              </button>
            </div>

            <div class="ink-settings-backup-restore-area">
              <label class="ink-settings-field-label">Restore from Backup</label>
              <textarea
                value={this.state.restoreText}
                onInput={(e) => this.setState({ restoreText: e.target.value })}
                placeholder="Paste backup JSON here to preview and restore…"
              />
              <div class="ink-settings-backup-actions">
                <button
                  class="ink-btn-ghost ink-btn-sm"
                  onClick={this._handleBackupPreview}
                  disabled={this.state.backupPreviewLoading || !this.state.restoreText.trim()}
                >
                  {this.state.backupPreviewLoading ? "Generating…" : "🔍 Preview"}
                </button>
                <button
                  class="ink-btn-danger ink-btn-sm"
                  onClick={this._handleBackupRestore}
                  disabled={this.state.restoreLoading || !this.state.restoreText.trim()}
                >
                  {this.state.restoreLoading ? "Restoring…" : "⚠️ Restore"}
                </button>
              </div>
            </div>

            {this.state.backupPreview && (
              <div class="ink-settings-backup-preview">
                <pre>{JSON.stringify(this.state.backupPreview, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── Main Render ───────────────────────────────────────────────────── */

  render() {
    const { area, loading, error, data, showAdvanced, searchQuery, unsavedChanges } = this.state;

    const areaLabels = {
      setup: "Setup",
      media_management: "Media Management",
      language: "Language",
      indexers: "Indexers",
      download_clients: "Download Clients",
      connect: "Connect",
      metadata: "Metadata",
      general: "General",
      ui: "UI",
      root_folders: "Paths",
      notifications: "Notifications",
    };

    const areaLabel = areaLabels[area] || area;

    return (
      <div class="ink-settings-page">
        <style>{styles}</style>

        {/* Toolbar */}
        <div class="ink-settings-toolbar">
          <div class="ink-settings-toolbar-left">
            <div class="ink-settings-search">
              <input
                type="search"
                placeholder="Search settings…"
                value={searchQuery}
                onInput={(e) => this.setState({ searchQuery: e.target.value })}
                aria-label="Search settings"
              />
            </div>
            <label class="ink-settings-advanced-toggle">
              <input
                type="checkbox"
                checked={showAdvanced}
                onChange={(e) => this.setState({ showAdvanced: e.target.checked })}
              />
              Show Advanced
            </label>
          </div>
          <div class="ink-settings-toolbar-right">
            {unsavedChanges && <span class="ink-settings-unsaved">Unsaved changes</span>}
            <button class="ink-btn-ghost ink-btn-sm" onClick={this._handleSync} title="Refresh settings from disk">
              ↻ Sync
            </button>
            {unsavedChanges && (
              <button class="ink-btn-primary ink-btn-sm" onClick={this._handleSave}>
                💾 Save
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div class="ink-settings-loading">
            <div class="ink-spinner" />
            <span>Loading {areaLabel} settings…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div class="ink-settings-error">
            <div>{error}</div>
            <button class="ink-btn-ghost ink-btn-sm" onClick={() => this._loadSettings()}>
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && data && (
          <div>
            {/* Download Clients — special placeholder */}
            {area === "download_clients" ? (
              this._renderDownloadClients()
            ) : area === "notifications" ? (
              this._renderNotifications()
            ) : (
              <>
                {/* Provider/Indexer areas — show provider cards + form */}
                {area === "indexers" || area === "connect" ? (
                  <>
                    {this._renderProviders()}
                    {this._renderBackupSection()}
                  </>
                ) : (
                  <>
                    {/* App settings sections */}
                    {data.areas && data.areas.length > 0 ? (
                      data.areas.map((section) => this._renderSection(section))
                    ) : data.app && Object.keys(data.app).length > 0 ? (
                      /* Fallback: render app keys as a single section */
                      <div class="ink-settings-section">
                        <div
                          class="ink-settings-section-header"
                          onClick={() => this._toggleSection("__app__")}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") this._toggleSection("__app__");
                          }}
                        >
                          <div>
                            <h3>{areaLabel} Settings</h3>
                          </div>
                          <span class={`ink-section-toggle${this.state.collapsedSections["__app__"] ? "" : " open"}`}>
                            ▼
                          </span>
                        </div>
                        {!this.state.collapsedSections["__app__"] && (
                          <div class="ink-settings-section-body">
                            {Object.entries(data.app).map(([key, value]) => (
                              <div class="ink-settings-field" key={key}>
                                <label class="ink-settings-field-label">{key}</label>
                                <input type="text" value={String(value)} disabled />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div class="ink-settings-empty">No settings available for this area.</div>
                    )}

                    {this._renderBackupSection()}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* No data, no error, not loading — empty state */}
        {!loading && !error && !data && (
          <div class="ink-settings-empty">
            No settings data loaded.
            <div style="margin-top:var(--ink-space-md)">
              <button class="ink-btn-primary ink-btn-sm" onClick={() => this._loadSettings()}>
                Load Settings
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export { SettingsPage };
export default SettingsPage;
