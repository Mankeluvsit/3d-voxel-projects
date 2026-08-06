/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef } from 'react';
import { BuildingType, BuildingCategory, CityStats, AIGoal, NewsItem, Grid } from '../types';
import { BUILDINGS } from '../constants';

interface UIOverlayProps {
  stats: CityStats;
  selectedTool: BuildingType;
  onSelectTool: (type: BuildingType) => void;
  currentGoal: AIGoal | null;
  newsFeed: NewsItem[];
  onClaimReward: () => void;
  isGeneratingGoal: boolean;
  aiEnabled: boolean;
  isSandbox: boolean;
  uiScale: number;
  setUiScale: (s: number) => void;
  onAdminAction: (action: string) => void;
  showDevStats: boolean;
  setShowDevStats: (show: boolean) => void;
  
  // Custom expandable graphics/developer tools props
  cityName?: string;
  mapTheme?: 'temperate' | 'desert' | 'winter';
  ruggedness?: number;
  seed?: number;
  terrainQuality?: number;
  setTerrainQuality?: (q: number) => void;
  enableShadows?: boolean;
  setEnableShadows?: (e: boolean) => void;
  speedMultiplier?: number;
  setSpeedMultiplier?: (m: number) => void;
  devFrameStats?: { fps: number, drawCalls: number, triangles: number };
  onOpenAiLabs: () => void;
  grid?: Grid;
}

// Group tools by category
const categorizedTools: Record<BuildingCategory, BuildingType[]> = {
  [BuildingCategory.Infrastructure]: [BuildingType.None, BuildingType.Road, BuildingType.PoliceStation, BuildingType.FireStation, BuildingType.Hospital],
  [BuildingCategory.Residential]: [BuildingType.Residential],
  [BuildingCategory.Commercial]: [BuildingType.Commercial],
  [BuildingCategory.Industrial]: [BuildingType.Industrial],
  [BuildingCategory.Decoration]: [BuildingType.Park],
};

import { ToolButton } from './ui/ToolButton';

const UIOverlay: React.FC<UIOverlayProps> = ({
  stats,
  selectedTool,
  onSelectTool,
  currentGoal,
  newsFeed,
  onClaimReward,
  isGeneratingGoal,
  aiEnabled,
  isSandbox,
  uiScale,
  setUiScale,
  onAdminAction,
  showDevStats,
  setShowDevStats,
  cityName,
  mapTheme,
  ruggedness,
  seed,
  terrainQuality,
  setTerrainQuality,
  enableShadows,
  setEnableShadows,
  speedMultiplier,
  setSpeedMultiplier,
  devFrameStats,
  onOpenAiLabs,
  grid
}) => {
  const newsRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'general' | 'dev'>('general');
  const [newsExpanded, setNewsExpanded] = React.useState(false);

  // Dynamic grid statistics metrics calculation
  const metrics = React.useMemo(() => {
    if (!grid) return { buildings: 0, roads: 0, water: 0, natural: 0 };
    let buildings = 0;
    let roads = 0;
    let water = 0;
    let natural = 0;
    
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const tile = grid[y][x];
        const type = tile.buildingType;
        if (type === BuildingType.Road) {
          roads++;
        } else if (type === BuildingType.Water || tile.isWater) {
          water++;
        } else if (type !== BuildingType.None) {
          buildings++;
        } else {
          natural++;
        }
      }
    }
    return { buildings, roads, water, natural };
  }, [grid]);

  // Moveable system debug panel position
  const [debugPos, setDebugPos] = React.useState({ x: 16, y: 88 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 16, y: 88 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...debugPos };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;
      
      const newX = Math.max(8, Math.min(window.innerWidth - 200, posStartRef.current.x + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 320, posStartRef.current.y + dy));
      
      setDebugPos({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Auto-scroll news
  useEffect(() => {
    if (newsRef.current) {
      newsRef.current.scrollTop = newsRef.current.scrollHeight;
    }
  }, [newsFeed]);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 md:p-4 font-sans z-10" style={{ transform: `scale(${uiScale})`, transformOrigin: 'top left', width: `${100/uiScale}%`, height: `${100/uiScale}%` }}>
      
      {/* Top Bar: Stats & Goal */}
      <div className="flex justify-between items-start pointer-events-auto w-full">
        
        {/* Stats */}
        <div className="bg-gray-900/90 text-white p-2 md:p-3 rounded-xl border border-gray-700 shadow-2xl backdrop-blur-md flex gap-3 md:gap-6 items-center justify-between md:justify-start w-full md:w-auto">
          <div className="flex flex-col">
            <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Treasury</span>
            {isSandbox ? (
              <span className="text-sm md:text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400 font-mono drop-shadow-md uppercase tracking-wider">
                ∞ Infinite
              </span>
            ) : (
              <span className="text-lg md:text-2xl font-black text-green-400 font-mono drop-shadow-md">${stats.money.toLocaleString()}</span>
            )}
          </div>
          <div className="w-px h-6 md:h-8 bg-gray-700"></div>
          <div className="flex flex-col">
            <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Citizens</span>
            <span className="text-base md:text-xl font-bold text-blue-300 font-mono drop-shadow-md">{stats.population.toLocaleString()}</span>
          </div>
          <div className="w-px h-6 md:h-8 bg-gray-700"></div>
          <div className="flex flex-col items-end">
             <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Day</span>
             <span className="text-base md:text-lg font-bold text-white font-mono">{stats.day}</span>
          </div>
        </div>

        {/* AI Goal Panel */}
        {!isSandbox && (
          <div className={`w-full md:w-80 bg-indigo-900/90 text-white rounded-xl border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.4)] backdrop-blur-md overflow-hidden transition-all ${!aiEnabled ? 'opacity-80 grayscale-[0.5]' : ''}`}>
           <div className="bg-indigo-800/80 px-3 md:px-4 py-1.5 md:py-2 flex justify-between items-center border-b border-indigo-600">
             <span className="font-bold uppercase text-[10px] md:text-xs tracking-widest flex items-center gap-2 shadow-sm">
               {aiEnabled ? (
                 <>
                   <span className={`w-2 h-2 rounded-full ${isGeneratingGoal ? 'bg-yellow-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`}></span>
                   AI Advisor
                 </>
               ) : (
                 <>
                   <span className="w-2 h-2 rounded-full bg-green-400"></span>
                   Sandbox
                 </>
               )}
             </span>
             {isGeneratingGoal && aiEnabled && <span className="text-[10px] animate-pulse text-yellow-300 font-mono">Thinking...</span>}
           </div>
           
           <div className="p-3 md:p-4">
             {aiEnabled ? (
               currentGoal ? (
                 <>
                   <p className="text-xs md:text-sm font-medium text-indigo-100 mb-2 md:mb-3 leading-tight drop-shadow">"{currentGoal.description}"</p>
                   
                   <div className="flex justify-between items-center mt-1 md:mt-2 bg-indigo-950/60 p-1.5 md:p-2 rounded-lg border border-indigo-700/50">
                     <div className="text-[10px] md:text-xs text-gray-300">
                       Goal: <span className="font-mono font-bold text-white">
                         {currentGoal.targetType === 'building_count' ? BUILDINGS[currentGoal.buildingType!].name : 
                          currentGoal.targetType === 'money' ? '$' : 'Pop.'} {currentGoal.targetValue}
                       </span>
                     </div>
                     <div className="text-[10px] md:text-xs text-yellow-300 font-bold font-mono bg-yellow-900/50 px-2 py-0.5 rounded border border-yellow-600/50">
                       +${currentGoal.reward}
                     </div>
                   </div>
   
                   {currentGoal.completed && (
                     <button
                       onClick={onClaimReward}
                       className="mt-2 md:mt-3 w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-1.5 md:py-2 px-4 rounded shadow-[0_0_15px_rgba(34,197,94,0.6)] transition-all animate-bounce text-xs md:text-sm uppercase tracking-wide border border-green-400/50"
                     >
                       Collect Reward
                     </button>
                   )}
                 </>
               ) : (
                 <div className="text-xs md:text-sm text-gray-400 py-2 italic flex items-center gap-2">
                   <svg className="animate-spin h-3 w-3 md:h-4 md:w-4 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   Analyzing city data...
                 </div>
               )
             ) : (
               <div className="text-xs md:text-sm text-indigo-200/70 py-1">
                  <p className="mb-1">Free play active.</p>
               </div>
             )}
           </div>
         </div>
        )}

        {/* Settings Button */}
        <button onClick={() => setShowSettings(true)} className="p-2 bg-gray-900/90 text-white rounded-full border border-gray-700 shadow-xl backdrop-blur-md hover:bg-gray-800 transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>

      {/* Bottom Bar: Tools & News */}
      <div className="flex flex-col-reverse md:flex-row md:justify-between md:items-end pointer-events-auto mt-auto gap-2 w-full max-w-full">
        
        {/* Toolbar */}
        <div className="flex flex-nowrap overflow-x-auto gap-4 bg-gray-900/85 p-2 rounded-2xl border border-gray-650/40 backdrop-blur-xl shadow-2xl w-full select-none scrollbar-thin">
          {Object.entries(categorizedTools).map(([category, types]) => (
            <div key={category} className="flex flex-col gap-1 flex-shrink-0">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-1">{category}</span>
              <div className="flex gap-1.5 md:gap-2">
                {types.map((type) => (
                    <ToolButton
                    key={type}
                    type={type}
                    isSelected={selectedTool === type}
                    onClick={() => onSelectTool(type)}
                    money={stats.money}
                    level={stats.level}
                    isSandbox={isSandbox}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Cyberpunk Diagnostics overlay telemetry */}
        {showDevStats && devFrameStats && typeof devFrameStats === 'object' && (
          <div 
            style={{ left: `${debugPos.x}px`, top: `${debugPos.y}px` }}
            className="absolute bg-slate-950/95 border border-cyan-500/50 rounded-xl p-4 font-mono text-cyan-400 text-[10px] space-y-1.5 shadow-2xl backdrop-blur-xl z-40 w-56 shadow-cyan-950/25 pointer-events-auto leading-normal select-none touch-none"
          >
            <div 
              onPointerDown={handlePointerDown}
              className="flex items-center justify-between text-cyan-100 font-bold border-b border-cyan-500/20 pb-1.5 uppercase tracking-wider text-[11px] cursor-move select-none"
            >
              <span>System Debug</span>
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
            </div>
            
            <div className="flex justify-between items-center bg-cyan-500/10 px-2 py-1.5 rounded font-bold text-xs mt-1 border border-cyan-500/20 shadow-inner">
              <span>FPS LEVEL:</span>
              <span className={((devFrameStats.fps || 0) >= 45) ? 'text-green-400 font-extrabold shadow-sm' : ((devFrameStats.fps || 0) >= 25) ? 'text-yellow-400 font-bold' : 'text-red-400 font-bold'}>
                {devFrameStats.fps || 0} FPS
              </span>
            </div>

            <div className="space-y-1.5 pt-1 opacity-95">
              <div className="flex justify-between">
                <span>Draw Calls:</span>
                <span className="text-white font-semibold">{devFrameStats.drawCalls || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Triangles:</span>
                <span className="text-white font-semibold">{(devFrameStats.triangles || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-cyan-500/10 pt-1.5 mt-1.5">
                <span>Sub-grid:</span>
                <span className="text-cyan-200 font-bold">{terrainQuality}x{terrainQuality}</span>
              </div>
              <div className="flex justify-between">
                <span>Biome:</span>
                <span className="text-amber-300 font-black uppercase tracking-wider">{mapTheme || 'TEMPERATE'}</span>
              </div>
              <div className="flex justify-between">
                <span>Sim Speed:</span>
                <span className="text-indigo-300 font-black">{speedMultiplier || 1}x</span>
              </div>
              <div className="flex justify-between border-b border-cyan-500/10 pb-1.5">
                <span>Map Seed:</span>
                <span className="text-slate-400 font-semibold">{seed || 0}</span>
              </div>

              {/* Real-time Grid Generation breakdown analytics */}
              <div className="pt-1 space-y-1 text-[9px] text-cyan-300/80">
                <div className="text-[10px] text-cyan-100 font-extrabold uppercase tracking-wider pb-0.5">Asset Breakdown</div>
                <div className="flex justify-between">
                  <span>Buildings Built:</span>
                  <span className="text-white font-bold">{metrics.buildings}</span>
                </div>
                <div className="flex justify-between">
                  <span>Road Segments:</span>
                  <span className="text-white font-bold">{metrics.roads}</span>
                </div>
                <div className="flex justify-between">
                  <span>Water Channels:</span>
                  <span className="text-sky-300 font-bold">{metrics.water}</span>
                </div>
                <div className="flex justify-between">
                  <span>Natural Grass:</span>
                  <span className="text-emerald-400 font-bold">{metrics.natural}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-cyan-500/10 pt-1 mt-1">
                  <span>Terrain Nodes:</span>
                  <span className="text-cyan-200 font-black">{(625 * (terrainQuality || 1) * (terrainQuality || 1)).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        <SettingsModal
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          cityName={cityName}
          seed={seed}
          mapTheme={mapTheme}
          isSandbox={isSandbox}
          aiEnabled={aiEnabled}
          uiScale={uiScale}
          setUiScale={setUiScale}
          onOpenAiLabs={onOpenAiLabs}
          showDevStats={showDevStats}
          setShowDevStats={setShowDevStats}
          terrainQuality={terrainQuality}
          setTerrainQuality={setTerrainQuality}
          speedMultiplier={speedMultiplier}
          setSpeedMultiplier={setSpeedMultiplier}
          enableShadows={enableShadows}
          setEnableShadows={setEnableShadows}
          onAdminAction={onAdminAction}
        />

        {/* News Feed */}
        <div className={`w-full md:w-80 bg-black/80 text-white rounded-xl border border-gray-700/80 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden relative flex-shrink-0 transition-all duration-200 ${newsExpanded ? 'h-36 shadow-indigo-950/20' : 'h-[32px] md:h-48'}`}>
          <div 
            onClick={() => setNewsExpanded(!newsExpanded)}
            className="bg-gray-800/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-300 border-b border-gray-650/40 flex justify-between items-center cursor-pointer hover:bg-gray-750 select-none"
          >
            <div className="flex items-center gap-2 overflow-hidden mr-2">
              <span>City Feed</span>
              {!newsExpanded && newsFeed.length > 0 && (
                <span className="text-[10px] text-cyan-400 font-mono normal-case tracking-normal truncate inline-block max-w-[180px] md:hidden">
                  — {newsFeed[newsFeed.length - 1].text}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${aiEnabled ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></span>
              <span className="text-[8px] text-gray-400 md:hidden">{newsExpanded ? '▼' : '▲'}</span>
            </div>
          </div>
          
          {/* Scanline effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-30 z-20"></div>
          
          <div ref={newsRef} className={`flex-1 overflow-y-auto p-2 md:p-3 space-y-2 text-[10px] md:text-xs font-mono scroll-smooth mask-image-b z-10 ${newsExpanded ? 'block' : 'hidden md:block'}`}>
            {newsFeed.length === 0 && <div className="text-gray-500 italic text-center mt-10">No active news stream.</div>}
            {newsFeed.map((news) => (
              <div key={news.id} className={`
                border-l-2 pl-2 py-1 transition-all animate-fade-in leading-tight relative
                ${news.type === 'positive' ? 'border-green-500 text-green-200 bg-green-900/20' : ''}
                ${news.type === 'negative' ? 'border-red-500 text-red-200 bg-red-900/20' : ''}
                ${news.type === 'neutral' ? 'border-blue-400 text-blue-100 bg-blue-900/20' : ''}
              `}>
                <span className="opacity-70 text-[8px] absolute top-0.5 right-1">{new Date(Number(news.id.split('.')[0])).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                {news.text}
              </div>
            ))}
          </div>
        </div>

      </div>
      
      {/* Credits */}
      <div className="absolute bottom-1 right-2 md:right-4 text-[8px] md:text-[9px] text-white/30 font-mono text-right pointer-events-auto hover:text-white/60 transition-colors">
        <a href="https://x.com/ammaar" target="_blank" rel="noreferrer">Created by @ammaar</a>
      </div>
    </div>
  );
};

export default UIOverlay;