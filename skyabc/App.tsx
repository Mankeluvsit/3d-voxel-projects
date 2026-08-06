/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid, TileData, BuildingType, CityStats, AIGoal, NewsItem, BiomeType, FeatureIdea } from './types';
import { GRID_SIZE, BUILDINGS, TICK_RATE_MS, INITIAL_MONEY } from './constants';
import IsoMap from './components/IsoMap';
import UIOverlay from './components/UIOverlay';
import StartScreen from './components/StartScreen';
import { fetchNewGoal, fetchNewsEvent } from './lib/api';
import { getSeededRandom, createInitialGrid, checkRoadAdjacency } from './lib/gridUtils';

function App() {
  // --- Expanded Settings & Statistics ---
  const [cityName, setCityName] = useState('New Metropolis');
  const [mapTheme, setMapTheme] = useState<'temperate' | 'desert' | 'winter'>('temperate');
  const [ruggedness, setRuggedness] = useState<number>(1.1);
  const [seed, setSeed] = useState<number>(0);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [terrainQuality, setTerrainQuality] = useState<number>(4); // Default to Low (4x4) subgrid for optimal performance
  const [enableShadows, setEnableShadows] = useState<boolean>(true); // Shadow map toggler
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1); // Sim speed multiplier (1x - 10x)
  const [devFrameStats, setDevFrameStats] = useState<{ fps: number, drawCalls: number, triangles: number }>({ fps: 60, drawCalls: 0, triangles: 0 });

  const handleDevFrameStats = useCallback((fps: number, drawCalls: number, triangles: number) => {
    setDevFrameStats({ fps, drawCalls, triangles });
  }, []);

  // --- Game State ---
  const [gameStarted, setGameStarted] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);

  const [grid, setGrid] = useState<Grid>(() => createInitialGrid(GRID_SIZE, 0, 'temperate'));
  const [stats, setStats] = useState<CityStats>({ money: INITIAL_MONEY, population: 0, day: 1, level: 1, xp: 0 });
  const [selectedTool, setSelectedTool] = useState<BuildingType>(BuildingType.Road);
  const [gridSize, setGridSize] = useState(GRID_SIZE);
  
  // --- AI State ---
  const [currentGoal, setCurrentGoal] = useState<AIGoal | null>(null);
  const [isGeneratingGoal, setIsGeneratingGoal] = useState(false);
  const [newsFeed, setNewsFeed] = useState<NewsItem[]>([]);
  const [uiScale, setUiScale] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showDevStats, setShowDevStats] = useState(false);
  
  // --- Custom Inspector, AI Labs, and Error states ---
  const [inspectedTile, setInspectedTile] = useState<{ x: number, y: number } | null>(null);
  const [showAiLabs, setShowAiLabs] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [aiIdeas, setAiIdeas] = useState<FeatureIdea[]>([
    { id: '1', text: 'Construct dynamic Solar Power grid array that spikes energy during high daylight.', category: 'Infrastructure' },
    { id: '2', text: 'Build a high-performance automated Hyperloop network for zero-pollution citizen transit.', category: 'Infrastructure' },
    { id: '3', text: 'Inaugurate a holographic neon commerce center to multiply shopping and boost leisure index.', category: 'Economy' },
    { id: '4', text: 'Declare tax holidays for robotic manufacturing sectors to increase investment.', category: 'Economy' },
    { id: '5', text: 'Generate an underground deep carbon scrubbing filter to scrub bio-industry smog.', category: 'Environment' },
    { id: '6', text: 'Develop hydro-slick eco parks with glowing bio-luminescent plants to raise citizens happiness.', category: 'Recreation' }
  ]);
  const [selectedIdeas, setSelectedIdeas] = useState<Record<string, boolean>>({});
  const [errorLogs, setErrorLogs] = useState<{ id: string, message: string, stack?: string, timestamp: number }[]>([]);

  // Setup error capture listeners immediately
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setErrorLogs(prev => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          message: event.message || "An unexpected dynamic compilation or runtime exception occurred.",
          stack: event.error?.stack,
          timestamp: Date.now()
        }
      ]);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      setErrorLogs(prev => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          message: event.reason?.message || "An unhandled promise rejection occurred.",
          stack: event.reason?.stack,
          timestamp: Date.now()
        }
      ]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
  
  // Refs for accessing state inside intervals without dependencies
  const gridRef = useRef(grid);
  const statsRef = useRef(stats);
  const goalRef = useRef(currentGoal);
  const aiEnabledRef = useRef(aiEnabled);

  // Sync refs
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { goalRef.current = currentGoal; }, [currentGoal]);
  useEffect(() => { aiEnabledRef.current = aiEnabled; }, [aiEnabled]);

  const sandboxModeRef = useRef(sandboxMode);
  useEffect(() => { sandboxModeRef.current = sandboxMode; }, [sandboxMode]);

  // --- AI Logic Wrappers ---

  const addNewsItem = useCallback((item: NewsItem) => {
    setNewsFeed(prev => [...prev.slice(-12), item]); // Keep last few
  }, []);

  const fetchNewGoalInternal = useCallback(async () => {
    if (isGeneratingGoal || !aiEnabledRef.current) return;
    setIsGeneratingGoal(true);
    // Short delay for visual effect
    await new Promise(r => setTimeout(r, 500));
    
    const newGoal = await fetchNewGoal(statsRef.current, gridRef.current);
    if (newGoal) {
      setCurrentGoal(newGoal);
    } else {
      // Retry soon if failed, but only if AI still enabled
      if(aiEnabledRef.current) setTimeout(fetchNewGoalInternal, 5000);
    }
    setIsGeneratingGoal(false);
  }, [isGeneratingGoal]); 

  const fetchNews = useCallback(async () => {
    // chance to fetch news per tick
    if (!aiEnabledRef.current || Math.random() > 0.15) return; 
    const news = await fetchNewsEvent(statsRef.current, null);
    if (news) addNewsItem(news);
  }, [addNewsItem]);


  // --- Initial Setup ---
  useEffect(() => {
    if (!gameStarted) return;

    addNewsItem({ id: Date.now().toString(), text: "Welcome to SkyMetropolis. Terrain generation complete.", type: 'positive' });
    
    if (aiEnabled) {
      // @google/genai-api-key-fix: The API key's availability is a hard requirement and should not be checked in the UI.
      fetchNewGoalInternal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted]);


  // --- Game Loop ---
  // Using recursive setTimeout for dynamic tick rate throttling instead of setInterval
  // to avoid blocking the UI thread during heavy rendering spikes.
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!gameStarted) return;

    const tick = () => {
      // 1. Calculate income/pop gen
      let dailyIncome = 0;
      let dailyPopGrowth = 0;
      let buildingCounts: Record<string, number> = {};

      setGrid(prevGrid => {
        return prevGrid.map(row => row.map(tile => {
          if (tile.buildingType !== BuildingType.None) {
            const config = BUILDINGS[tile.buildingType];
            
            // Calculate dynamic efficiency
            let efficiency = 1.0;
            if (tile.buildingType !== BuildingType.Road && tile.buildingType !== BuildingType.Park && tile.buildingType !== BuildingType.Water) {
              const hasRoadAdjacent = checkRoadAdjacency(tile.x, tile.y, prevGrid, gridSize);
              efficiency = hasRoadAdjacent ? 1.0 : 0.4;
            }

            const income = config.incomeGen * efficiency;
            const pop = config.popGen * efficiency;

            dailyIncome += income;
            dailyPopGrowth += pop;
            buildingCounts[tile.buildingType] = (buildingCounts[tile.buildingType] || 0) + 1;

            return {
              ...tile,
              efficiency,
              lifetimeIncome: (tile.lifetimeIncome || 0) + income
            };
          }
          return tile;
        }));
      });

      // Cap population growth by residential count just for some logic
      const resCount = buildingCounts[BuildingType.Residential] || 0;
      const maxPop = resCount * 50; // 50 people per house max

      // 2. Update Stats
      setStats(prev => {
        let newPop = prev.population + dailyPopGrowth;
        if (newPop > maxPop) newPop = maxPop; // limit
        if (resCount === 0 && prev.population > 0) newPop = Math.max(0, prev.population - 5); // people leave if no homes

        const newStats = {
          money: prev.money + dailyIncome,
          population: newPop,
          day: prev.day + 1,
          level: prev.level,
          xp: prev.xp,
        };
        
        // Level up logic: Level = Math.floor(xp / 500) + 1
        const newLevel = Math.floor(newStats.xp / 500) + 1;
        if (newLevel > newStats.level) {
          newStats.level = newLevel;
          addNewsItem({id: Date.now().toString(), text: `City leveled up to ${newLevel}!`, type: 'positive'});
        }
        
        // 3. Check Goal Completion
        const goal = goalRef.current;
        if (aiEnabledRef.current && goal && !goal.completed) {
          let isMet = false;
          if (goal.targetType === 'money' && newStats.money >= goal.targetValue) isMet = true;
          if (goal.targetType === 'population' && newStats.population >= goal.targetValue) isMet = true;
          if (goal.targetType === 'building_count' && goal.buildingType) {
            if ((buildingCounts[goal.buildingType] || 0) >= goal.targetValue) isMet = true;
          }

          if (isMet) {
            setCurrentGoal({ ...goal, completed: true });
          }
        }

        return newStats;
      });

      // 4. Trigger news
      fetchNews();

      // Implement dynamic tick rate throttling based on FPS
      let adaptiveBase = TICK_RATE_MS;
      if (devFrameStats) {
        const currentFps = devFrameStats.fps || 60;
        if (currentFps < 20) adaptiveBase = TICK_RATE_MS * 4; // heavy throttle
        else if (currentFps < 40) adaptiveBase = TICK_RATE_MS * 2; // mild throttle
      }

      timeoutIdRef.current = setTimeout(tick, adaptiveBase / speedMultiplier);
    };

    timeoutIdRef.current = setTimeout(tick, TICK_RATE_MS / speedMultiplier);

    return () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    };
  }, [fetchNews, gameStarted, speedMultiplier, gridSize, devFrameStats]);


  // --- Interaction Logic ---

  const handleTileClick = useCallback((x: number, y: number) => {
    if (!gameStarted) return; // Prevent clicking through start screen

    const currentGrid = gridRef.current;
    const currentStats = statsRef.current;
    const tool = selectedTool; // Capture current tool
    const isSandbox = sandboxModeRef.current;
    
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;

    const currentTile = currentGrid[y][x];
    const buildingConfig = BUILDINGS[tool];
    const isUnlocked = isSandbox || currentStats.level >= buildingConfig.unlockLevel;

    // Bulldoze logic
    if (tool === BuildingType.None) {
      if (currentTile.buildingType !== BuildingType.None) {
        const demolishCost = isSandbox ? 0 : 5;
        if (isSandbox || currentStats.money >= demolishCost) {
            const newGrid = currentGrid.map(row => [...row]);
            newGrid[y][x] = { 
              ...currentTile, 
              buildingType: BuildingType.None,
              isBridge: false,
              rotation: 0,
              efficiency: 1.0,
              lifetimeIncome: 0
            };
            setGrid(newGrid);
            if (!isSandbox) {
              setStats(prev => ({ ...prev, money: prev.money - demolishCost }));
            }
            // Clear current inspector
            setInspectedTile(null);
        } else {
            addNewsItem({id: Date.now().toString(), text: "Cannot afford demolition costs.", type: 'negative'});
        }
      }
      return;
    }

    // Inspect building logic: Clicking an already built segment (unless we are clicking to place road on water bridge)
    const isWaterBridgePlacement = tool === BuildingType.Road && currentTile.isWater;

    if (currentTile.buildingType !== BuildingType.None && !isWaterBridgePlacement) {
      // Open detailed holographic visual diagnostics panel
      setInspectedTile({ x, y });
      return;
    }

    // Placement/Variant Logic
    if (currentTile.buildingType === BuildingType.None || isWaterBridgePlacement) {
      if (!isUnlocked) {
          addNewsItem({id: Date.now().toString() + Math.random(), text: `${buildingConfig.name} is locked.`, type: 'negative'});
          return;
      }

      const placementCost = isWaterBridgePlacement ? (isSandbox ? 0 : buildingConfig.cost * 3) : buildingConfig.cost;

      if (isSandbox || currentStats.money >= placementCost) {
        // Deduct cost
        if (!isSandbox) {
          setStats(prev => ({ ...prev, money: prev.money - placementCost }));
        }
        
        // Place building or bridge
        const newGrid = currentGrid.map(row => [...row]);
        newGrid[y][x] = { 
          ...currentTile, 
          buildingType: tool,
          isBridge: isWaterBridgePlacement ? true : false,
          rotation: 0,
          efficiency: 1.0,
          lifetimeIncome: 0
        };
        setGrid(newGrid);

        if (isWaterBridgePlacement) {
          addNewsItem({id: Date.now().toString() + Math.random(), text: "Constructed structural over-water transit bridge.", type: 'positive'});
        }
      } else {
        // Not enough money feedback
        addNewsItem({id: Date.now().toString() + Math.random(), text: `Treasury insufficient for ${buildingConfig.name}.`, type: 'negative'});
      }
    }
  }, [selectedTool, addNewsItem, gameStarted, gridSize]);

  const handleAdminAction = (action: string) => {
    switch (action) {
      case 'addMoney':
        setStats(prev => ({ ...prev, money: prev.money + 1000 }));
        break;
      case 'addPop':
        setStats(prev => ({ ...prev, population: prev.population + 50 }));
        break;
      case 'reset':
        setGrid(createInitialGrid(gridSize, seed, mapTheme));
        const startMoney = sandboxMode ? 999999999 : 5000;
        setStats({ money: startMoney, population: 0, day: 1, level: 1, xp: 0 });
        setCurrentGoal(null);
        setNewsFeed([]);
        break;
    }
  };

  const handleClaimReward = () => {
    if (currentGoal && currentGoal.completed) {
      setStats(prev => ({ 
        ...prev, 
        money: prev.money + currentGoal.reward,
        xp: prev.xp + 100 // Example XP on goal completion
      }));
      addNewsItem({id: Date.now().toString(), text: `Goal achieved! ${currentGoal.reward} deposited to treasury.`, type: 'positive'});
      setCurrentGoal(null);
      fetchNewGoalInternal();
    }
  };

  const handleStart = (config: {
    aiEnabled: boolean;
    gridSize: number;
    cityName: string;
    budgetMode: 'normal' | 'rich' | 'sandbox';
    mapTheme: 'temperate' | 'desert' | 'winter';
    ruggedness: number;
    seed: number;
  }) => {
    setAiEnabled(config.aiEnabled);
    setGridSize(config.gridSize);
    setCityName(config.cityName);
    setMapTheme(config.mapTheme);
    setRuggedness(config.ruggedness);
    setSeed(config.seed);
    const isSandboxMode = config.budgetMode === 'sandbox';
    setSandboxMode(isSandboxMode);
    
    const startingMoney = config.budgetMode === 'normal' ? 5000 : config.budgetMode === 'rich' ? 50000 : 999999999;
    setStats({ money: startingMoney, population: 0, day: 1, level: 1, xp: 0 });
    
    setGrid(createInitialGrid(config.gridSize, config.seed, config.mapTheme));
    setGameStarted(true);
  };

  // --- States and logic for AI Labs and Building Inspector ---
  const [ideaCategory, setIdeaCategory] = useState<'Infrastructure' | 'Economy' | 'Environment' | 'Recreation'>('Infrastructure');
  const [newIdeaText, setNewIdeaText] = useState('');
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [editingIdeaText, setEditingIdeaText] = useState('');
  const [isGeneratingFeature, setIsGeneratingFeature] = useState(false);
  const [featureResult, setFeatureResult] = useState<string | null>(null);

  const inspectedData = inspectedTile && inspectedTile.x < gridSize && inspectedTile.y < gridSize ? grid[inspectedTile.y][inspectedTile.x] : null;

  const handleRotateInspected = () => {
    if (!inspectedTile) return;
    const { x, y } = inspectedTile;
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      next[y][x] = {
        ...next[y][x],
        rotation: ((next[y][x].rotation || 0) + 90) % 360
      };
      return next;
    });
    addNewsItem({
      id: Date.now().toString() + Math.random(),
      text: `Rotated building at X${x}, Y${y} by +90 degrees.`,
      type: 'neutral'
    });
  };

  const handleDemolishInspected = () => {
    if (!inspectedTile) return;
    const { x, y } = inspectedTile;
    const cost = sandboxMode ? 0 : 5;
    if (sandboxMode || stats.money >= cost) {
      setGrid(prev => {
        const next = prev.map(row => [...row]);
        next[y][x] = {
          ...next[y][x],
          buildingType: BuildingType.None,
          isBridge: false,
          rotation: 0,
          efficiency: 1.0,
          lifetimeIncome: 0
        };
        return next;
      });
      if (!sandboxMode) {
        setStats(prev => ({ ...prev, money: prev.money - cost }));
      }
      setInspectedTile(null);
      addNewsItem({ id: Date.now().toString(), text: "Demolished sector structural segment.", type: 'negative' });
    } else {
      addNewsItem({ id: Date.now().toString(), text: "Cannot afford demolition.", type: 'negative' });
    }
  };

  const handleAddIdea = () => {
    if (!newIdeaText.trim()) return;
    const newIdea: FeatureIdea = {
      id: Date.now().toString(),
      text: newIdeaText.trim(),
      category: ideaCategory
    };
    setAiIdeas(prev => [...prev, newIdea]);
    setNewIdeaText('');
    addNewsItem({
      id: Date.now().toString(),
      text: `Added new ${ideaCategory} conceptual blueprint to AI ideas pipeline.`,
      type: 'positive'
    });
  };

  const handleStartEdit = (idea: FeatureIdea) => {
    setEditingIdeaId(idea.id);
    setEditingIdeaText(idea.text);
  };

  const handleSaveEdit = (id: string) => {
    setAiIdeas(prev => prev.map(idea => idea.id === id ? { ...idea, text: editingIdeaText } : idea));
    setEditingIdeaId(null);
    addNewsItem({ id: Date.now().toString(), text: "Saved concept blueprint modifications.", type: 'neutral' });
  };

  const handleGenerateFeature = async () => {
    const selectedList = aiIdeas.filter(idea => selectedIdeas[idea.id]);
    if (selectedList.length === 0) return;

    setIsGeneratingFeature(true);
    setFeatureResult(null);
    try {
      const response = await fetch("/api/gemini/feature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideas: selectedList }),
      });
      if (!response.ok) throw new Error("Server brain returned a fault code.");
      const data = await response.json();
      setFeatureResult(data.result);
    } catch (e: any) {
      console.error(e);
      setFeatureResult(`## 🚨 NEURAL CO-CREATION BUS FAULT\n\nFailed to establish connection to the Gemini generation pool.\n\nSymptom:\n${e.message}\n\nPlease verify environment secrets are loaded properly.`);
    } finally {
      setIsGeneratingFeature(false);
    }
  };

  // Helper Markdown renderer for design documents
  const SimpleMarkdown = ({ text }: { text: string }) => {
    const lines = text.split("\n");
    return (
      <div className="space-y-3 font-sans text-sm text-gray-200 leading-relaxed max-h-[50vh] overflow-y-auto pr-2">
        {lines.map((line, idx) => {
          if (line.startsWith("## ")) {
            return <h2 key={idx} className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 mt-6 border-b border-cyan-500/10 pb-1 uppercase tracking-wide">{line.replace("## ", "")}</h2>;
          }
          if (line.startsWith("### ")) {
            return <h3 key={idx} className="text-sm font-bold text-indigo-300 mt-4 tracking-wider uppercase font-mono">{line.replace("### ", "")}</h3>;
          }
          if (line.startsWith("- ")) {
            return (
              <div key={idx} className="flex gap-2 pl-2">
                <span className="text-cyan-400 font-extrabold">•</span>
                <p className="flex-1 text-gray-300 text-xs">{line.replace("- ", "")}</p>
              </div>
            );
          }
          if (line.trim() === "") return <div key={idx} className="h-2" />;
          return <p key={idx} className="text-gray-300 text-xs">{line}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="relative w-screen h-dvh overflow-hidden selection:bg-transparent selection:text-transparent bg-sky-900">
      {/* 3D Rendering Layer - Always visible now, providing background for start screen */}
      <IsoMap 
        grid={grid} 
        onTileClick={handleTileClick} 
        hoveredTool={selectedTool}
        population={stats.population}
        day={stats.day}
        showDevStats={showDevStats}
        themeName={mapTheme}
        ruggedness={ruggedness}
        seed={seed}
        terrainQuality={terrainQuality}
        enableShadows={enableShadows}
        onDevFrameStats={handleDevFrameStats}
      />
      
      {/* Start Screen Overlay */}
      {!gameStarted && (
        <StartScreen onStart={handleStart} />
      )}

      {/* Interactive Placed Building Inspector Overlay */}
      {gameStarted && inspectedTile && inspectedData && inspectedData.buildingType !== BuildingType.None && (
        <div className="absolute right-4 top-[140px] z-30 w-80 bg-slate-900/95 backdrop-blur-md border-2 border-cyan-500/40 rounded-2xl shadow-2xl p-4 text-white animate-fade-in">
          <div className="flex justify-between items-center border-b border-cyan-500/20 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎛️</span>
              <div>
                <h3 className="font-bold text-sm tracking-wide text-cyan-300 uppercase">
                  {BUILDINGS[inspectedData.buildingType].name}
                </h3>
                <span className="text-[10px] text-gray-400 font-mono">
                  Sector Grid: X{inspectedTile.x}, Y{inspectedTile.y}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setInspectedTile(null)}
              className="text-gray-400 hover:text-white font-black text-sm bg-slate-800 hover:bg-slate-700 w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 font-mono">
            <div>
              <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                <span>SYSTEM CAPACITY:</span>
                <span className={inspectedData.efficiency && inspectedData.efficiency >= 0.9 ? 'text-green-400 font-bold' : 'text-amber-400 font-bold'}>
                  {Math.round((inspectedData.efficiency || 1.0) * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700/50">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    inspectedData.efficiency && inspectedData.efficiency >= 0.9 
                      ? 'bg-gradient-to-r from-emerald-500 to-green-400' 
                      : 'bg-gradient-to-r from-yellow-500 to-amber-500'
                  }`}
                  style={{ width: `${(inspectedData.efficiency || 1.0) * 100}%` }}
                />
              </div>
              {(inspectedData.efficiency || 1.0) < 0.9 && (
                <p className="text-[9px] text-amber-300 bg-amber-950/40 p-1.5 rounded border border-amber-900/30 mt-1.5 leading-tight animate-pulse">
                  ⚠️ SECTOR ISOLATED! Construct transit road grids adjacent to this sector for maximum operating capacity.
                </p>
              )}
            </div>

            <div className="flex justify-between items-baseline bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-gray-400 uppercase">LIFETIME INCOME:</span>
              <span className="text-md font-bold text-green-400">
                +${Math.floor(inspectedData.lifetimeIncome || 0).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-xs text-gray-300">
              <span>ROTATION OFFSET:</span>
              <span className="text-cyan-400 font-bold">{inspectedData.rotation || 0}° DEG</span>
            </div>
            
            {inspectedData.isBridge && (
              <div className="text-[9px] text-cyan-300 bg-cyan-950/40 p-2 rounded border border-cyan-800/30 text-center uppercase tracking-widest font-black">
                🌉 Channel Bridge Over Water
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800">
            <button
              onClick={handleRotateInspected}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-600 transition-all cursor-pointer hover:scale-102"
              title="Rotate building 90 degrees"
            >
              🔄 Rotate
            </button>
            <button
              onClick={handleDemolishInspected}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-red-950/80 hover:bg-red-900 text-red-200 font-bold text-xs rounded-xl border border-red-500/30 transition-all cursor-pointer hover:scale-102"
            >
              🗑️ Demolish
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen AI Labs Incubator Modal */}
      {showAiLabs && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="relative w-full max-w-5xl h-[85vh] bg-slate-900 border-2 border-cyan-500/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white animate-fade-in">
            
            {/* Header */}
            <div className="flex justify-between items-center bg-slate-950/80 px-6 py-4 border-b border-cyan-500/20">
              <div className="flex items-center gap-3">
                <span className="text-2xl animate-spin">💡</span>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
                    AI Feature Incubator Labs
                  </h2>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">
                    Neural net design pipeline / Co-create modular city-builder specifications
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowAiLabs(false);
                  setFeatureResult(null);
                }}
                className="text-gray-400 hover:text-white font-black bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer border border-cyan-500/20"
              >
                ✕
              </button>
            </div>

            {/* Split Content */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              
              {/* Left Side: Adding new specs */}
              <div className="w-full md:w-5/12 p-6 border-r border-slate-800 flex flex-col gap-4 overflow-y-auto">
                <div className="space-y-1">
                  <h3 className="font-bold text-xs uppercase tracking-widest text-cyan-400 font-mono">
                    Incubate New Concept
                  </h3>
                  <p className="text-[11px] text-gray-400 leading-snug">
                    Draft a single specific mechanic or vision of a city element. Our AI co-creator will study and bind it into the active simulator layout.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider font-mono">
                      Category
                    </label>
                    <select
                      value={ideaCategory}
                      onChange={(e: any) => setIdeaCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs font-mono text-cyan-400 outline-none focus:border-cyan-500"
                    >
                      <option value="Infrastructure">Infrastructure</option>
                      <option value="Economy">Economy</option>
                      <option value="Environment">Environment</option>
                      <option value="Recreation">Recreation</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider font-mono">
                      Concept Draft Speccing
                    </label>
                    <textarea
                      value={newIdeaText}
                      onChange={(e) => setNewIdeaText(e.target.value)}
                      placeholder="e.g. Add hyperloop grid columns or water purifiers that generate research tokens..."
                      maxLength={180}
                      rows={5}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-500 resize-none"
                    />
                    <div className="text-right text-[9px] text-gray-500 font-mono">
                      {newIdeaText.length}/180 chars limit
                    </div>
                  </div>

                  <button
                    onClick={handleAddIdea}
                    disabled={!newIdeaText.trim()}
                    className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-gray-500 disabled:border-transparent border-2 border-cyan-400/40 text-xs font-extrabold uppercase rounded-xl transition-all cursor-pointer shadow-lg shadow-cyan-900/10 active:scale-95"
                  >
                    🚀 Load Draft Into Lab Repo
                  </button>
                </div>
              </div>

              {/* Right Side: Ideas Checklist */}
              <div className="w-full md:w-7/12 p-6 flex flex-col overflow-hidden bg-slate-950/30">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-xs uppercase tracking-widest text-indigo-400 font-mono">
                    Incubator Blueprint Repository (Pending)
                  </h3>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-900 px-2 py-0.5 rounded-full uppercase">
                    {aiIdeas.length} Active Modules
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 mb-4 scrollbar-custom">
                  {aiIdeas.map((idea) => {
                    const isChecked = !!selectedIdeas[idea.id];
                    const isEditing = editingIdeaId === idea.id;
                    
                    let bgBadge = 'bg-[emerald]';
                    if (idea.category === 'Infrastructure') bgBadge = 'bg-blue-900/60 text-blue-300 border-blue-800';
                    if (idea.category === 'Economy') bgBadge = 'bg-amber-900/60 text-amber-300 border-amber-800';
                    if (idea.category === 'Environment') bgBadge = 'bg-teal-900/60 text-teal-300 border-teal-800';
                    if (idea.category === 'Recreation') bgBadge = 'bg-purple-900/60 text-purple-300 border-purple-800';

                    return (
                      <div 
                        key={idea.id} 
                        className={`flex items-start gap-3 p-3 rounded-xl border ${
                          isChecked ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-950/30' : 'bg-slate-900/60 border-slate-800/80'
                        } hover:border-slate-700/60 transition-all`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedIdeas(prev => ({
                              ...prev,
                              [idea.id]: !prev[idea.id]
                            }));
                          }}
                          className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-gray-600 accent-indigo-500 cursor-pointer"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${bgBadge}`}>
                              {idea.category}
                            </span>
                          </div>

                          {isEditing ? (
                            <div className="flex gap-2 mt-1">
                              <input
                                type="text"
                                value={editingIdeaText}
                                onChange={(e) => setEditingIdeaText(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                              />
                              <button
                                onClick={() => handleSaveEdit(idea.id)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-200 leading-snug">{idea.text}</p>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleStartEdit(idea)}
                              className="text-[10px] text-gray-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded cursor-pointer"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => {
                                setAiIdeas(prev => prev.filter(i => i.id !== idea.id));
                                setSelectedIdeas(prev => {
                                  const c = { ...prev };
                                  delete c[idea.id];
                                  return c;
                                });
                                addNewsItem({ id: Date.now().toString(), text: "Deleted concept from AI incubator repository.", type: 'neutral' });
                              }}
                              className="text-[10px] text-gray-400 hover:text-red-400 bg-slate-800 hover:bg-red-950/40 px-2 py-1 rounded cursor-pointer"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Synthesis Trigger */}
                <div className="pt-2 border-t border-slate-800 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div className="text-[10px] text-gray-400 uppercase font-mono">
                      Selected Modules to Synthesize: 
                      <span className="text-indigo-400 font-bold ml-1">
                        {Object.keys(selectedIdeas).filter(k => selectedIdeas[k]).length} Selected
                      </span>
                    </div>
                    {Object.keys(selectedIdeas).filter(k => selectedIdeas[k]).length > 1 && (
                      <span className="text-[8px] bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                        💡 COMBINE MODE ACTIVE
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleGenerateFeature}
                    disabled={Object.keys(selectedIdeas).filter(k => selectedIdeas[k]).length === 0 || isGeneratingFeature}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-650 hover:from-indigo-400 hover:to-purple-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-gray-500 border-2 border-indigo-400/40 text-xs font-black uppercase rounded-2xl transition-all cursor-pointer shadow-lg shadow-indigo-900/20 active:scale-[0.98] flex items-center justify-center gap-2 text-white"
                  >
                    {isGeneratingFeature ? (
                      <span className="flex items-center gap-1">
                        <span className="animate-spin mr-1">🪐</span> Neural Synthesis Active...
                      </span>
                    ) : Object.keys(selectedIdeas).filter(k => selectedIdeas[k]).length > 1 ? (
                      "💡 Synthesize & Co-Create (AI Combined Model)"
                    ) : (
                      "🚀 Generate Feature GDD Specification (AI Model)"
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Neural Net Processing Output Drawer */}
            {(isGeneratingFeature || featureResult) && (
              <div className="absolute inset-0 bg-slate-900/98 z-50 flex flex-col overflow-hidden text-white animate-fade-in">
                <div className="flex justify-between items-center bg-slate-950 px-6 py-4 border-b border-indigo-500/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚡</span>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-300 font-mono">
                      AI Labs Holographic Co-Creator Terminal
                    </h2>
                  </div>
                  {!isGeneratingFeature && (
                    <button 
                      onClick={() => setFeatureResult(null)}
                      className="bg-slate-800 hover:bg-slate-700 text-gray-300 font-bold text-xs py-1.5 px-3.5 rounded-xl border border-indigo-500/30 cursor-pointer"
                    >
                      Return to Workspace
                    </button>
                  )}
                </div>

                <div className="flex-1 p-6 overflow-y-auto uppercase-none">
                  {isGeneratingFeature ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-6">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center text-lg">💡</div>
                      </div>
                      
                      <div className="space-y-4 text-center max-w-sm">
                        <h3 className="font-extrabold text-sm text-indigo-400 tracking-widest uppercase animate-pulse font-mono">
                          Binding Design Matrices
                        </h3>
                        <div className="font-mono text-[9px] text-gray-400 space-y-1 bg-slate-950/85 p-4 rounded-xl border border-slate-800 text-left">
                          <div>[LOGS]: Querying gemini-3.5-flash model node...</div>
                          <div className="animate-pulse">[SYSTEM]: Synthesizing token dependencies...</div>
                          <div>[SIMULATOR]: Mapping grid vectors to GDD outline...</div>
                          <div>[NEURAL]: Compiling visual particle suggestions...</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-3xl mx-auto bg-slate-950/80 p-6 rounded-2xl border border-indigo-500/20 shadow-inner flex flex-col gap-4">
                      <div className="border-b border-slate-800 pb-3 mb-2 flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 font-mono">STATUS: SIMULATION SPECIFICATION COMPILED SUCCESS</span>
                        <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono font-bold">Ready for Dev</span>
                      </div>
                      <SimpleMarkdown text={featureResult || ""} />
                    </div>
                  )}
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}

      {/* Cyber diagnostics runtime fault boundary alert */}
      {errorLogs.length > 0 && (
        <div className="absolute right-4 top-4 bottom-4 w-full max-w-[360px] md:max-w-[400px] z-50 p-4 bg-slate-950/95 backdrop-blur border border-red-500 rounded-2xl font-mono text-white flex flex-col gap-3 shadow-2xl animate-fade-in pointer-events-auto">
          <div className="flex justify-between items-center border-b border-red-500/30 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg animate-bounce">🚨</span>
              <span className="text-xs font-extrabold text-red-400 uppercase tracking-widest">
                SYSTEM FAULT DIAGNOSTICS
              </span>
            </div>
            <button 
              onClick={() => setErrorLogs([])}
              className="text-red-450 hover:text-red-300 transition text-[10px] uppercase font-bold"
            >
              Clear
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {errorLogs.map((log) => (
              <div key={log.id} className="bg-red-950/40 p-3 rounded-lg border border-red-900/30 space-y-1">
                <p className="font-bold text-red-300 text-[11px] leading-tight select-text">Exception: {log.message}</p>
                {log.stack && (
                  <pre className="mt-1 p-2 bg-black/50 text-[9px] text-red-400/80 overflow-x-auto select-text scrollbar-custom max-h-32 rounded">
                    {log.stack}
                  </pre>
                )}
                <div className="text-right text-[8px] text-neutral-400">
                  DUMP TIME: {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-red-500/30 pt-3">
            <button
              onClick={() => {
                const text = errorLogs.map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}\nStack:\n${log.stack || 'N/A'}`).join('\n\n');
                navigator.clipboard.writeText(text).then(() => {
                  setCopiedLogs(true);
                  setTimeout(() => setCopiedLogs(false), 2000);
                }).catch(() => {});
              }}
              className="w-full bg-red-900 hover:bg-red-800 text-white font-extrabold text-xs py-2 rounded-xl transition duration-150 uppercase"
            >
              {copiedLogs ? 'Copied Log Data!' : 'Copy Diagnostic Logs'}
            </button>
          </div>
        </div>
      )}

       {/* UI Layer */}
      {gameStarted && (
        <UIOverlay
          stats={stats}
          selectedTool={selectedTool}
          onSelectTool={setSelectedTool}
          currentGoal={currentGoal}
          newsFeed={newsFeed}
          onClaimReward={handleClaimReward}
          isGeneratingGoal={isGeneratingGoal}
          aiEnabled={aiEnabled}
          isSandbox={sandboxMode}
          uiScale={uiScale}
          setUiScale={setUiScale}
          onAdminAction={handleAdminAction}
          showDevStats={showDevStats}
          setShowDevStats={setShowDevStats}
          cityName={cityName}
          mapTheme={mapTheme}
          ruggedness={ruggedness}
          seed={seed}
          terrainQuality={terrainQuality}
          setTerrainQuality={setTerrainQuality}
          enableShadows={enableShadows}
          setEnableShadows={setEnableShadows}
          speedMultiplier={speedMultiplier}
          setSpeedMultiplier={setSpeedMultiplier}
          devFrameStats={devFrameStats}
          onOpenAiLabs={() => setShowAiLabs(true)}
          grid={grid}
        />
      )}

      {/* CSS for animations and utility */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .mask-image-b { -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%); mask-image: linear-gradient(to bottom, transparent 0%, black 15%); }
        
        /* Vertical text for toolbar label */
        .writing-mode-vertical { writing-mode: vertical-rl; text-orientation: mixed; }
        
        /* Custom scrollbar for news */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      `}</style>
    </div>
  );
}

export default App;