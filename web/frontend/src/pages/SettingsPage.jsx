/**
 * InkDrop — Settings Page
 * Full settings management: app settings, provider/indexer CRUD, backup/restore,
 * download clients placeholder, advanced toggle, search, and unsaved changes tracking.
 */

import { h, Component } from 'preact';
import api from '../api/client.jsx';
import { toast } from '../main.jsx';

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
    const hash = window.location.hash || '';
    const m = hash.match(/[?&]area=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : 'setup';
  } catch {
    return 'setup';
  }
}

function getFieldType(schema) {
  if (!schema) return 'text';
  if (schema.type === 'boolean') return 'checkbox';
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.enum && Array.isArray(schema.enum)) return 'select';
  if (schema.type === 'password') return 'password';
  if (schema.format === 'uri' || schema.format === 'url') return 'url';
  if (schema.type === 'textarea') return 'textarea';
  if (schema.type === 'range') return 'range';
  return 'text';
}

function getFieldDefault(schema) {
  if (!schema) return '';
  if (schema.default !== undefined && schema.default !== null) return schema.default;
  if (schema.type === 'boolean') return false;
  if (schema.type === 'integer' || schema.type === 'number') return 0;
  return '';
}

function coerceValue(value, schema) {
  if (schema.type === 'boolean') return !!value;
  if (schema.type === 'integer') return parseInt(value, 10) || 0;
  if (schema.type === 'number') return parseFloat(value) || 0;
  return value;
}

function isAdvancedField(schema) {
  return schema && (schema.advanced === true || schema.category === 'advanced');
}

function fieldMatchesSearch(fieldKey, schema, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const key = (fieldKey || '').toLowerCase();
  const label = ((schema && schema.label) || '').toLowerCase();
  const hint = ((schema && schema.hint) || '').toLowerCase();
  return key.includes(q) || label.includes(q) || hint.includes(q);
}

function sectionMatchesSearch(section, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const name = (section.name || section.key || '').toLowerCase();
  const desc = (section.description || '').toLowerCase();
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
      searchQuery: '',
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
      restoreText: '',
      restoreLoading: false,
      // Collapsed sections
      collapsedSections: {},
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
  }

  componentDidMount() {
    window.addEventListener('hashchange', this._onHashChange);
    this._loadSettings();
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this._onHashChange);
  }

  _onHashChange() {
    const newArea = getAreaFromHash();
    if (newArea !== this.state.area) {
      this.setState({
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
        restoreText: '',
        searchQuery: '',
      }, () => this._loadSettings());
    }
  }

  async _loadSettings() {
    const { area } = this.state;
    this.setState({ loading: true, error: null });
    try {
      const data = await api.settings.get(area);
      if (data && data.ok) {
        this.setState({ data: data.settings || data, loading: false });
      } else {
        this.setState({
          error: (data && data.error) || 'Failed to load settings',
          loading: false,
        });
      }
    } catch (err) {
      this.setState({
        error: api.friendlyMessage ? api.friendlyMessage(err) : (err.message || 'Failed to load settings'),
        loading: false,
      });
    }
  }

  async _handleSync() {
    const { area } = this.state;
    toast('Syncing settings from disk…', 'info');
    try {
      const data = await api.settings.sync(area);
      if (data && data.ok) {
        toast('Settings synced', 'success');
        this._loadSettings();
      } else {
        toast((data && data.error) || 'Sync failed', 'error');
      }
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : 'Sync failed', 'error');
    }
  }

  /* ── Field Change Handling ─────────────────────────────────────────── */

  _handleFieldChange(sectionKey, fieldKey, schema, value) {
    const coerced = coerceValue(value, schema);
    this.setState(prev => {
      const dirtyFields = { ...prev.dirtyFields };
      if (!dirtyFields[sectionKey]) dirtyFields[sectionKey] = {};
      dirtyFields[sectionKey][fieldKey] = coerced;
      return {
        dirtyFields,
        unsavedChanges: Object.keys(dirtyFields).some(sk => Object.keys(dirtyFields[sk]).length > 0),
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
      toast('No changes to save', 'info');
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
            toast(`Failed to save ${fieldKey}: ${(result && result.error) || 'unknown error'}`, 'error');
          }
        } catch (err) {
          errors++;
          toast(`Failed to save ${fieldKey}: ${api.friendlyMessage ? api.friendlyMessage(err) : err.message}`, 'error');
        }
      }
    }

    if (errors === 0 && saved > 0) {
      toast(`Saved ${saved} setting${saved !== 1 ? 's' : ''}`, 'success');
      this.setState({ dirtyFields: {}, unsavedChanges: false });
      this._loadSettings();
    } else if (saved > 0) {
      toast(`Saved ${saved} setting${saved !== 1 ? 's' : ''} (${errors} failed)`, 'warning');
      this.setState({ dirtyFields: {}, unsavedChanges: false });
      this._loadSettings();
    }
  }

  /* ── Provider CRUD ─────────────────────────────────────────────────── */

  _handleProviderAdd() {
    this.setState({
      editingProvider: '__new__',
      providerFormData: { name: '', type: '', config: {} },
      providerFormErrors: null,
    });
  }

  _handleProviderEdit(provider) {
    this.setState({
      editingProvider: provider.id,
      providerFormData: {
        name: provider.name || '',
        type: provider.type || '',
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
        toast('Provider deleted', 'success');
        this._loadSettings();
      } else {
        toast((result && result.error) || 'Failed to delete provider', 'error');
      }
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : 'Failed to delete provider', 'error');
    }
  }

  async _handleProviderTest(provider) {
    this.setState({ testingProvider: provider.id });
    try {
      const result = await api.settings.providerTest({ id: provider.id, revision: provider.revision });
      if (result && result.ok) {
        toast(`Test successful: ${result.message || 'Provider is reachable'}`, 'success');
      } else {
        toast((result && result.error) || 'Test failed', 'error');
      }
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : 'Test failed', 'error');
    } finally {
      this.setState({ testingProvider: null });
    }
  }

  _handleProviderFormChange(field, value) {
    this.setState(prev => ({
      providerFormData: { ...prev.providerFormData, [field]: value },
      providerFormErrors: null,
    }));
  }

  async _handleProviderFormSubmit() {
    const { editingProvider, providerFormData } = this.state;
    if (!providerFormData.name || !providerFormData.type) {
      this.setState({ providerFormErrors: 'Name and type are required' });
      return;
    }

    try {
      let result;
      if (editingProvider === '__new__') {
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
        toast(editingProvider === '__new__' ? 'Provider added' : 'Provider updated', 'success');
        this.setState({
          editingProvider: null,
          providerFormData: null,
          providerFormErrors: null,
        });
        this._loadSettings();
      } else {
        this.setState({ providerFormErrors: (result && result.error) || 'Operation failed' });
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
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inkdrop-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast('Backup exported', 'success');
      } else {
        toast((result && result.error) || 'Export failed', 'error');
      }
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : 'Export failed', 'error');
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
        toast('Preview generated', 'success');
      } else {
        toast((result && result.error) || 'Preview failed', 'error');
      }
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : 'Preview failed', 'error');
    } finally {
      this.setState({ backupPreviewLoading: false });
    }
  }

  async _handleBackupRestore() {
    if (!this.state.restoreText.trim()) {
      toast('Paste backup data first', 'warning');
      return;
    }
    if (!confirm('Are you sure you want to restore from this backup? This will overwrite current settings.')) return;

    this.setState({ restoreLoading: true });
    try {
      const result = await api.settings.backupRestore(this.state.restoreText);
      if (result && result.ok) {
        toast('Backup restored successfully', 'success');
        this.setState({ restoreText: '', backupPreview: null });
        this._loadSettings();
      } else {
        toast((result && result.error) || 'Restore failed', 'error');
      }
    } catch (err) {
      toast(api.friendlyMessage ? api.friendlyMessage(err) : 'Restore failed', 'error');
    } finally {
      this.setState({ restoreLoading: false });
    }
  }

  /* ── Section Collapse ───────────────────────────────────────────────── */

  _toggleSection(key) {
    this.setState(prev => {
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
      if (type === 'checkbox') {
        val = e.target.checked;
      } else if (type === 'number' || type === 'range') {
        val = e.target.value;
      } else {
        val = e.target.value;
      }
      this._handleFieldChange(sectionKey, fieldKey, schema, val);
    };

    let input;
    switch (type) {
      case 'checkbox':
        input = (
          <div class="ink-checkbox-wrapper">
            <input
              id={inputId}
              type="checkbox"
              checked={!!value}
              onChange={handleChange}
            />
            <label for={inputId}>{schema.label || fieldKey}</label>
          </div>
        );
        break;

      case 'select':
        input = (
          <select id={inputId} value={String(value)} onChange={handleChange}>
            {schema.enum.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
        break;

      case 'textarea':
        input = (
          <textarea
            id={inputId}
            value={String(value)}
            onInput={handleChange}
            placeholder={schema.placeholder || ''}
          />
        );
        break;

      case 'range':
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
            <div class="ink-settings-range-value">{value}{schema.unit || ''}</div>
          </div>
        );
        break;

      case 'password':
        input = (
          <input
            id={inputId}
            type="password"
            value={String(value)}
            onInput={handleChange}
            placeholder={schema.placeholder || ''}
            autocomplete="off"
            spellcheck="false"
          />
        );
        break;

      case 'url':
        input = (
          <input
            id={inputId}
            type="url"
            value={String(value)}
            onInput={handleChange}
            placeholder={schema.placeholder || 'https://…'}
            spellcheck="false"
          />
        );
        break;

      case 'number':
        input = (
          <input
            id={inputId}
            type="number"
            value={value}
            onInput={handleChange}
            min={schema.minimum}
            max={schema.maximum}
            step={schema.step || 'any'}
            placeholder={schema.placeholder || ''}
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
            placeholder={schema.placeholder || ''}
            spellcheck="false"
          />
        );
    }

    return (
      <div class="ink-settings-field" key={fieldKey}>
        {type !== 'checkbox' && (
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
    const sectionKey = section.key || section.name || 'unknown';
    const isCollapsed = !!this.state.collapsedSections[sectionKey];
    const fields = section.fields || {};
    const fieldKeys = Object.keys(fields);

    // Filter by search
    const query = this.state.searchQuery;
    const visibleFields = fieldKeys.filter(k => {
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
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') this._toggleSection(sectionKey); }}
        >
          <div>
            <h3>{section.label || section.name || sectionKey}</h3>
            {section.description && <div class="ink-section-desc">{section.description}</div>}
          </div>
          <span class={`ink-section-toggle${isCollapsed ? '' : ' open'}`}>▼</span>
        </div>
        {!isCollapsed && (
          <div class="ink-settings-section-body">
            {visibleFields.length > 0 ? (
              visibleFields.map(fk => this._renderField(sectionKey, fk, fields[fk]))
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
        <h4>{this.state.editingProvider === '__new__' ? 'Add Provider' : 'Edit Provider'}</h4>

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
              onInput={(e) => this._handleProviderFormChange('name', e.target.value)}
              placeholder="My Indexer"
            />
          </div>
          <div class="ink-settings-field">
            <label class="ink-settings-field-label">Type</label>
            <input
              type="text"
              value={providerFormData.type}
              onInput={(e) => this._handleProviderFormChange('type', e.target.value)}
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
                this._handleProviderFormChange('config', parsed);
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
            {this.state.editingProvider === '__new__' ? 'Add Provider' : 'Update Provider'}
          </button>
          <button class="ink-btn-ghost" onClick={this._handleProviderFormCancel}>Cancel</button>
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
          <div class="ink-settings-empty">
            No providers configured. Click "Add Provider" to get started.
          </div>
        ) : (
          <div class="ink-settings-providers">
            {providers.map(provider => (
              <div class="ink-settings-provider-card" key={provider.id}>
                <div class="ink-settings-provider-card-header">
                  <div>
                    <div class="ink-settings-provider-card-name">{provider.name || provider.id}</div>
                    <div class="ink-settings-provider-card-type">{provider.type || 'Unknown type'}</div>
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
                      {this.state.testingProvider === provider.id ? '…' : '🔍'}
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
                    {Object.entries(provider.config).slice(0, 4).map(([k, v]) => (
                      <span key={k}>
                        <dt>{k}:</dt>{' '}
                        <dd>{typeof v === 'string' && v.length > 40 ? v.slice(0, 40) + '…' : JSON.stringify(v)}</dd>{' '}
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

  _renderDownloadClients() {
    return (
      <div class="ink-settings-dc-placeholder">
        <div style="font-size:2rem;opacity:0.4">📥</div>
        <h3 style="font-size:var(--ink-text-lg);font-weight:600">Download Clients</h3>
        <p>
          Manage your download clients — SABnzbd, NZBGet, qBittorrent, Deluge, and more.
          Configure connections, test connectivity, and monitor active downloads.
        </p>
        <button
          class="ink-btn-primary ink-btn-lg"
          onClick={() => window.dispatchEvent(new CustomEvent('inkdrop:open-download-clients'))}
        >
          Open Download Clients
        </button>
      </div>
    );
  }

  _renderBackupSection() {
    return (
      <div class="ink-settings-section">
        <div class="ink-settings-section-header"
          onClick={() => this._toggleSection('__backup__')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') this._toggleSection('__backup__'); }}
        >
          <div>
            <h3>Backup & Restore</h3>
            <div class="ink-section-desc">Export, preview, and restore your InkDrop settings</div>
          </div>
          <span class={`ink-section-toggle${this.state.collapsedSections['__backup__'] ? '' : ' open'}`}>▼</span>
        </div>
        {!this.state.collapsedSections['__backup__'] && (
          <div class="ink-settings-section-body">
            <div class="ink-settings-backup-actions">
              <button
                class="ink-btn-primary ink-btn-sm"
                onClick={this._handleBackupExport}
                disabled={this.state.backupLoading}
              >
                {this.state.backupLoading ? 'Exporting…' : '📤 Export Backup'}
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
                  {this.state.backupPreviewLoading ? 'Generating…' : '🔍 Preview'}
                </button>
                <button
                  class="ink-btn-danger ink-btn-sm"
                  onClick={this._handleBackupRestore}
                  disabled={this.state.restoreLoading || !this.state.restoreText.trim()}
                >
                  {this.state.restoreLoading ? 'Restoring…' : '⚠️ Restore'}
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
      setup: 'Setup',
      media_management: 'Media Management',
      language: 'Language',
      indexers: 'Indexers',
      download_clients: 'Download Clients',
      connect: 'Connect',
      metadata: 'Metadata',
      general: 'General',
      ui: 'UI',
      root_folders: 'Paths',
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
            {area === 'download_clients' ? (
              this._renderDownloadClients()
            ) : (
              <>
                {/* Provider/Indexer areas — show provider cards + form */}
                {(area === 'indexers' || area === 'connect') ? (
                  <>
                    {this._renderProviders()}
                    {this._renderBackupSection()}
                  </>
                ) : (
                  <>
                    {/* App settings sections */}
                    {data.areas && data.areas.length > 0 ? (
                      data.areas.map(section => this._renderSection(section))
                    ) : data.app && Object.keys(data.app).length > 0 ? (
                      /* Fallback: render app keys as a single section */
                      <div class="ink-settings-section">
                        <div class="ink-settings-section-header"
                          onClick={() => this._toggleSection('__app__')}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') this._toggleSection('__app__'); }}
                        >
                          <div>
                            <h3>{areaLabel} Settings</h3>
                          </div>
                          <span class={`ink-section-toggle${this.state.collapsedSections['__app__'] ? '' : ' open'}`}>▼</span>
                        </div>
                        {!this.state.collapsedSections['__app__'] && (
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
                      <div class="ink-settings-empty">
                        No settings available for this area.
                      </div>
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
