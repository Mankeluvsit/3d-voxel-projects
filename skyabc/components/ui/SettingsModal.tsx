import React, { useState } from 'react';

interface SettingsModalProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  cityName?: string;
  seed?: number;
  mapTheme?: string;
  isSandbox: boolean;
  aiEnabled: boolean;
  uiScale: number;
  setUiScale: (s: number) => void;
  onOpenAiLabs: () => void;
  showDevStats: boolean;
  setShowDevStats: (show: boolean) => void;
  terrainQuality?: number;
  setTerrainQuality?: (q: number) => void;
  speedMultiplier?: number;
  setSpeedMultiplier?: (m: number) => void;
  enableShadows?: boolean;
  setEnableShadows?: (e: boolean) => void;
  onAdminAction: (action: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  showSettings,
  setShowSettings,
  cityName,
  seed,
  mapTheme,
  isSandbox,
  aiEnabled,
  uiScale,
  setUiScale,
  onOpenAiLabs,
  showDevStats,
  setShowDevStats,
  terrainQuality,
  setTerrainQuality,
  speedMultiplier,
  setSpeedMultiplier,
  enableShadows,
  setEnableShadows,
  onAdminAction
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'dev'>('general');

  if (!showSettings) return null;

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 pointer-events-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 w-full max-w-sm text-white shadow-2xl backdrop-blur-xl relative">
        <h2 className="text-2xl font-black mb-4 bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">Settings</h2>
        
        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 mb-4 text-[10px] font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex-1 pb-2 border-b-2 transition ${activeTab === 'general' ? 'border-indigo-500 text-white font-black' : 'border-transparent text-slate-500'}`}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dev')}
            className={`flex-1 pb-2 border-b-2 transition ${activeTab === 'dev' ? 'border-cyan-500 text-white font-black' : 'border-transparent text-slate-500'}`}
          >
            Graphics/Dev Options
          </button>
        </div>

        {activeTab === 'general' ? (
          /* General Tab */
          <div className="space-y-4 animate-fade-in text-sm">
            <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400 grid grid-cols-2 gap-y-1 font-mono">
              <div>City Name:</div><div className="text-white text-right font-bold">{cityName || 'New Metropolis'}</div>
              <div>Seed Index:</div><div className="text-white text-right font-bold">{seed || 0}</div>
              <div>Map Biome:</div><div className="text-cyan-400 text-right font-bold uppercase">{mapTheme || 'TEMPERATE'}</div>
              <div>Budget Preset:</div><div className="text-white text-right font-bold uppercase">{isSandbox ? 'Sandbox Inf' : 'Standard'}</div>
            </div>

            <div className="flex items-center justify-between bg-slate-850/40 p-2.5 rounded-lg border border-slate-800">
              <span className="text-xs font-semibold text-slate-200">AI Advisor Active</span>
              <span className={`px-2.5 py-1 text-[9px] font-bold rounded uppercase tracking-wider ${aiEnabled ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-800/40' : 'bg-slate-850 text-slate-600'}`}>
                {aiEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 flex justify-between uppercase">
                <span>UI SCALE</span>
                <span className="text-indigo-400 font-bold">{uiScale.toFixed(1)}x</span>
              </label>
              <input type="range" min="0.6" max="1.4" step="0.1" value={uiScale} onChange={(e) => setUiScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
            </div>

            <div className="border-t border-slate-800 pt-3 mt-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Experimental Neural Modules</span>
              <button 
                type="button"
                onClick={() => {
                  setShowSettings(false);
                  onOpenAiLabs();
                }}
                className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-extrabold text-[11px] py-2.5 px-4 rounded-xl shadow-lg border border-cyan-400/30 font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>💡</span> Open AI Labs Incubator
              </button>
            </div>
          </div>
        ) : (
          /* Developer / Graphics Tab */
          <div className="space-y-4 animate-fade-in text-sm">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 flex justify-between uppercase">
                <span>Simulation Tick Speed</span>
                <span className="text-amber-400 font-bold font-mono">{speedMultiplier || 1}x</span>
              </label>
              <input type="range" min="0.5" max="10" step="0.5" value={speedMultiplier || 1} onChange={(e) => setSpeedMultiplier && setSpeedMultiplier(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 flex justify-between uppercase">
                <span>Terrain Sub-grid Size</span>
                <span className="text-indigo-400 font-bold font-mono">{terrainQuality || 1}x</span>
              </label>
              <input type="range" min="1" max="4" step="1" value={terrainQuality || 1} onChange={(e) => setTerrainQuality && setTerrainQuality(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
              <p className="text-[9px] text-slate-500 italic font-mono mt-0.5">Lower value increases performance (instancing limits).</p>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs font-bold text-slate-200">System Performance Monitor</div>
                <div className="text-[9px] text-slate-500">Enable HUD diagnostics for Framerate</div>
              </div>
              <button 
                onClick={() => setShowDevStats(!showDevStats)} 
                className={`w-10 h-5 rounded-full relative transition-colors ${showDevStats ? 'bg-cyan-500' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${showDevStats ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </button>
            </div>
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs font-bold text-slate-200">Shadow Maps Rendering (WebGL)</div>
                <div className="text-[9px] text-slate-500">Enable real-time dynamic shadows</div>
              </div>
              <button 
                onClick={() => setEnableShadows && setEnableShadows(!enableShadows)} 
                className={`w-10 h-5 rounded-full relative transition-colors ${enableShadows ? 'bg-cyan-500' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${enableShadows ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </button>
            </div>

            <div className="pt-2">
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest block mb-2">Destructive Administration</span>
              <div className="flex gap-2">
                 <button onClick={() => { onAdminAction('+1000'); setShowSettings(false); }} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white p-1.5 rounded-lg text-xs font-mono border border-slate-700">+$1k Dev Funds</button>
                 <button onClick={() => { onAdminAction('+population'); setShowSettings(false); }} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white p-1.5 rounded-lg text-xs font-mono border border-slate-700">+100 Citizens</button>
              </div>
              <button onClick={() => { onAdminAction('reset'); setShowSettings(false); }} className="w-full bg-red-900/40 hover:bg-red-800 text-red-400 hover:text-white p-1.5 rounded-lg text-xs mt-2 border border-red-800 transition">Factory Reset Environment</button>
            </div>
          </div>
        )}

        <button 
          onClick={() => setShowSettings(false)}
          className="absolute top-4 right-4 text-slate-500 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
