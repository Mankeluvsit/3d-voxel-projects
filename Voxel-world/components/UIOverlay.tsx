/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef, useState } from 'react';
import { BuildingType, CityStats, AIGoal, NewsItem, MusicTrack } from '../types';
import { BUILDINGS } from '../constants';
import { Music, Lightbulb, Zap, AlertTriangle, Sparkles } from 'lucide-react';
import MusicLab from './MusicLab';
import { getAiStatus } from '../services/aiService';

interface UIOverlayProps {
  stats: CityStats;
  onSetTaxRate: (rate: number) => void;
  onResetGame: () => void;
  selectedTool: BuildingType;
  onSelectTool: (type: BuildingType) => void;
  currentGoal: AIGoal | null;
  newsFeed: NewsItem[];
  onClaimReward: () => void;
  isGeneratingGoal: boolean;
  aiEnabled: boolean;
  isMusicLabOpen: boolean;
  setIsMusicLabOpen: (open: boolean) => void;
  musicTracks: MusicTrack[];
  onTrackGenerated: (track: MusicTrack) => void;
  onOpenLab: () => void;
}

const tools = [
  BuildingType.None, // Bulldoze
  BuildingType.Road,
  BuildingType.Residential,
  BuildingType.Commercial,
  BuildingType.Industrial,
  BuildingType.Park,
  BuildingType.Extractor,
];

const ToolButton: React.FC<{
  type: BuildingType;
  isSelected: boolean;
  onClick: () => void;
  money: number;
}> = ({ type, isSelected, onClick, money }) => {
  const config = BUILDINGS[type];
  const canAfford = money >= config.cost;
  const isBulldoze = type === BuildingType.None;
  
  // Use 3D color for preview
  const bgColor = isBulldoze ? config.color : config.color;

  return (
    <button
      onClick={onClick}
      disabled={!isBulldoze && !canAfford}
      className={`
        relative flex flex-col items-center justify-center rounded-lg border-2 transition-all shadow-lg backdrop-blur-sm flex-shrink-0
        w-14 h-14 md:w-16 md:h-16
        ${isSelected ? 'border-white bg-white/20 scale-110 z-10' : 'border-gray-600 bg-gray-900/80 hover:bg-gray-800'}
        ${!isBulldoze && !canAfford ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={config.description}
    >
      <div className="w-6 h-6 md:w-8 md:h-8 rounded mb-0.5 md:mb-1 border border-black/30 shadow-inner flex items-center justify-center overflow-hidden" style={{ backgroundColor: isBulldoze ? 'transparent' : bgColor }}>
        {isBulldoze && <div className="w-full h-full bg-red-600 text-white flex justify-center items-center font-bold text-base md:text-lg">✕</div>}
        {type === BuildingType.Road && <div className="w-full h-2 bg-gray-800 transform -rotate-45"></div>}
        {type === BuildingType.Extractor && <div className="w-full h-full flex items-center justify-center text-orange-400 font-bold text-xs md:text-sm">⛏️</div>}
      </div>
      <span className="text-[8px] md:text-[10px] font-bold text-white uppercase tracking-wider drop-shadow-md leading-none">{config.name}</span>
      {config.cost > 0 && (
        <span className={`text-[8px] md:text-[10px] font-mono leading-none ${canAfford ? 'text-green-300' : 'text-red-400'}`}>${config.cost}</span>
      )}
    </button>
  );
};

const UIOverlay: React.FC<UIOverlayProps> = ({
  stats,
  onSetTaxRate,
  onResetGame,
  selectedTool,
  onSelectTool,
  currentGoal,
  newsFeed,
  onClaimReward,
  isGeneratingGoal,
  aiEnabled,
  isMusicLabOpen,
  setIsMusicLabOpen,
  musicTracks,
  onTrackGenerated,
  onOpenLab
}) => {
  const newsRef = useRef<HTMLDivElement>(null);
  const [aiStatus, setAiStatus] = useState(getAiStatus());

  // Update AI status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setAiStatus(getAiStatus());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll news
  useEffect(() => {
    if (newsRef.current) {
      newsRef.current.scrollTop = newsRef.current.scrollHeight;
    }
  }, [newsFeed]);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 md:p-4 font-sans z-10">
      
      {/* Top Bar: Stats & Goal */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start pointer-events-auto gap-2 w-full max-w-full">
        
        {/* Economics & System Panel */}
        <div className="flex flex-col gap-2 w-full md:w-auto">
          {/* Stats Bar */}
          <div className="bg-gray-900/90 text-white p-2 md:p-3 rounded-xl border border-gray-700 shadow-2xl backdrop-blur-md flex flex-wrap gap-3 md:gap-5 items-center justify-between md:justify-start w-full md:w-auto">
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Treasury</span>
              <span className="text-base md:text-xl font-black text-green-400 font-mono drop-shadow-md">${stats.money.toLocaleString()}</span>
            </div>
            
            <div className="w-px h-6 md:h-8 bg-gray-700"></div>
            
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Citizens</span>
              <span className="text-sm md:text-lg font-bold text-blue-300 font-mono drop-shadow-md">{stats.population.toLocaleString()}</span>
            </div>
            
            <div className="w-px h-6 md:h-8 bg-gray-700"></div>
            
            <div className="flex flex-col items-center">
              <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Day</span>
              <span className="text-sm md:text-base font-bold text-white font-mono">{stats.day}</span>
            </div>

            <div className="w-px h-6 md:h-8 bg-gray-700"></div>

            {/* Power Grid */}
            <div className="flex flex-col" title={`Power coverage: ${stats.energyProduction || 0} Built, ${stats.energyDemand || 0} Demanded`}>
              <span className="text-[8px] md:text-[10px] text-yellow-400 uppercase font-bold tracking-widest flex items-center gap-0.5">
                ⚡ Power
              </span>
              <span className={`text-xs md:text-sm font-bold font-mono transition-colors ${(stats.energyDemand || 0) > (stats.energyProduction || 0) ? 'text-red-450 font-extrabold' : 'text-yellow-300'}`}>
                {stats.energyProduction || 0}/{stats.energyDemand || 0} <span className="text-[8px] opacity-60">MW</span>
              </span>
            </div>

            <div className="w-px h-6 md:h-8 bg-gray-700"></div>

            {/* Water Supply */}
            <div className="flex flex-col" title={`Water coverage: ${stats.waterProduction || 0} Built, ${stats.waterDemand || 0} Demanded`}>
              <span className="text-[8px] md:text-[10px] text-blue-400 uppercase font-bold tracking-widest flex items-center gap-0.5">
                💧 Water
              </span>
              <span className={`text-xs md:text-sm font-bold font-mono transition-colors ${(stats.waterDemand || 0) > (stats.waterProduction || 0) ? 'text-red-450 font-extrabold' : 'text-blue-300'}`}>
                {stats.waterProduction || 0}/{stats.waterDemand || 0} <span className="text-[8px] opacity-60">KL</span>
              </span>
            </div>

            {/* Mineral Production */}
            { (stats.mineralProduction || 0) > 0 && (
              <>
                <div className="w-px h-6 md:h-8 bg-gray-700"></div>
                <div className="flex flex-col" title="Daily mineral exports value generating income bonuses">
                  <span className="text-[8px] md:text-[10px] text-orange-400 uppercase font-bold tracking-widest flex items-center gap-0.5">
                    💎 Minerals
                  </span>
                  <span className="text-xs md:text-sm font-bold font-mono text-orange-300">
                    +{stats.mineralProduction || 0} <span className="text-[8px] opacity-60">un/d</span>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Economics & Control Center */}
          <div className="bg-gray-900/95 text-white p-2 md:p-3 rounded-xl border border-gray-700 shadow-2xl backdrop-blur-md flex flex-wrap gap-4 items-center justify-between w-full md:w-auto">
            {/* Tax Slider */}
            <div className="flex items-center gap-3 w-full md:w-56 select-none">
              <div className="flex flex-col min-w-[70px]">
                <span className="text-[8px] text-gray-400 uppercase font-bold tracking-widest leading-none">Tax Rate</span>
                <span className={`text-sm md:text-base font-black font-mono mt-0.5 leading-none ${stats.taxRate === 0 ? 'text-blue-400' : stats.taxRate! > 15 ? 'text-red-400' : 'text-green-400'}`}>
                  {stats.taxRate ?? 10}%
                </span>
              </div>
              
              <div className="flex-1 flex flex-col gap-1">
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={stats.taxRate ?? 10}
                  onChange={(e) => onSetTaxRate(Number(e.target.value))}
                  className="w-full accent-cyan-500 h-1 bg-gray-800 rounded-lg cursor-pointer appearance-none outline-none focus:ring-1 focus:ring-cyan-500 pointer-events-auto"
                />
                <span className="text-[8px] text-gray-505 font-medium uppercase leading-none tracking-tight">
                  {stats.taxRate === 0 ? 'Tax Free (Growth 1.8x)' : 
                   stats.taxRate! < 10 ? 'Low Taxes (Growth Boosted)' : 
                   stats.taxRate === 10 ? 'Standard Taxes' : 
                   stats.taxRate! <= 18 ? 'High Taxes (Growth Slipped)' : 'Greedy Taxes (Zero Growth)'}
                </span>
              </div>
            </div>

            <div className="hidden md:block w-px h-6 bg-gray-700"></div>

            {/* Demolish Button */}
            <button
              onClick={() => {
                if(window.confirm("Demolish this entire colony and start a fresh metropolis? Progress will be lost.")) {
                  onResetGame();
                }
              }}
              className="text-[9px] uppercase tracking-wider bg-red-950/40 border border-red-500/30 hover:bg-red-900/60 font-bold px-3 py-1.5 rounded-lg text-red-300 transition-colors cursor-pointer w-full md:w-auto text-center pointer-events-auto"
            >
              Reset City
            </button>
          </div>
        </div>

        {/* AI Goal Panel */}
        <div className={`w-full md:w-80 bg-indigo-900/90 text-white rounded-xl border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.4)] backdrop-blur-md overflow-hidden transition-all ${!aiEnabled ? 'opacity-80 grayscale-[0.5]' : ''}`}>
          <div className="bg-indigo-800/80 px-3 md:px-4 py-1.5 md:py-2 flex justify-between items-center border-b border-indigo-600">
            <span className="font-bold uppercase text-[10px] md:text-xs tracking-widest flex items-center gap-2 shadow-sm">
              {aiEnabled ? (
                <>
                  <span className={`w-2 h-2 rounded-full ${aiStatus.isRateLimited ? 'bg-red-500 animate-pulse' : (isGeneratingGoal ? 'bg-yellow-400 animate-ping' : 'bg-cyan-400 animate-pulse')}`}></span>
                  AI Advisor
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] border flex items-center gap-1 ${aiStatus.isRateLimited ? 'bg-red-900/50 border-red-500 text-red-200' : 'bg-indigo-700 border-indigo-500 text-indigo-100'}`}>
                    {aiStatus.provider === 'openai' ? <Zap size={8} className="text-yellow-400" /> : <Sparkles size={8} className="text-blue-400" />}
                    {aiStatus.provider.toUpperCase()}
                    {aiStatus.isRateLimited && <span className="ml-1 font-mono">({aiStatus.cooldownRemaining}s)</span>}
                  </span>
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
              aiStatus.isRateLimited ? (
                <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-2 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-[10px] uppercase">
                    <AlertTriangle size={12} />
                    {aiStatus.lastErrorMessage || "Service Unavailable"}
                  </div>
                  <p className="text-[10px] text-red-200/70 leading-tight">
                    {aiStatus.lastErrorMessage === "API Key missing." 
                      ? "Please set your API key in the environment variables."
                      : `Quota exceeded. Automatic fallback active. Retrying in ${aiStatus.cooldownRemaining}s...`}
                  </p>
                </div>
              ) : currentGoal ? (
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
      </div>

      {/* Bottom Bar: Tools & News */}
      <div className="flex flex-col-reverse md:flex-row md:justify-between md:items-end pointer-events-auto mt-auto gap-2 w-full max-w-full">
        
        {/* Toolbar - Reversed on Mobile so it appears below News (in DOM order is News -> Toolbar with col-reverse, but visually we want Toolbar bottom, News Top on mobile. 
            Actually, visually we want:
            Mobile: 
            [News Feed]
            [Toolbar]
            
            Desktop:
            [Toolbar] ... [News Feed]
            
            If container is flex-col-reverse:
            1. Child (Toolbar) -> Bottom
            2. Child (News) -> Top
            
            If container is md:flex-row:
            1. Child (Toolbar) -> Left
            2. Child (News) -> Right
            
            This works perfectly.
        */}
        
        <div className="flex gap-1 md:gap-2 bg-gray-900/80 p-1 md:p-2 rounded-2xl border border-gray-600/50 backdrop-blur-xl shadow-2xl w-full md:w-auto overflow-x-auto no-scrollbar justify-start md:justify-start">
          <button
            onClick={() => setIsMusicLabOpen(true)}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-indigo-500/50 bg-indigo-900/40 hover:bg-indigo-800/60 transition-all shadow-lg backdrop-blur-sm flex-shrink-0 w-14 h-14 md:w-16 md:h-16 group"
          >
            <Music className="text-indigo-400 group-hover:text-white transition-colors" size={24} />
            <span className="text-[8px] md:text-[10px] font-bold text-white uppercase tracking-wider mt-1">Music</span>
          </button>
          <button
            onClick={onOpenLab}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-amber-500/50 bg-amber-900/40 hover:bg-amber-800/60 transition-all shadow-lg backdrop-blur-sm flex-shrink-0 w-14 h-14 md:w-16 md:h-16 group"
          >
            <Lightbulb className="text-amber-400 group-hover:text-white transition-colors" size={24} />
            <span className="text-[8px] md:text-[10px] font-bold text-white uppercase tracking-wider mt-1">Lab</span>
          </button>
          <div className="w-px h-10 md:h-12 bg-gray-700 mx-1 self-center"></div>
          <div className="flex gap-1 md:gap-2 min-w-max px-1">
            {tools.map((type) => (
              <ToolButton
                key={type}
                type={type}
                isSelected={selectedTool === type}
                onClick={() => onSelectTool(type)}
                money={stats.money}
              />
            ))}
          </div>
          <div className="text-[8px] text-gray-500 uppercase writing-mode-vertical flex items-center justify-center font-bold tracking-widest border-l border-gray-700 pl-1 ml-1 select-none">Build</div>
        </div>

        {/* News Feed */}
        <div className="w-full md:w-80 h-32 md:h-48 bg-black/80 text-white rounded-xl border border-gray-700/80 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden relative">
          <div className="bg-gray-800/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-300 border-b border-gray-600 flex justify-between items-center">
            <span>City Feed</span>
            <span className={`w-1.5 h-1.5 rounded-full ${aiEnabled ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></span>
          </div>
          
          {/* Scanline effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-30 z-20"></div>
          
          <div ref={newsRef} className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2 text-[10px] md:text-xs font-mono scroll-smooth mask-image-b z-10">
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

      <MusicLab 
        isOpen={isMusicLabOpen}
        onClose={() => setIsMusicLabOpen(false)}
        onTrackGenerated={onTrackGenerated}
        tracks={musicTracks}
      />
    </div>
  );
};

export default UIOverlay;