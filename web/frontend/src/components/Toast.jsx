/**
 * InkDrop — Toast notification component
 */

import { h, Component } from 'preact';
import { appStore } from '../stores/app-store.jsx';

class ToastContainer extends Component {
  componentDidMount() {
    this._unsub = appStore.subscribeKey('toasts', () => this.forceUpdate());
  }
  componentWillUnmount() {
    if (this._unsub) this._unsub();
  }
  render() {
    const toasts = appStore.get('toasts') || [];
    return (
      <div class="ink-toast-container">
        {toasts.map(t => (
          <div key={t.id} class={`ink-toast ink-toast-${t.type || 'info'}`}>
            {t.message}
          </div>
        ))}
      </div>
    );
  }
}

export { ToastContainer };