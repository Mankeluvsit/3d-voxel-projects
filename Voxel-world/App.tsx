/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid, TileData, BuildingType, CityStats, AIGoal, NewsItem, MusicTrack } from './types';
import { BUILDINGS, TICK_RATE_MS, INITIAL_MONEY } from './constants';
import IsoMap from './components/IsoMap';
import UIOverlay from './components/UIOverlay';
import StartScreen from './components/StartScreen';
import IdeaLab from './IdeaLab';
import { generateCityGoal, generateNewsEvent, getOptimalLayout } from './services/aiService';
import { ResourceNode } from './types';

// Initialize empty grid with island shape generation for 3D visual interest
const createInitialGrid = (size: number, resources: ResourceNode[] = []): Grid => {
  const grid: Grid = [];
  const center = size / 2;

  for (let y = 0; y < size; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < size; x++) {
      const resource = resources.find(r => r.x === x && r.y === y);
      row.push({ 
        x, 
        y, 
        buildingType: BuildingType.None,
        resourceType: resource?.type
      });
    }
    grid.push(row);
  }
  return grid;
};

function App() {
  // --- Game State with Local Storage ---
  const [gameStarted, setGameStarted] = useState(() => {
    const saved = localStorage.getItem('sky_metropolis_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.gameStarted ?? false;
      } catch (e) { return false; }
    }
    return false;
  });

  const [aiEnabled, setAiEnabled] = useState(() => {
    const saved = localStorage.getItem('sky_metropolis_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.aiEnabled ?? true;
      } catch (e) { return true; }
    }
    return true;
  });

  const [gridSize, setGridSize] = useState(() => {
    const saved = localStorage.getItem('sky_metropolis_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.gridSize ?? 20;
      } catch (e) { return 20; }
    }
    return 20;
  });

  const [grid, setGrid] = useState<Grid>(() => {
    const saved = localStorage.getItem('sky_metropolis_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.grid) return parsed.grid;
      } catch (e) {}
    }
    return createInitialGrid(20);
  });

  const [stats, setStats] = useState<CityStats>(() => {
    const saved = localStorage.getItem('sky_metropolis_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.stats) {
          return {
            money: parsed.stats.money ?? INITIAL_MONEY,
            population: parsed.stats.population ?? 0,
            day: parsed.stats.day ?? 1,
            energyProduction: parsed.stats.energyProduction ?? 0,
            energyDemand: parsed.stats.energyDemand ?? 0,
            waterProduction: parsed.stats.waterProduction ?? 0,
            waterDemand: parsed.stats.waterDemand ?? 0,
            mineralProduction: parsed.stats.mineralProduction ?? 0,
            taxRate: parsed.stats.taxRate ?? 10
          };
        }
      } catch (e) {}
    }
    return {
      money: INITIAL_MONEY,
      population: 0,
      day: 1,
      energyProduction: 0,
      energyDemand: 0,
      waterProduction: 0,
      waterDemand: 0,
      mineralProduction: 0,
      taxRate: 10
    };
  });

  const [selectedTool, setSelectedTool] = useState<BuildingType>(BuildingType.Road);
  
  // --- AI State ---
  const [currentGoal, setCurrentGoal] = useState<AIGoal | null>(() => {
    const saved = localStorage.getItem('sky_metropolis_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.currentGoal ?? null;
      } catch (e) { return null; }
    }
    return null;
  });
  const [isGeneratingGoal, setIsGeneratingGoal] = useState(false);
  const [newsFeed, setNewsFeed] = useState<NewsItem[]>([]);
  
  // --- Music State ---
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>(() => {
    const saved = localStorage.getItem('sky_metropolis_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.musicTracks ?? [];
      } catch (e) { return []; }
    }
    return [];
  });
  const [isMusicLabOpen, setIsMusicLabOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'game' | 'lab'>('game');
  
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

  // --- Local Storage Auto-Saving ---
  useEffect(() => {
    if (gameStarted) {
      const saveData = {
        grid,
        stats,
        currentGoal,
        aiEnabled,
        gridSize,
        gameStarted,
        musicTracks
      };
      localStorage.setItem('sky_metropolis_save', JSON.stringify(saveData));
    }
  }, [grid, stats, currentGoal, aiEnabled, gridSize, gameStarted, musicTracks]);

  // --- AI Logic Wrappers ---

  const addNewsItem = useCallback((item: NewsItem) => {
    setNewsFeed(prev => [...prev.slice(-12), item]); // Keep last few
  }, []);

  const fetchNewGoal = useCallback(async () => {
    if (isGeneratingGoal || !aiEnabledRef.current) return;
    setIsGeneratingGoal(true);
    // Short delay for visual effect
    await new Promise(r => setTimeout(r, 500));
    
    const newGoal = await generateCityGoal(statsRef.current, gridRef.current);
    if (newGoal) {
      setCurrentGoal(newGoal);
    } else {
      // Fallback goal if AI fails
      const fallbacks: Omit<AIGoal, 'completed'>[] = [
        { description: "Expand the residential district to house 100 citizens.", targetType: 'population', targetValue: 100, reward: 500 },
        { description: "Accumulate $2000 in the city treasury.", targetType: 'money', targetValue: 2000, reward: 300 },
        { description: "Build 5 commercial zones to boost the economy.", targetType: 'building_count', targetValue: 5, buildingType: BuildingType.Commercial, reward: 400 },
        { description: "Create a green city with 3 parks.", targetType: 'building_count', targetValue: 3, buildingType: BuildingType.Park, reward: 250 }
      ];
      const randomGoal = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      setCurrentGoal({ ...randomGoal, completed: false });
      
      addNewsItem({ id: `fallback-goal-${Date.now()}`, text: "AI Advisor is offline. Using local city planning protocols.", type: 'neutral' });
      
      // Retry AI soon if failed, but only if AI still enabled
      if(aiEnabledRef.current) setTimeout(fetchNewGoal, 30000);
    }
    setIsGeneratingGoal(false);
  }, [isGeneratingGoal]); 

  const fetchNews = useCallback(async () => {
    // chance to fetch news per tick - reduced to 2% to avoid rate limits
    if (!aiEnabledRef.current || Math.random() > 0.02) return; 
    const news = await generateNewsEvent(statsRef.current, null);
    if (news) {
      addNewsItem(news);
    } else {
      // Fallback news
      const fallbacks = [
        "Citizens report seeing strange lights in the sky.",
        "Local park voted 'Best place to sit' by local pigeon.",
        "Traffic congestion reported near the city center.",
        "New mayor promises more clouds, less rain.",
        "Economic forecast: Sunny with a chance of taxes."
      ];
      addNewsItem({
        id: `fallback-${Date.now()}`,
        text: fallbacks[Math.floor(Math.random() * fallbacks.length)],
        type: 'neutral'
      });
    }
  }, [addNewsItem]);


  // --- Initial Setup ---
  useEffect(() => {
    if (!gameStarted) return;

    addNewsItem({ id: Date.now().toString(), text: "Welcome to SkyMetropolis. Terrain generation complete.", type: 'positive' });
    
    if (aiEnabled) {
      // @google/genai-api-key-fix: The API key's availability is a hard requirement and should not be checked in the UI.
      fetchNewGoal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted]);


  // --- Game Loop ---
  useEffect(() => {
    if (!gameStarted) return;

    const intervalId = setInterval(() => {
      // 1. Calculate production of resources by Extractors
      let totalEnergy = 0;
      let totalWater = 0;
      let totalMineral = 0;

      gridRef.current.flat().forEach(tile => {
        if (tile.buildingType === BuildingType.Extractor) {
          if (tile.resourceType === 'Energy') totalEnergy += 10;
          else if (tile.resourceType === 'Water') totalWater += 10;
          else if (tile.resourceType === 'Mineral') totalMineral += 10;
        }
      });

      // 2. Calculate demand and general building counts
      let energyDemand = 0;
      let waterDemand = 0;
      let buildingCounts: Record<string, number> = {};

      gridRef.current.flat().forEach(tile => {
        if (tile.buildingType !== BuildingType.None) {
          buildingCounts[tile.buildingType] = (buildingCounts[tile.buildingType] || 0) + 1;
          
          if (tile.buildingType === BuildingType.Residential) {
            energyDemand += 1;
            waterDemand += 2;
          } else if (tile.buildingType === BuildingType.Commercial) {
            energyDemand += 2;
            waterDemand += 1;
          } else if (tile.buildingType === BuildingType.Industrial) {
            energyDemand += 4;
            waterDemand += 2;
          } else if (tile.buildingType === BuildingType.Park) {
            waterDemand += 1;
          }
        }
      });

      // 3. Allocate resources and compute tile-by-tile yields
      let remainingEnergy = totalEnergy;
      let remainingWater = totalWater;
      let dailyIncome = 0;
      let dailyPopGrowth = 0;

      const nextGrid = gridRef.current.map(row => row.map(tile => {
        const nextTile = { ...tile, isPowered: true, hasWater: true, isIncomeGenerating: false };

        if (tile.buildingType === BuildingType.None || tile.buildingType === BuildingType.Road) {
          return nextTile;
        }

        if (tile.buildingType === BuildingType.Extractor) {
          if (tile.resourceType === 'Mineral') {
            dailyIncome += 40; // Minerals generate heavy cash direct yield
            nextTile.isIncomeGenerating = true;
          }
          return nextTile;
        }

        let pReq = 0;
        let wReq = 0;
        let baseIncome = 0;
        let basePop = 0;

        if (tile.buildingType === BuildingType.Residential) {
          pReq = 1; wReq = 2; basePop = 5;
        } else if (tile.buildingType === BuildingType.Commercial) {
          pReq = 2; wReq = 1; baseIncome = 15;
        } else if (tile.buildingType === BuildingType.Industrial) {
          pReq = 4; wReq = 2; baseIncome = 40;
        } else if (tile.buildingType === BuildingType.Park) {
          pReq = 0; wReq = 1; basePop = 1;
        }

        // Check power
        if (remainingEnergy >= pReq) {
          remainingEnergy -= pReq;
          nextTile.isPowered = true;
        } else {
          nextTile.isPowered = false;
        }

        // Check water
        if (remainingWater >= wReq) {
          remainingWater -= wReq;
          nextTile.hasWater = true;
        } else {
          nextTile.hasWater = false;
        }

        // Calculate efficiency based on resource coverage
        let efficiency = 1.0;
        if (pReq > 0 && !nextTile.isPowered) efficiency -= 0.5;
        if (wReq > 0 && !nextTile.hasWater) efficiency -= 0.5;
        efficiency = Math.max(0, efficiency);

        const currentTax = statsRef.current.taxRate !== undefined ? statsRef.current.taxRate : 10;

        // Apply Income multipliers (taxes and efficiency)
        if (baseIncome > 0) {
          const taxMultiplier = currentTax / 10;
          const tileIncome = Math.round(baseIncome * efficiency * taxMultiplier);
          dailyIncome += tileIncome;
          nextTile.isIncomeGenerating = tileIncome > 0;
        }

        // Apply Population multipliers (taxes and efficiency)
        if (basePop > 0) {
          const taxGrowthMultiplier = currentTax <= 10 
            ? (1.0 + (10 - currentTax) * 0.08) 
            : Math.max(0, 1.0 - (currentTax - 10) * 0.05);
          const tilePop = Math.round(basePop * efficiency * taxGrowthMultiplier);
          dailyPopGrowth += tilePop;
        }

        return nextTile;
      }));

      setGrid(nextGrid);

      // Cap population growth by residential count just for some logic
      const resCount = buildingCounts[BuildingType.Residential] || 0;
      const maxPop = resCount * 50; // 50 people per house max

      // 4. Update Stats State
      setStats(prev => {
        const currentTax = prev.taxRate !== undefined ? prev.taxRate : 10;
        let newPop = prev.population + dailyPopGrowth;
        if (newPop > maxPop) newPop = maxPop; // limit
        if (resCount === 0 && prev.population > 0) newPop = Math.max(0, prev.population - 5); // people leave if no homes

        const newStats = {
          money: prev.money + dailyIncome,
          population: newPop,
          day: prev.day + 1,
          energyProduction: totalEnergy,
          energyDemand,
          waterProduction: totalWater,
          waterDemand,
          mineralProduction: totalMineral,
          taxRate: currentTax
        };
        
        // 5. Check Goal Completion
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

      // 6. Trigger news
      fetchNews();

    }, TICK_RATE_MS);

    return () => clearInterval(intervalId);
  }, [fetchNews, gameStarted]);


  // --- Interaction Logic ---

  const handleTileClick = useCallback((x: number, y: number) => {
    if (!gameStarted) return; // Prevent clicking through start screen

    const currentGrid = gridRef.current;
    const currentStats = statsRef.current;
    const tool = selectedTool; // Capture current tool
    
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;

    const currentTile = currentGrid[y][x];
    const buildingConfig = BUILDINGS[tool];

    // Bulldoze logic
    if (tool === BuildingType.None) {
      if (currentTile.buildingType !== BuildingType.None) {
        const demolishCost = 5;
        if (currentStats.money >= demolishCost) {
            const newGrid = currentGrid.map(row => [...row]);
            newGrid[y][x] = { ...currentTile, buildingType: BuildingType.None };
            setGrid(newGrid);
            setStats(prev => ({ ...prev, money: prev.money - demolishCost }));
            // Sound effect here
        } else {
            addNewsItem({id: Date.now().toString(), text: "Cannot afford demolition costs.", type: 'negative'});
        }
      }
      return;
    }

    // Placement Logic
    if (currentTile.buildingType === BuildingType.None) {
      if (tool === BuildingType.Extractor && !currentTile.resourceType) {
        addNewsItem({
          id: (Date.now() + Math.random()).toString(),
          text: "Extractors can only be constructed on active Resource Nodes (Energy, Water, Mineral).",
          type: 'negative'
        });
        return;
      }

      if (currentStats.money >= buildingConfig.cost) {
        // Deduct cost
        setStats(prev => ({ ...prev, money: prev.money - buildingConfig.cost }));
        
        // Place building
        const newGrid = gridRef.current.map(row => [...row]);
        newGrid[y][x] = { ...currentTile, buildingType: tool };
        setGrid(newGrid);
        // Sound effect here
        
        addNewsItem({
          id: (Date.now() + Math.random()).toString(),
          text: `Constructed ${buildingConfig.name} on ${currentTile.resourceType ? currentTile.resourceType + ' Resource' : 'ground'}.`,
          type: 'positive'
        });
      } else {
        // Not enough money feedback
        addNewsItem({id: Date.now().toString() + Math.random(), text: `Treasury insufficient for ${buildingConfig.name}.`, type: 'negative'});
      }
    }
  }, [selectedTool, addNewsItem, gameStarted]);

  const handleClaimReward = () => {
    if (currentGoal && currentGoal.completed) {
      setStats(prev => ({ ...prev, money: prev.money + currentGoal.reward }));
      addNewsItem({id: Date.now().toString(), text: `Goal achieved! ${currentGoal.reward} deposited to treasury.`, type: 'positive'});
      setCurrentGoal(null);
      fetchNewGoal();
    }
  };

  const handleTrackGenerated = useCallback((track: MusicTrack) => {
    setMusicTracks(prev => [track, ...prev]);
    addNewsItem({ id: Date.now().toString(), text: `New city soundtrack composed: "${track.prompt.substring(0, 30)}..."`, type: 'neutral' });
  }, [addNewsItem]);

  const handleResetGame = () => {
    localStorage.removeItem('sky_metropolis_save');
    setGrid(createInitialGrid(gridSize));
    setStats({
      money: INITIAL_MONEY,
      population: 0,
      day: 1,
      energyProduction: 0,
      energyDemand: 0,
      waterProduction: 0,
      waterDemand: 0,
      mineralProduction: 0,
      taxRate: 10
    });
    setCurrentGoal(null);
    setGameStarted(false);
  };

  const handleStart = async (enabled: boolean, size: number) => {
    setAiEnabled(enabled);
    setGridSize(size);
    
    // Generate initial randomized resources immediately to let the game start instantly
    const types: ('Energy' | 'Water' | 'Mineral')[] = ['Energy', 'Water', 'Mineral'];
    const tempResources: ResourceNode[] = [];
    for (let i = 0; i < Math.floor(size * 0.4); i++) {
      tempResources.push({
        x: Math.floor(Math.random() * size),
        y: Math.floor(Math.random() * size),
        type: types[Math.floor(Math.random() * types.length)]
      });
    }
    
    setGrid(createInitialGrid(size, tempResources));
    setGameStarted(true);

    if (enabled) {
      addNewsItem({ 
        id: `init-ai-${Date.now()}`, 
        text: "AI Advisor is analyzing terrain anomalies for optimal resource deposits...", 
        type: 'neutral' 
      });
      
      // Fetch optimal layout in the background
      setTimeout(async () => {
        try {
          const aiResources = await getOptimalLayout(size, size);
          
          if (aiResources && aiResources.length > 0) {
            setGrid(prevGrid => {
              // Map previous grid and assign optimal resource types dynamically
              const nextGrid = prevGrid.map(row => row.map(tile => ({ ...tile, resourceType: undefined })));
              
              aiResources.forEach(res => {
                if (res.x >= 0 && res.x < size && res.y >= 0 && res.y < size) {
                  if (nextGrid[res.y] && nextGrid[res.y][res.x]) {
                    nextGrid[res.y][res.x].resourceType = res.type;
                  }
                }
              });
              return nextGrid;
            });
            
            addNewsItem({ 
              id: `terrain-complete-${Date.now()}`, 
              text: "AI analysis complete. Environmental scan updated with optimal resource deposits.", 
              type: 'positive' 
            });
          } else {
            addNewsItem({ 
              id: `fallback-terrain-${Date.now()}`, 
              text: "Using standard decentralized resource distribution.", 
              type: 'neutral' 
            });
          }
        } catch (err) {
          console.error("Background layout generation error:", err);
          addNewsItem({ 
            id: `fallback-terrain-${Date.now()}`, 
            text: "Using standard decentralized resource distribution.", 
            type: 'neutral' 
          });
        }
      }, 50);
    } else {
      addNewsItem({ 
        id: `sandbox-terrain-${Date.now()}`, 
        text: "Sandbox mode active. Resource anomalies detected across the landscape.", 
        type: 'neutral' 
      });
    }
  };

  if (currentView === 'lab') {
    return <IdeaLab onBack={() => setCurrentView('game')} />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden selection:bg-transparent selection:text-transparent bg-sky-900">
      {/* 3D Rendering Layer - Always visible now, providing background for start screen */}
      <IsoMap 
        grid={grid} 
        onTileClick={handleTileClick} 
        hoveredTool={selectedTool}
        population={stats.population}
        gridSize={gridSize}
      />
      
      {/* Start Screen Overlay */}
      {!gameStarted && (
        <StartScreen onStart={handleStart} />
      )}

      {/* UI Layer */}
      {gameStarted && (
        <UIOverlay
          stats={stats}
          onSetTaxRate={(rate) => setStats(prev => ({ ...prev, taxRate: rate }))}
          onResetGame={handleResetGame}
          selectedTool={selectedTool}
          onSelectTool={setSelectedTool}
          currentGoal={currentGoal}
          newsFeed={newsFeed}
          onClaimReward={handleClaimReward}
          isGeneratingGoal={isGeneratingGoal}
          aiEnabled={aiEnabled}
          isMusicLabOpen={isMusicLabOpen}
          setIsMusicLabOpen={setIsMusicLabOpen}
          musicTracks={musicTracks}
          onTrackGenerated={handleTrackGenerated}
          onOpenLab={() => setCurrentView('lab')}
        />
      )}

      {/* CSS for animations and utility */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fade-in { animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
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