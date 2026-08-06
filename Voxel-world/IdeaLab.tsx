/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lightbulb, 
  Plus, 
  Trash2, 
  Filter, 
  ArrowUpDown, 
  Sparkles, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  BarChart3,
  X,
  Search,
  Zap,
  Maximize2,
  Loader2,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import { Idea, IdeaCategory } from './types';
import { generateFeatureIdeas, generateIdeaDetails } from './services/aiService';
import Markdown from 'react-markdown';

const CATEGORIES: IdeaCategory[] = ['Gameplay', 'AI', 'Visuals', 'Economics', 'Social', 'Other'];

const DEFAULT_IDEAS: Partial<Idea>[] = [
  { title: "AI Citizen Feedback", description: "Interview citizens to get specific feedback about city life and building placement.", category: "AI", impact: 8, difficulty: "Medium" },
  { title: "AI Policy Maker", description: "Describe policies in natural language at City Hall to trigger unique news and stat changes.", category: "AI", impact: 9, difficulty: "Hard" },
  { title: "AI-Generated Billboards", description: "Dynamic ads on commercial buildings that change based on the city's current mood.", category: "AI", impact: 6, difficulty: "Medium" },
  { title: "Day/Night Cycle", description: "Dynamic lighting system with glowing windows and sunset transitions.", category: "Visuals", impact: 10, difficulty: "Hard" },
  { title: "Resource Management", description: "Add Power and Water requirements for buildings to function.", category: "Gameplay", impact: 9, difficulty: "Medium" },
  { title: "Dynamic Disasters", description: "AI-triggered crisis events like heatwaves or minor earthquakes.", category: "Gameplay", impact: 8, difficulty: "Hard" },
  { title: "Photo Mode", description: "Capture city screenshots with AI-powered artistic filters.", category: "Visuals", impact: 7, difficulty: "Medium" },
  { title: "Building Variants", description: "Multiple visual models for each building type to reduce repetition.", category: "Visuals", impact: 8, difficulty: "Easy" },
  { title: "Cinematic Camera", description: "Automated fly-throughs of the city synced to AI-generated music.", category: "Visuals", impact: 7, difficulty: "Medium" },
  { title: "Terrain Editor", description: "Raise or lower land and create lakes before building.", category: "Gameplay", impact: 9, difficulty: "Hard" },
  { title: "Blueprint Sharing", description: "Export and import district layouts as text strings.", category: "Social", impact: 6, difficulty: "Easy" },
];

const IdeaLab: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [filterCategory, setFilterCategory] = useState<IdeaCategory | 'All'>('All');
  const [sortBy, setSortBy] = useState<'date' | 'impact' | 'alpha'>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIdea, setExpandedIdea] = useState<Idea | null>(null);
  const [ideaDetails, setIdeaDetails] = useState<string | null>(null);
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false);
  const [copyDetailsSuccess, setCopyDetailsSuccess] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedApprovedIds, setSelectedApprovedIds] = useState<string[]>([]);
  const [combinedPlan, setCombinedPlan] = useState<string | null>(null);
  const [isGeneratingCombined, setIsGeneratingCombined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sky_metropolis_ideas');
    let loadedIdeas: Idea[] = [];
    
    if (saved) {
      try {
        loadedIdeas = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse ideas", e);
      }
    }

    if (loadedIdeas.length > 0) {
      setIdeas(loadedIdeas);
    } else {
      // Seed with defaults if empty or null
      const seeded = DEFAULT_IDEAS.map((idea, index) => ({
        id: `seed-${index}`,
        title: idea.title!,
        description: idea.description!,
        category: idea.category as IdeaCategory,
        impact: idea.impact!,
        difficulty: idea.difficulty as any,
        status: 'Draft' as const,
        timestamp: Date.now() - (index * 1000),
      }));
      setIdeas(seeded);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('sky_metropolis_ideas', JSON.stringify(ideas));
    }
  }, [ideas, isLoaded]);

  const handleAddIdea = (newIdea: Partial<Idea>) => {
    const idea: Idea = {
      id: Date.now().toString(),
      title: newIdea.title || 'Untitled Idea',
      description: newIdea.description || '',
      category: newIdea.category || 'Other',
      impact: newIdea.impact || 5,
      difficulty: newIdea.difficulty || 'Medium',
      status: 'Draft',
      timestamp: Date.now(),
    };
    setIdeas(prev => [idea, ...prev]);
  };

  const handleRemoveIdea = (id: string) => {
    setIdeas(prev => prev.filter(i => i.id !== id));
  };

  const handleResetDefaults = () => {
    const seeded = DEFAULT_IDEAS.map((idea, index) => ({
      id: `seed-${Date.now()}-${index}`,
      title: idea.title!,
      description: idea.description!,
      category: idea.category as IdeaCategory,
      impact: idea.impact!,
      difficulty: idea.difficulty as any,
      status: 'Draft' as const,
      timestamp: Date.now() - (index * 1000),
    }));
    setIdeas(seeded);
  };

  const handleToggleStatus = (id: string) => {
    setIdeas(prev => prev.map(i => {
      if (i.id === id) {
        const nextStatus: Idea['status'] = i.status === 'Draft' ? 'Approved' : i.status === 'Approved' ? 'Implemented' : 'Draft';
        return { ...i, status: nextStatus };
      }
      return i;
    }));
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateFeatureIdeas(prompt);
      if (result) {
        handleAddIdea(result);
        setPrompt('');
      } else {
        setError("AI synthesis failed. Check your API key or try a different prompt.");
      }
    } catch (err) {
      setError("A connection error occurred during synthesis.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExpandIdea = async (idea: Idea) => {
    setExpandedIdea(idea);
    setIdeaDetails(null);
    setIsGeneratingDetails(true);
    try {
      const details = await generateIdeaDetails(idea);
      setIdeaDetails(details);
    } catch (err) {
      setIdeaDetails("Failed to generate implementation plan.");
    } finally {
      setIsGeneratingDetails(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    setIdeas(prev => prev.filter(i => !selectedIds.includes(i.id)));
    setSelectedIds([]);
  };

  const handleCopyForAgent = () => {
    const selectedIdeas = ideas.filter(i => selectedIds.includes(i.id));
    const text = selectedIdeas.map(i => 
      `### FEATURE IDEA: ${i.title}\n**Category:** ${i.category}\n**Description:** ${i.description}\n**Impact:** ${i.impact}/10\n**Difficulty:** ${i.difficulty}`
    ).join('\n\n---\n\n');
    
    const fullPrompt = `I have selected the following feature ideas from the Idea Lab. Please help me implement them:\n\n${text}`;
    
    navigator.clipboard.writeText(fullPrompt).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleCopyDetails = () => {
    if (!ideaDetails) return;
    navigator.clipboard.writeText(ideaDetails).then(() => {
      setCopyDetailsSuccess(true);
      setTimeout(() => setCopyDetailsSuccess(false), 2000);
    });
  };

  const handleBuildCombinedPlan = async () => {
    const selectedApproved = ideas.filter(i => selectedApprovedIds.includes(i.id));
    if (selectedApproved.length === 0) return;

    setIsGeneratingCombined(true);
    setCombinedPlan(null);
    
    try {
      let fullPlan = `# Combined Implementation Plan: Sky Metropolis\n\n`;
      fullPlan += `This document outlines the integration of ${selectedApproved.length} approved features.\n\n---\n\n`;

      for (const idea of selectedApproved) {
        // Add a small delay between calls to avoid rate limits
        if (selectedApproved.indexOf(idea) > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        fullPlan += `## Feature: ${idea.title}\n`;
        fullPlan += `**Category:** ${idea.category} | **Impact:** ${idea.impact}/10 | **Difficulty:** ${idea.difficulty}\n\n`;
        
        const details = await generateIdeaDetails(idea);
        if (details) {
          fullPlan += details + `\n\n---\n\n`;
        } else {
          fullPlan += `*Failed to generate details for this feature.*\n\n---\n\n`;
        }
      }

      setCombinedPlan(fullPlan);
    } catch (err) {
      setError("Failed to generate combined implementation plan.");
    } finally {
      setIsGeneratingCombined(false);
    }
  };

  const handleCopyCombinedPlan = () => {
    if (!combinedPlan) return;
    navigator.clipboard.writeText(combinedPlan).then(() => {
      setCopyDetailsSuccess(true);
      setTimeout(() => setCopyDetailsSuccess(false), 2000);
    });
  };

  const filteredAndSortedIdeas = useMemo(() => {
    let result = ideas.filter(i => i.status === 'Draft');

    // Filter
    if (filterCategory !== 'All') {
      result = result.filter(i => i.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => 
        i.title.toLowerCase().includes(q) || 
        i.description.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'impact') return b.impact - a.impact;
      if (sortBy === 'alpha') return a.title.localeCompare(b.title);
      return b.timestamp - a.timestamp;
    });

    return result;
  }, [ideas, filterCategory, sortBy, searchQuery]);

  const approvedIdeas = useMemo(() => {
    return ideas.filter(i => i.status === 'Approved');
  }, [ideas]);

  const implementedIdeas = useMemo(() => {
    return ideas.filter(i => i.status === 'Implemented');
  }, [ideas]);

  return (
    <div className="h-screen bg-sky-950 text-white font-sans selection:bg-indigo-500/30 overflow-y-auto overflow-x-hidden custom-scrollbar">
      {/* Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%]"></div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-sky-900/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex justify-between items-center shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
            <Lightbulb className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Idea Lab</h1>
            <p className="text-sky-300/60 text-xs font-mono uppercase tracking-widest">Sky Metropolis R&D</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-6 px-4 py-2 bg-black/20 rounded-full border border-white/5">
            <div className="text-center">
              <p className="text-[10px] text-sky-400 font-bold uppercase">Total</p>
              <p className="text-lg font-mono font-bold leading-none">{ideas.length}</p>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-center">
              <p className="text-[10px] text-green-400 font-bold uppercase">Approved</p>
              <p className="text-lg font-mono font-bold leading-none">{ideas.filter(i => i.status !== 'Draft').length}</p>
            </div>
          </div>
          <button 
            onClick={onBack}
            className="bg-white/5 hover:bg-white/10 text-white/80 px-4 py-2 rounded-lg border border-white/10 transition-all flex items-center gap-2 text-sm font-medium"
          >
            <X size={18} />
            Exit Lab
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Generator & Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* AI Generator Panel */}
          <section className="bg-indigo-900/20 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles size={80} className="text-indigo-400" />
            </div>
            
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-indigo-400" />
              AI Designer
            </h2>
            
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe a feature idea... (e.g., 'A system for dynamic weather that affects building efficiency')"
              className={`w-full bg-black/40 border rounded-xl p-4 text-sm text-white placeholder-indigo-300/30 focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none transition-all mb-4 ${error ? 'border-red-500/50' : 'border-indigo-500/20'}`}
            />
            
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs mb-4 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
            
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all"
            >
              {isGenerating ? (
                <>
                  <Zap className="animate-pulse" size={18} />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Plus size={18} />
                  <span>Generate Concept</span>
                </>
              )}
            </button>
          </section>

          {/* Controls Panel */}
          <section className="bg-sky-900/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-bold text-sky-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Filter size={16} />
              Filters & Sorting
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Find an idea..."
                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {['All', ...CATEGORIES].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat as any)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filterCategory === cat ? 'bg-sky-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">Sort By</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'date', label: 'Recent', icon: Clock },
                    { id: 'impact', label: 'Impact', icon: BarChart3 },
                    { id: 'alpha', label: 'A-Z', icon: ArrowUpDown },
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => setSortBy(item.id as any)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${sortBy === item.id ? 'bg-sky-500/20 border-sky-500 text-sky-400' : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'}`}
                    >
                      <item.icon size={14} />
                      <span className="text-[10px] font-bold uppercase">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <button
                  onClick={handleResetDefaults}
                  className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white/60 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowUpDown size={12} />
                  Restore Defaults
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Idea Board */}
        <div className="lg:col-span-8 space-y-8">
          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-3">
                Idea Board
                <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-sky-400">
                  {filteredAndSortedIdeas.length} Drafts
                </span>
              </h2>
            </div>

            <div className="grid gap-4">
              <AnimatePresence mode="popLayout">
                {filteredAndSortedIdeas.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10"
                  >
                    <Lightbulb className="mx-auto text-white/10 mb-4" size={48} />
                    <p className="text-white/40 italic">No draft ideas found. Try generating one!</p>
                  </motion.div>
                ) : (
                  filteredAndSortedIdeas.map((idea) => (
                    <motion.div
                      key={idea.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group bg-sky-900/30 border border-white/10 rounded-2xl p-5 hover:border-sky-500/50 hover:bg-sky-900/50 transition-all relative overflow-hidden"
                    >
                      {/* Status Indicator */}
                      <div className="absolute top-0 left-0 w-1 h-full bg-gray-600" />

                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Checkbox */}
                        <div className="flex items-start pt-1">
                          <button 
                            onClick={() => toggleSelect(idea.id)}
                            className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${
                              selectedIds.includes(idea.id) 
                                ? 'bg-indigo-600 border-indigo-500 text-white' 
                                : 'bg-white/5 border-white/10 text-transparent hover:border-white/30'
                            }`}
                          >
                            <Check size={14} />
                          </button>
                        </div>

                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-white/5 rounded border border-white/10 text-sky-300">
                              {idea.category}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                              idea.difficulty === 'Hard' ? 'border-red-500/30 text-red-400 bg-red-500/5' :
                              idea.difficulty === 'Medium' ? 'border-amber-500/30 text-amber-400 bg-amber-500/5' :
                              'border-green-500/30 text-green-400 bg-green-500/5'
                            }`}>
                              {idea.difficulty}
                            </span>
                          </div>
                          
                          <h3 className="text-lg font-bold group-hover:text-sky-400 transition-colors">{idea.title}</h3>
                          <p className="text-sm text-white/60 leading-relaxed">{idea.description}</p>
                          
                          <div className="flex items-center gap-6 pt-2">
                            <div className="flex items-center gap-2">
                              <BarChart3 size={14} className="text-sky-400" />
                              <span className="text-xs font-bold text-white/40 uppercase">Impact</span>
                              <div className="flex gap-0.5">
                                {[...Array(10)].map((_, i) => (
                                  <div 
                                    key={i} 
                                    className={`w-1.5 h-3 rounded-full ${i < idea.impact ? 'bg-sky-500' : 'bg-white/10'}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex md:flex-col justify-between items-end gap-2">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleExpandIdea(idea)}
                              className="p-2 text-white/20 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all"
                              title="Expand Details"
                            >
                              <Maximize2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleToggleStatus(idea.id)}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                            >
                              <ChevronRight size={14} />
                              Approve
                            </button>
                          </div>
                          
                          <button 
                            onClick={() => handleRemoveIdea(idea.id)}
                            className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Approved Ideas Section */}
          <section className="pt-8 border-t border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <CheckCircle2 className="text-sky-500" size={24} />
                Approved Ideas
                <span className="text-xs font-mono bg-sky-500/10 px-2 py-0.5 rounded text-sky-400">
                  {approvedIdeas.length} Ready
                </span>
              </h2>
              
              {selectedApprovedIds.length > 0 && (
                <button
                  onClick={handleBuildCombinedPlan}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
                >
                  <Zap size={16} />
                  Build Combined Plan
                </button>
              )}
            </div>

            <div className="grid gap-4">
              <AnimatePresence mode="popLayout">
                {approvedIdeas.length === 0 ? (
                  <div className="text-center py-12 bg-white/5 rounded-3xl border border-dashed border-white/10">
                    <p className="text-white/20 text-sm">No ideas approved yet. Approve some drafts to start building.</p>
                  </div>
                ) : (
                  approvedIdeas.map((idea) => (
                    <motion.div
                      key={idea.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="group bg-indigo-900/20 border border-indigo-500/30 rounded-2xl p-5 hover:border-indigo-400 transition-all relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-sky-500" />
                      
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex items-start pt-1">
                          <button 
                            onClick={() => setSelectedApprovedIds(prev => 
                              prev.includes(idea.id) ? prev.filter(i => i !== idea.id) : [...prev, idea.id]
                            )}
                            className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${
                              selectedApprovedIds.includes(idea.id) 
                                ? 'bg-sky-500 border-sky-400 text-white' 
                                : 'bg-white/5 border-white/10 text-transparent hover:border-white/30'
                            }`}
                          >
                            <Check size={14} />
                          </button>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-sky-500/20 rounded border border-sky-500/30 text-sky-300">
                              {idea.category}
                            </span>
                            <h3 className="text-lg font-bold">{idea.title}</h3>
                          </div>
                          <p className="text-sm text-white/60">{idea.description}</p>
                        </div>

                        <div className="flex gap-2 items-center">
                          <button 
                            onClick={() => handleExpandIdea(idea)}
                            className="p-2 text-white/20 hover:text-sky-400 hover:bg-sky-400/10 rounded-lg transition-all"
                          >
                            <Maximize2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(idea.id)}
                            className="px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-bold hover:bg-indigo-600/40 transition-all"
                          >
                            Mark Implemented
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(idea.id)} // This will toggle back to Draft
                            className="p-2 text-white/10 hover:text-red-400 transition-colors"
                            title="Move back to Draft"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Implemented Ideas Section */}
          {implementedIdeas.length > 0 && (
            <section className="pt-8 border-t border-white/10 opacity-60">
              <h2 className="text-sm font-bold text-green-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <CheckCircle2 size={16} />
                Implemented Features
              </h2>
              <div className="flex flex-wrap gap-3">
                {implementedIdeas.map(idea => (
                  <div key={idea.id} className="bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full text-xs text-green-400 flex items-center gap-2">
                    <Check size={12} />
                    {idea.title}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-indigo-900/90 backdrop-blur-xl border border-indigo-400/30 rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-8 min-w-[300px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
                {selectedIds.length}
              </div>
              <span className="text-sm font-bold text-indigo-100">Selected</span>
            </div>

            <div className="h-8 w-px bg-white/10" />

            <div className="flex items-center gap-4">
              <button 
                onClick={handleCopyForAgent}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
              >
                {copySuccess ? <Check size={16} /> : <Copy size={16} />}
                {copySuccess ? 'Copied!' : 'Copy for Agent'}
              </button>

              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm font-bold transition-all border border-red-500/30"
              >
                <Trash2 size={16} />
                Delete
              </button>

              <button 
                onClick={() => setSelectedIds([])}
                className="p-2 text-white/40 hover:text-white transition-colors"
                title="Clear Selection"
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idea Details Modal */}
      <AnimatePresence>
        {expandedIdea && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-sky-900 border border-indigo-500/30 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-indigo-500/20 rounded border border-indigo-500/30 text-indigo-300">
                      {expandedIdea.category}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-white/5 rounded border border-white/10 text-white/40">
                      Impact: {expandedIdea.impact}/10
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold">{expandedIdea.title}</h2>
                </div>
                <button 
                  onClick={() => setExpandedIdea(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {isGeneratingDetails ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="animate-spin text-indigo-400" size={48} />
                    <p className="text-indigo-300 font-mono text-sm animate-pulse">Architecting Implementation Plan...</p>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none prose-headings:text-sky-400 prose-code:text-indigo-300 prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10">
                    <Markdown>{ideaDetails || "Failed to generate plan. Please try again."}</Markdown>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-white/10 bg-black/20 flex justify-between items-center gap-3">
                <button 
                  onClick={handleCopyDetails}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-sm font-bold transition-all border border-white/10"
                >
                  {copyDetailsSuccess ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  {copyDetailsSuccess ? 'Copied!' : 'Copy Plan'}
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setExpandedIdea(null)}
                    className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
                  >
                    Close
                  </button>
                  <button 
                    onClick={() => handleToggleStatus(expandedIdea.id)}
                    className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 transition-all"
                  >
                    {expandedIdea.status === 'Draft' ? 'Approve Idea' : expandedIdea.status === 'Approved' ? 'Mark Implemented' : 'Move to Draft'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Combined Plan Modal */}
      <AnimatePresence>
        {(combinedPlan || isGeneratingCombined) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 40 }}
              className="bg-slate-900 border border-indigo-500/40 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-white/10 flex justify-between items-center bg-indigo-950/30">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
                    <Sparkles className="text-white" size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Master Implementation Plan</h2>
                    <p className="text-indigo-300/60 text-xs font-mono uppercase tracking-widest">Unified Feature Architecture</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setCombinedPlan(null); setIsGeneratingCombined(false); }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={28} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-black/20">
                {isGeneratingCombined ? (
                  <div className="flex flex-col items-center justify-center py-32 space-y-6">
                    <div className="relative">
                      <Loader2 className="animate-spin text-indigo-500" size={64} />
                      <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-300 animate-pulse" size={24} />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-xl font-bold text-white">Synthesizing Master Plan...</p>
                      <p className="text-indigo-300/60 font-mono text-sm">Merging architectures and resolving dependencies</p>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none prose-headings:text-indigo-400 prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-2 prose-code:text-indigo-300 prose-pre:bg-black/60 prose-pre:border prose-pre:border-white/10 prose-strong:text-sky-300">
                    <Markdown>{combinedPlan}</Markdown>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-white/10 bg-black/40 flex justify-between items-center">
                <div className="text-sm text-white/40 font-mono">
                  {combinedPlan?.split('\n').length || 0} Lines of Architecture
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => { setCombinedPlan(null); setIsGeneratingCombined(false); }}
                    className="px-8 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all border border-white/10"
                  >
                    Close
                  </button>
                  <button 
                    onClick={handleCopyCombinedPlan}
                    disabled={!combinedPlan}
                    className="flex items-center gap-3 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-500/20 border border-indigo-400/30"
                  >
                    {copyDetailsSuccess ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
                    {copyDetailsSuccess ? 'Copied Master Plan' : 'Copy Master Plan'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default IdeaLab;
