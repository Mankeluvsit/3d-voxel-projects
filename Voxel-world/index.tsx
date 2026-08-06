/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Colony Crisis (App Crash):", error, errorInfo);
  }

  handleReset = () => {
    localStorage.removeItem('sky_metropolis_save');
    localStorage.removeItem('sky_metropolis_ideas');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans p-6 text-center select-none">
          <div className="max-w-md bg-slate-900 border border-red-500/30 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">⚠️</div>
            <h1 className="text-2xl font-black text-rose-400 mb-2">Colony Crisis Detected</h1>
            <p className="text-sm font-medium uppercase tracking-widest text-slate-500 mb-6">Simulation Engine Halted</p>
            <p className="text-xs text-slate-400 font-mono bg-black/40 p-3 rounded-lg border border-slate-800 text-left overflow-auto max-h-32 mb-6">
              {this.state.error?.message || "An unexpected error occurred inside the 3D graphics canvas."}
            </p>
            <button
              onClick={this.handleReset}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-950/20 transform transition-all active:scale-[0.98] text-sm tracking-wide"
            >
              Clear Saved Data & Force Restart
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);