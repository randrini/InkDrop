/**
 * InkDrop — AppShell component
 * Sidebar + topbar + page area layout shell.
 */

import { h, Component } from 'preact';
import { appStore } from '../stores/app-store.jsx';
import { router } from '../router.jsx';
import { toast } from '../main.jsx';
import api from '../api/client.jsx';

const NAV_ITEMS = [
  { section: 'calendar', label: 'Calendar', icon: '📅', group: 'Library', feature: 'calendar' },
  { section: 'series', label: 'Series', icon: '📚', group: 'Library' },
  { group: 'Operations' },
  { section: 'wanted', label: 'Wanted', icon: '🎯', group: 'Operations' },
  { section: 'activity', label: 'Activity', icon: '⚡', group: 'Operations' },
  { section: 'queue', label: 'Queue', icon: '📋', group: 'Activity', parent: 'activity' },
  { section: 'history', label: 'History', icon: '🕐', group: 'Activity', parent: 'activity' },
  { section: 'source_memory', label: 'Blocklist', icon: '🚫', group: 'Activity', parent: 'activity' },
  { section: 'manual_review', label: 'Manual Review', icon: '🔍', group: 'Operations' },
  { group: 'Administration' },
  { section: 'settings', label: 'Settings', icon: '⚙️', group: 'Administration' },
  { section: 'system', label: 'System', icon: '🖥️', group: 'Administration' },
];

const SECTION_TITLES = {
  calendar: { title: 'Calendar', eyebrow: 'InkDrop', description: 'What came out, on which day, and whether you have it.' },
  series: { title: 'Series', eyebrow: 'InkDrop', description: 'Your comics and manga library, tracked and filled automatically.' },
  wanted: { title: 'Wanted', eyebrow: 'InkDrop', description: 'Issues you want but don\'t have yet.' },
  activity: { title: 'Activity', eyebrow: 'InkDrop', description: 'Current transfers, downloads, and import activity.' },
  queue: { title: 'Queue', eyebrow: 'Activity', description: 'Active download and processing queue.' },
  history: { title: 'History', eyebrow: 'Activity', description: 'Past transfers, imports, and acquisitions.' },
  source_memory: { title: 'Blocklist', eyebrow: 'Activity', description: 'Source attempts blocked from future searches.' },
  manual_review: { title: 'Manual Review', eyebrow: 'InkDrop', description: 'Items that need your decision before proceeding.' },
  settings: { title: 'Settings', eyebrow: 'InkDrop', description: 'Indexers, download clients, paths, language rules, and automation defaults.' },
  system: { title: 'System', eyebrow: 'InkDrop', description: 'Health, tasks, logs, and installed version.' },
};

class AppShell extends Component {
  constructor() {
    super();
    this.state = {
      sidebarCollapsed: false,
      mobileMenuOpen: false,
      statusText: 'loading...',
      statusOk: null,
      seriesCount: null,
      wantedCount: null,
      reviewCount: null,
      activityCount: null,
    };
    this._onSectionChange = this._onSectionChange.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  componentDidMount() {
    appStore.subscribeKey('currentSection', this._onSectionChange);
    window.addEventListener('keydown', this._onKeyDown);
    this._loadNavCounts();
    this._statusTimer = setInterval(() => this._loadStatus(), 30000);
    this._loadStatus();
  }

  componentWillUnmount() {
    appStore.subscribeKey('currentSection', this._onSectionChange); // cleanup would need unsubscribe
    window.removeEventListener('keydown', this._onKeyDown);
    if (this._statusTimer) clearInterval(this._statusTimer);
  }

  _onSectionChange() {
    this.forceUpdate();
  }

  _onKeyDown(e) {
    if (e.key === 'Escape' && this.state.mobileMenuOpen) {
      this._closeMobileMenu();
    }
  }

  async _loadStatus() {
    try {
      const data = await api.system.status();
      if (data.ok) {
        this.setState({ statusText: data.status || 'running', statusOk: true });
      }
    } catch {
      this.setState({ statusText: 'unreachable', statusOk: false });
    }
  }

  async _loadNavCounts() {
    try {
      const data = await api.state.sections();
      if (data.ok && data.state?.sections) {
        for (const s of data.state.sections) {
          if (s.id === 'series') this.setState({ seriesCount: s.count });
          if (s.id === 'wanted') this.setState({ wantedCount: s.count });
          if (s.id === 'manual_review') this.setState({ reviewCount: s.count });
          if (s.id === 'activity' || s.id === 'queue') this.setState({ activityCount: s.count });
        }
      }
    } catch { /* ignore */ }
  }

  _toggleSidebar() {
    this.setState(prev => ({ sidebarCollapsed: !prev.sidebarCollapsed }));
  }

  _closeMobileMenu() {
    this.setState({ mobileMenuOpen: false });
  }

  _toggleMobileMenu() {
    this.setState(prev => ({ mobileMenuOpen: !prev.mobileMenuOpen }));
  }

  _navigateTo(section) {
    router.navigateToSection(section);
    this.setState({ mobileMenuOpen: false });
  }

  _navigateToSettings(area) {
    router.navigateToSettingsArea(area);
    this.setState({ mobileMenuOpen: false });
  }

  render({ children }) {
    const currentSection = appStore.get('currentSection');
    const currentSubsection = appStore.get('currentSubsection');
    const meta = SECTION_TITLES[currentSection] || SECTION_TITLES.series;
    const { sidebarCollapsed, mobileMenuOpen } = this.state;

    const isSectionActive = (section) => {
      if (currentSection === section) return true;
      if (currentSubsection === section) return true;
      return false;
    };

    const settingsArea = (() => {
      try {
        const hash = window.location.hash || '';
        const m = hash.match(/[?&]area=([^&]+)/);
        return m ? m[1] : null;
      } catch { return null; }
    })();

    const settingsSubnav = [
      { area: 'setup', label: 'Setup' },
      { area: 'media_management', label: 'Media Management' },
      { area: 'language', label: 'Language' },
      { area: 'indexers', label: 'Indexers' },
      { area: 'download_clients', label: 'Download Clients' },
      { area: 'connect', label: 'Connect' },
      { area: 'metadata', label: 'Metadata' },
      { area: 'general', label: 'General' },
      { area: 'ui', label: 'UI' },
      { area: 'root_folders', label: 'Paths' },
    ];

    const navItems = NAV_ITEMS.filter(item => {
      if (item.section === 'calendar') return false; // hidden by default
      return true;
    });

    let lastGroup = null;
    const navElements = [];
    for (const item of navItems) {
      if (item.group && item.group !== lastGroup) {
        navElements.push(
          <span class="ink-nav-group-label" key={`group-${item.group}`}>{item.group}</span>
        );
        lastGroup = item.group;
      }
      if (item.section) {
        const active = isSectionActive(item.section);
        const count = item.section === 'series' ? this.state.seriesCount
          : item.section === 'wanted' ? this.state.wantedCount
          : item.section === 'manual_review' ? this.state.reviewCount
          : item.section === 'activity' || item.section === 'queue' ? this.state.activityCount
          : null;
        const isSubnav = item.parent === 'activity' || item.section === 'queue' || item.section === 'history' || item.section === 'source_memory';
        navElements.push(
          <button
            key={item.section}
            class={`ink-nav-btn${active ? ' ink-nav-active' : ''}${isSubnav ? ' ink-nav-sub' : ''}`}
            onClick={() => this._navigateTo(item.section)}
            title={item.label}
          >
            <span class="ink-nav-icon">{item.icon}</span>
            <span class="ink-nav-label">{item.label}</span>
            {count != null && count > 0 ? <span class="ink-nav-count">{count}</span> : null}
          </button>
        );
      }
    }

    // Settings subnav
    if (currentSection === 'settings') {
      navElements.push(
        <div class="ink-nav-subnav" key="settings-subnav">
          {settingsSubnav.map(s => (
            <button
              key={s.area}
              class={`ink-nav-btn${settingsArea === s.area ? ' ink-nav-active' : ''}`}
              onClick={() => this._navigateToSettings(s.area)}
            >
              <span class="ink-nav-label">{s.label}</span>
            </button>
          ))}
        </div>
      );
    }

    return (
      <div class="ink-app-layout">
        <aside class={`ink-sidebar${sidebarCollapsed ? ' collapsed' : ''}${mobileMenuOpen ? ' ink-mobile-open' : ''}`}>
          <div class="ink-sidebar-header">
            <span class="ink-logo-mark"><img src="/inkdrop-logo-mark.png" alt="" loading="eager" /></span>
            <span class="ink-sidebar-title">InkDrop</span>
            <button class="ink-sidebar-toggle" type="button" aria-label="Toggle sidebar" onClick={() => this._toggleSidebar()}>
              {sidebarCollapsed ? '→' : '←'}
            </button>
          </div>

          <div class="ink-nav-search">
            <input type="search" placeholder="Search Series..." autocomplete="off" aria-label="Search existing series" />
          </div>

          <nav class="ink-nav" aria-label="InkDrop sections">
            {navElements}
          </nav>

          <div class="ink-nav-actions">
            <button class="ink-nav-add" onClick={() => this._navigateTo('series')}>Add Series</button>
          </div>

          <div class="ink-activity-region" aria-live="polite">
            <div class={`ink-status-pill${this.state.statusOk === true ? '' : this.state.statusOk === false ? ' ink-status-error' : ''}`}>
              <span class={`ink-status-dot${this.state.statusOk === true ? ' ink-dot-ok' : this.state.statusOk === false ? ' ink-dot-err' : ''}`} />
              <span>{this.state.statusText}</span>
            </div>
          </div>
        </aside>

        <div class={`ink-mobile-backdrop${mobileMenuOpen ? ' ink-backdrop-visible' : ''}`} onClick={() => this._closeMobileMenu()} />

        <div class="ink-content">
          <header class="ink-topbar">
            <button class="ink-mobile-menu-btn" type="button" aria-label="Open menu" onClick={() => this._toggleMobileMenu()}>
              <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div class="ink-topbar-brand">
              <h1 class="ink-topbar-title">{meta.title}</h1>
              <span class="ink-topbar-eyebrow">{meta.eyebrow}</span>
            </div>
            <div class="ink-topbar-actions">
              <button class="ink-btn-ghost ink-btn-sm" onClick={() => this._loadNavCounts()}>↻ Refresh</button>
            </div>
          </header>

          <div class="ink-page-area">
            <p class="ink-page-description">{meta.description}</p>
            {children}
          </div>
        </div>
      </div>
    );
  }
}

export { AppShell, SECTION_TITLES };