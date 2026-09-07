import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>Unable to open the scope</h1>
        <p>{this.state.error}</p>
        <button onClick={() => location.reload()}>RELOAD APPLICATION</button>
        <p>Your local recordings have not been deleted.</p>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
if ('serviceWorker' in navigator && import.meta.env.PROD)
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((error) => console.warn('Offline installation unavailable', error));
  });
