import React, { useState } from 'react';

interface StartScreenProps {
  onStart: (config: {
    aiEnabled: boolean;
    gridSize: number;
    cityName: string;
    budgetMode: 'normal' | 'rich' | 'sandbox';
    mapTheme: 'temperate' | 'desert' | 'winter';
    ruggedness: number;
    seed: number;
  }) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  const [aiEnabled, setAiEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(25);
  const [cityName, setCityName] = useState('New Metropolis');
  const [budgetMode, setBudgetMode] = useState<'normal' | 'rich' | 'sandbox'>('normal');
  const [mapTheme, setMapTheme] = useState<'temperate' | 'desert' | 'winter'>('temperate');
  const [ruggedness, setRuggedness] = useState<number>(1.1); // Rolling hills default
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 9999));

  const randomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 9999));
  };

  const handleStart = () => {
    onStart({
      aiEnabled,
      gridSize,
      cityName,
      budgetMode,
      mapTheme,
      ruggedness,
      seed,
    });
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 text-white font-sans p-4 bg-black/40 backdrop-blur-md overflow-y-auto">
      <div className="max-w-xl w-full bg-slate-900/95 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-xl relative my-auto animate-fade-in">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 space-y-4">
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-br from-white via-cyan-200 to-blue-400 bg-clip-text text-transparent tracking-tight">
              SkyMetropolis
            </h1>
            <p className="text-slate-400 text-[10px] md:text-xs font-semibold uppercase tracking-widest mt-1">
              Isometric Procedural Town Planner v0.3.0
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Left side: City & Advisor & Treasury */}
            <div className="space-y-4">
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-slate-650 transition">
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">City Name</label>
                <input 
                  type="text" 
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  placeholder="Enter city name..."
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-bold tracking-tight"
                />
              </div>

              {/* AI Advisor checkbox */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-slate-650 transition">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-xs text-slate-300 group-hover:text-white transition-colors flex items-center gap-2 uppercase tracking-wider">
                      AI Advisor Assistant
                      {aiEnabled && <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>}
                    </span>
                    <span className="text-[10px] text-slate-500 group-hover:text-slate-450 transition-colors">
                      Enable quest rewards & news feed
                    </span>
                  </div>
                  
                  <div className="relative flex-shrink-0 ml-2">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={aiEnabled}
                      onChange={(e) => setAiEnabled(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-cyan-500/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600 peer-checked:after:bg-white"></div>
                  </div>
                </label>
              </div>

              {/* Budget preset buttons */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-slate-650 transition">
                <span className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Treasury Presets</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['normal', 'rich', 'sandbox'] as const).map(mode => (
                    <button 
                      key={mode} 
                      type="button"
                      onClick={() => setBudgetMode(mode)} 
                      className={`py-2 rounded-lg font-bold text-[10px] uppercase border transition-all ${budgetMode === mode ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'}`}
                    >
                      {mode === 'normal' ? 'Normal ($5K)' : mode === 'rich' ? 'Rich ($50K)' : 'Sandbox'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right side: Map settings (Seed, Theme, Ruggedness) */}
            <div className="space-y-4">
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-slate-650 transition">
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">World Seed</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                    className="flex-1 bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 font-bold"
                  />
                  <button 
                    type="button"
                    onClick={randomizeSeed} 
                    className="px-3 bg-slate-750 hover:bg-slate-700 border border-slate-600 rounded-lg text-lg transition active:scale-90"
                    title="Generate random seed"
                  >
                    🎲
                  </button>
                </div>
              </div>

              {/* Map Theme / Biome selector */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-slate-650 transition">
                <span className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Map Climate Biome</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['temperate', 'desert', 'winter'] as const).map(theme => (
                    <button 
                      key={theme} 
                      type="button"
                      onClick={() => setMapTheme(theme)} 
                      className={`py-2 rounded-lg font-bold text-[10px] uppercase border transition-all ${mapTheme === theme ? 'bg-cyan-600 border-cyan-400 text-white shadow-md' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'}`}
                    >
                      {theme === 'temperate' ? 'Temperate' : theme === 'desert' ? 'Desert' : 'Winter'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Terrain verticality / ruggedness */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-slate-650 transition">
                <span className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Terrain Verticality</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { label: 'Plains', val: 0.4 },
                    { label: 'Hills', val: 1.1 },
                    { label: 'Alpine', val: 1.8 }
                  ]).map(rObj => (
                    <button 
                      key={rObj.label} 
                      type="button"
                      onClick={() => setRuggedness(rObj.val)} 
                      className={`py-2 rounded-lg font-bold text-[10px] uppercase border transition-all ${ruggedness === rObj.val ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'}`}
                    >
                      {rObj.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 select-none">
            <span className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Select Board Scale</span>
            <div className="grid grid-cols-3 gap-2">
              {[15, 25, 35].map(size => (
                <button 
                  key={size} 
                  type="button"
                  onClick={() => setGridSize(size)} 
                  className={`py-2.5 rounded-xl font-black text-xs uppercase border transition-all ${gridSize === size ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg' : 'bg-slate-700 border-slate-850 text-slate-400 hover:text-slate-200'}`}
                >
                  {size === 15 ? 'Small (15x15)' : size === 25 ? 'Normal (25x25)' : 'Large (35x35)'}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleStart}
            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold rounded-xl shadow-lg shadow-cyan-900/20 hover:shadow-cyan-800/40 transform transition-all hover:scale-[1.01] active:scale-[0.99] text-base md:text-lg tracking-wider"
          >
            Start Building {cityName}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;
