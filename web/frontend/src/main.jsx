/**
 * InkDrop — App entry point
 * Bootstraps auth, router, and mounts the Preact app.
 */

import { h, render } from 'preact';
import { appStore, useStoreKey } from './stores/app-store.jsx';
import api from './api/client.jsx';
import { router } from './router.jsx';

// Layout
import { AppShell } from './components/AppShell.jsx';
import { AuthGate } from './components/AuthGate.jsx';

// Pages
import { SeriesPage } from './pages/SeriesPage.jsx';
import { WantedPage } from './pages/WantedPage.jsx';
import { ActivityPage } from './pages/ActivityPage.jsx';
import { QueuePage } from './pages/QueuePage.jsx';
import { HistoryPage } from './pages/HistoryPage.jsx';
import { ManualReviewPage } from './pages/ManualReviewPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { SystemPage } from './pages/SystemPage.jsx';
import { CalendarPage } from './pages/CalendarPage.jsx';

// Overlays
import { ManualSearchOverlay } from './components/ManualSearchOverlay.jsx';
import { ToastContainer } from './components/Toast.jsx';

// Styles
import './styles/base.css';
import './styles/layout.css';
import './styles/sidebar.css';
import './styles/auth.css';

// ── Toast helper ──────────────────────────────────────────────────────
let _toastId = 0;
export function toast(message, type = 'info', duration = 4000) {
  const id = ++_toastId;
  const toasts = [...appStore.get('toasts'), { id, message, type, duration }];
  appStore.set('toasts', toasts);
  setTimeout(() => {
    appStore.set('toasts', appStore.get('toasts').filter(t => t.id !== id));
  }, duration);
}

// ── Auth bootstrap ────────────────────────────────────────────────────
async function initAuth() {
  try {
    await api.refreshAuthContract();
    const data = await api.auth.status();
    if (data.ok && data.auth) {
      const bootstrapRequired = !!(data.auth.built_in_auth?.bootstrap_required);
      const setupRequired = !!data.auth.setup_required;

      // If setup is required (no admin exists), show bootstrap
      if (setupRequired && bootstrapRequired) {
        appStore.setMany({
          authStatus: data.auth,
          authReady: true,
          authenticated: false,
          administrator: false,
          setupRequired: true,
          bootstrapRequired: true,
        });
        return;
      }

      // Try to validate existing session
      let authenticated = false;
      let principal = null;
      let administrator = false;
      try {
        const session = await api.auth.session();
        if (session.ok && session.principal) {
          authenticated = true;
          principal = session.principal;
          administrator = !!session.principal.administrator;
        }
      } catch {
        // Session invalid or expired — will show login
      }

      appStore.setMany({
        authStatus: data.auth,
        authReady: true,
        authenticated,
        principal,
        administrator,
        setupRequired: false,
        bootstrapRequired: false,
      });
    } else {
      // Auth status endpoint returned error — assume no auth required
      appStore.setMany({ authReady: true, authStatus: { required: false }, authenticated: true, administrator: false });
    }
  } catch (err) {
    console.error('Auth init failed:', err);
    // Network error — allow app to load, user can retry
    appStore.setMany({ authReady: true, authStatus: { required: false }, authenticated: true, administrator: false });
  }
}

// ── Status polling ───────────────────────────────────────────────────
let _statusTimer = null;
async function pollStatus() {
  try {
    const data = await api.system.status();
    if (data.ok) {
      appStore.set('sectionsData', data);
    }
  } catch { /* ignore */ }
}

function startStatusPolling() {
  if (_statusTimer) clearInterval(_statusTimer);
  pollStatus();
  _statusTimer = setInterval(pollStatus, 30000);
}

// ── Hash-based routing (preact-iso for future SPA, hash for now) ─────
function resolvePage(section) {
  switch (section) {
    case 'series': return SeriesPage;
    case 'wanted': return WantedPage;
    case 'activity': return ActivityPage;
    case 'queue': return QueuePage;
    case 'history': return HistoryPage;
    case 'manual_review': return ManualReviewPage;
    case 'settings': return SettingsPage;
    case 'system': return SystemPage;
    case 'calendar': return CalendarPage;
    default: return SeriesPage;
  }
}

// ── Main App Component ───────────────────────────────────────────────
function App() {
  const section = useStoreKey(appStore, 'currentSection');
  const Page = resolvePage(section);

  return (
    <AuthGate>
      <AppShell>
        <Page key={section} />
      </AppShell>
      <ManualSearchOverlay />
      <ToastContainer />
    </AuthGate>
  );
}

// ── Mount ─────────────────────────────────────────────────────────────
async function boot() {
  await initAuth();
  router.startRouter();
  if (appStore.get('authenticated')) {
    startStatusPolling();
  }
  appStore.subscribeKey('authenticated', (val) => {
    if (val) startStatusPolling();
    else if (_statusTimer) { clearInterval(_statusTimer); _statusTimer = null; }
  });
  render(<App />, document.getElementById('app'));
}

boot();