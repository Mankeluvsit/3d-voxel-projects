/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Send, Loader2, Play, Pause, Download, Image as ImageIcon, X, Key, Sparkles } from 'lucide-react';
import { generateMusic, generateProceduralMusic } from '../services/aiService';
import { MusicTrack, MusicComposition } from '../types';
import * as Tone from 'tone';

interface MusicLabProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackGenerated: (track: MusicTrack) => void;
  tracks: MusicTrack[];
}

const MusicLab: React.FC<MusicLabProps> = ({ isOpen, onClose, onTrackGenerated, tracks }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [generationMode, setGenerationMode] = useState<'lyria' | 'procedural'>('procedural');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthRef = useRef<any>(null);
  const partRef = useRef<any>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
        if (selected) setGenerationMode('lyria');
      }
    };
    if (isOpen) checkKey();
  }, [isOpen]);

  const handleConnectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
      setGenerationMode('lyria');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const stopAllPlayback = () => {
    audioRef.current?.pause();
    if (partRef.current) {
      partRef.current.stop();
      Tone.getTransport().stop();
    }
    setPlayingTrackId(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    stopAllPlayback();

    if (generationMode === 'lyria') {
      const cleanBase64 = imageBase64?.split(',')[1];
      const result = await generateMusic(prompt, cleanBase64);
      if (result) {
        const newTrack: MusicTrack = {
          id: Date.now().toString(),
          url: result.url,
          prompt: prompt,
          lyrics: result.lyrics,
          timestamp: Date.now(),
          type: 'lyria'
        };
        onTrackGenerated(newTrack);
        setPrompt('');
        setImageBase64(null);
      }
    } else {
      const composition = await generateProceduralMusic(prompt);
      if (composition) {
        const newTrack: MusicTrack = {
          id: Date.now().toString(),
          composition,
          prompt: prompt,
          timestamp: Date.now(),
          type: 'procedural'
        };
        onTrackGenerated(newTrack);
        setPrompt('');
      }
    }
    setIsGenerating(false);
  };

  const playProcedural = async (composition: MusicComposition) => {
    await Tone.start();
    
    // Cleanup old synth
    if (synthRef.current) synthRef.current.dispose();
    if (partRef.current) partRef.current.dispose();

    // Create synth based on type
    let synth;
    switch (composition.synthType) {
      case 'amsynth': synth = new Tone.AMSynth().toDestination(); break;
      case 'fmsynth': synth = new Tone.FMSynth().toDestination(); break;
      case 'duosynth': synth = new Tone.DuoSynth().toDestination(); break;
      case 'plucksynth': synth = new Tone.PluckSynth().toDestination(); break;
      default: synth = new Tone.Synth().toDestination();
    }
    synthRef.current = synth;

    Tone.getTransport().bpm.value = composition.tempo;

    const part = new Tone.Part((time, value) => {
      synth.triggerAttackRelease(value.note, value.duration, time);
    }, composition.notes).start(0);
    
    part.loop = true;
    part.loopEnd = "4m";
    partRef.current = part;

    Tone.getTransport().start();
  };

  const togglePlay = async (track: MusicTrack) => {
    if (playingTrackId === track.id) {
      stopAllPlayback();
    } else {
      stopAllPlayback();
      if (track.type === 'lyria' && track.url) {
        if (audioRef.current) {
          audioRef.current.src = track.url;
          audioRef.current.play();
          setPlayingTrackId(track.id);
        }
      } else if (track.type === 'procedural' && track.composition) {
        await playProcedural(track.composition);
        setPlayingTrackId(track.id);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-gray-900 border border-indigo-500/30 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="bg-indigo-600 p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Music className="text-white" size={24} />
                <h2 className="text-white font-bold text-xl tracking-tight">AI Music Lab</h2>
              </div>
              <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Mode Selection */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-800 rounded-xl border border-gray-700">
                <button
                  onClick={() => setGenerationMode('procedural')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${generationMode === 'procedural' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  <Sparkles size={14} />
                  Synth Composer (Free)
                </button>
                <button
                  onClick={() => setGenerationMode('lyria')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${generationMode === 'lyria' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  <Music size={14} />
                  Lyria Audio (Key Req.)
                </button>
              </div>

              {/* API Key Warning for Lyria */}
              {generationMode === 'lyria' && hasApiKey === false && (
                <div className="bg-amber-900/40 border border-amber-500/50 rounded-xl p-4 flex flex-col md:flex-row items-center gap-4">
                  <div className="bg-amber-500/20 p-2 rounded-lg">
                    <Key className="text-amber-400" size={24} />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <p className="text-amber-200 text-sm font-medium">API Key Required</p>
                    <p className="text-amber-200/70 text-xs">Lyria music models require a user-provided API key from a paid project.</p>
                  </div>
                  <button 
                    onClick={handleConnectKey}
                    className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-2 px-4 rounded-lg text-xs transition-colors whitespace-nowrap"
                  >
                    Connect Key
                  </button>
                </div>
              )}

              {/* Generator Section */}
              <div className="space-y-4">
                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={generationMode === 'lyria' ? "Describe the vibe (e.g., 'A futuristic synthwave track')" : "Describe the melody (e.g., 'A happy upbeat piano loop in C major')"}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none h-24 transition-all"
                  />
                  
                  {/* Image Preview (Only for Lyria) */}
                  {generationMode === 'lyria' && imageBase64 && (
                    <div className="absolute bottom-3 right-3 group">
                      <img src={imageBase64} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-indigo-500 shadow-lg" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => setImageBase64(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  {generationMode === 'lyria' && (
                    <label className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 px-4 rounded-xl border border-gray-700 cursor-pointer transition-all">
                      <ImageIcon size={20} />
                      <span>{imageBase64 ? 'Change' : 'Add Image'}</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                  
                  <button
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || isGenerating || (generationMode === 'lyria' && !hasApiKey)}
                    className="flex-[2] bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        <span>{generationMode === 'lyria' ? 'Composing...' : 'Writing Score...'}</span>
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        <span>{generationMode === 'lyria' ? 'Generate Soundtrack' : 'Compose Loop'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Tracks List */}
              <div className="space-y-4">
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                  Your Studio Tracks
                </h3>
                
                {tracks.length === 0 ? (
                  <div className="text-center py-12 bg-gray-800/50 rounded-2xl border border-dashed border-gray-700">
                    <Music className="mx-auto text-gray-600 mb-2" size={32} />
                    <p className="text-gray-500 text-sm italic">No tracks generated yet. Start composing!</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {tracks.map((track) => (
                      <div key={track.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-4 group hover:border-indigo-500/50 transition-all">
                        <button 
                          onClick={() => togglePlay(track)}
                          className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform"
                        >
                          {playingTrackId === track.id ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium text-sm truncate">{track.prompt}</p>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${track.type === 'lyria' ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50' : 'bg-cyan-900/50 text-cyan-300 border border-cyan-700/50'}`}>
                              {track.type}
                            </span>
                          </div>
                          <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">
                            {new Date(track.timestamp).toLocaleTimeString()}
                          </p>
                        </div>

                        {track.type === 'lyria' && track.url && (
                          <a 
                            href={track.url} 
                            download={`city-track-${track.id}.wav`}
                            className="p-2 text-gray-400 hover:text-white transition-colors"
                          >
                            <Download size={20} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <audio 
              ref={audioRef} 
              onEnded={() => setPlayingTrackId(null)}
              className="hidden"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MusicLab;
