/**
 * InkDrop — AuthGate component
 * Handles login, bootstrap, session validation, and account management.
 */

import { h, Component } from 'preact';
import { appStore } from '../stores/app-store.jsx';
import api from '../api/client.jsx';
import { toast } from '../main.jsx';

class AuthGate extends Component {
  constructor() {
    super();
    this.state = {
      loading: true,
      username: '',
      password: '',
      error: null,
      showBootstrap: false,
      showAccount: false,
      newPassword: '',
      currentPassword: '',
      confirmPassword: '',
      passwordError: null,
    };
    this._onSessionExpired = this._onSessionExpired.bind(this);
    this._onAuthState = this._onAuthState.bind(this);
  }

  componentDidMount() {
    window.addEventListener('inkdrop:session-expired', this._onSessionExpired);
    window.addEventListener('inkdrop-auth-state', this._onAuthState);
    // Re-render when auth-related store keys change
    this._unsubs = [
      appStore.subscribeKey('authenticated', () => this.forceUpdate()),
      appStore.subscribeKey('authReady', () => this.forceUpdate()),
      appStore.subscribeKey('setupRequired', () => this.forceUpdate()),
      appStore.subscribeKey('bootstrapRequired', () => this.forceUpdate()),
    ];
    // Start session polling if authenticated
    this._startSessionPoll();
  }

  componentWillUnmount() {
    window.removeEventListener('inkdrop:session-expired', this._onSessionExpired);
    window.removeEventListener('inkdrop-auth-state', this._onAuthState);
    if (this._unsubs) this._unsubs.forEach(fn => fn());
    this._stopSessionPoll();
  }

  _onSessionExpired() {
    if (!window.__inkdropAuthReady) return;
    appStore.setMany({ authenticated: false, principal: null });
  }

  _onAuthState(e) {
    const detail = e.detail || {};
    if (detail.administrator !== undefined) {
      appStore.set('administrator', detail.administrator);
    }
  }

  _startSessionPoll() {
    this._stopSessionPoll();
    this._pollTimer = setInterval(async () => {
      if (!appStore.get('authenticated')) return;
      try {
        const data = await api.auth.session();
        if (!data.ok) {
          appStore.setMany({ authenticated: false, principal: null });
          this._stopSessionPoll();
        }
      } catch {
        // network error, don't force logout
      }
    }, 60000);
  }

  _stopSessionPoll() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  }

  async _handleLogin(e) {
    e.preventDefault();
    this.setState({ error: null });
    try {
      const data = await api.auth.login(this.state.username, this.state.password);
      if (data.ok) {
        await api.refreshAuthContract();
        const session = await api.auth.session();
        appStore.setMany({
          authenticated: true,
          principal: session.principal,
          administrator: !!session.principal?.administrator,
        });
        toast('Signed in', 'success');
        this._startSessionPoll();
      } else {
        this.setState({ error: data.error || 'Login failed' });
      }
    } catch (err) {
      this.setState({ error: api.friendlyMessage(err) });
    }
  }

  async _handleBootstrap(e) {
    e.preventDefault();
    this.setState({ error: null });
    if (this.state.password !== this.state.confirmPassword) {
      this.setState({ error: 'Passwords do not match' });
      return;
    }
    try {
      const data = await api.auth.bootstrap(this.state.username, this.state.password);
      if (data.ok) {
        await api.refreshAuthContract();
        const session = await api.auth.session();
        appStore.setMany({
          authenticated: true,
          principal: session.principal,
          administrator: true,
          setupRequired: false,
          bootstrapRequired: false,
        });
        toast('Admin account created', 'success');
        this._startSessionPoll();
      } else {
        this.setState({ error: data.error || 'Setup failed' });
      }
    } catch (err) {
      this.setState({ error: api.friendlyMessage(err) });
    }
  }

  async _handleLogout() {
    try { await api.auth.logout(); } catch { /* ignore */ }
    appStore.setMany({ authenticated: false, principal: null, administrator: false });
    this._stopSessionPoll();
    toast('Signed out', 'info');
  }

  render() {
    const { authenticated, authReady, setupRequired, bootstrapRequired } = appStore.snapshot();

    if (!authReady) {
      return (
        <div class="ink-loading" style="min-height:100vh">
          <div class="ink-spinner" />
        </div>
      );
    }

    // No auth required
    if (appStore.get('authStatus')?.required === false) {
      if (!authenticated) {
        // Mark as authenticated without login
        appStore.setMany({ authenticated: true, administrator: false });
      }
      return this.props.children;
    }

    // Not authenticated — show login/bootstrap
    if (!authenticated) {
      if (bootstrapRequired || setupRequired) {
        return this._renderBootstrap();
      }
      return this._renderLogin();
    }

    // Authenticated — show app
    return this.props.children;
  }

  _renderLogin() {
    return (
      <div class="ink-auth-root">
        <div class="ink-auth-card">
          <div class="ink-auth-logo">
            <img src="/inkdrop-logo-mark.png" alt="InkDrop" />
          </div>
          <h1 class="ink-auth-title">Sign In</h1>
          <p class="ink-auth-subtitle">Access your InkDrop library manager</p>
          {this.state.error && <div class="ink-auth-error">{this.state.error}</div>}
          <form class="ink-auth-form" onSubmit={(e) => this._handleLogin(e)}>
            <div class="ink-field">
              <label class="ink-field-label" for="inkdrop-username">Username</label>
              <input
                id="inkdrop-username"
                type="text"
                autocomplete="username"
                autocapitalize="none"
                spellcheck="false"
                value={this.state.username}
                onInput={(e) => this.setState({ username: e.target.value })}
              />
            </div>
            <div class="ink-field">
              <label class="ink-field-label" for="inkdrop-password">Password</label>
              <input
                id="inkdrop-password"
                type="password"
                autocomplete="current-password"
                value={this.state.password}
                onInput={(e) => this.setState({ password: e.target.value })}
              />
            </div>
            <button type="submit" class="ink-btn-primary ink-btn-lg">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  _renderBootstrap() {
    return (
      <div class="ink-auth-root">
        <div class="ink-auth-card">
          <div class="ink-auth-logo">
            <img src="/inkdrop-logo-mark.png" alt="InkDrop" />
          </div>
          <h1 class="ink-auth-title">Welcome to InkDrop</h1>
          <p class="ink-auth-subtitle">Create your administrator account to get started</p>
          {this.state.error && <div class="ink-auth-error">{this.state.error}</div>}
          <form class="ink-auth-form" onSubmit={(e) => this._handleBootstrap(e)}>
            <div class="ink-field">
              <label class="ink-field-label" for="inkdrop-new-username">Username</label>
              <input
                id="inkdrop-new-username"
                type="text"
                autocomplete="username"
                autocapitalize="none"
                spellcheck="false"
                value={this.state.username}
                onInput={(e) => this.setState({ username: e.target.value })}
              />
            </div>
            <div class="ink-field">
              <label class="ink-field-label" for="inkdrop-new-password">Password</label>
              <input
                id="inkdrop-new-password"
                type="password"
                autocomplete="new-password"
                value={this.state.password}
                onInput={(e) => this.setState({ password: e.target.value })}
              />
            </div>
            <div class="ink-field">
              <label class="ink-field-label" for="inkdrop-confirm-password">Confirm Password</label>
              <input
                id="inkdrop-confirm-password"
                type="password"
                autocomplete="new-password"
                value={this.state.confirmPassword}
                onInput={(e) => this.setState({ confirmPassword: e.target.value })}
              />
            </div>
            <button type="submit" class="ink-btn-primary ink-btn-lg">Create Account</button>
          </form>
        </div>
      </div>
    );
  }
}

export { AuthGate };