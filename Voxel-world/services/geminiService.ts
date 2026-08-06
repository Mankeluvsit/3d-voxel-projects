/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AIGoal, BuildingType, CityStats, Grid, NewsItem, MusicComposition, Idea, ResourceNode, PerformanceStats, LODLevel } from "../types";
import { BUILDINGS } from "../constants";

const modelId = 'gemini-3.5-flash';

// --- Helper for Retries ---

const callWithRetry = async <T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> => {
  let delay = 3000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED');
      if (isRateLimit && i < maxRetries - 1) {
        console.warn(`Rate limit hit (attempt ${i+1}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
};

// --- Goal Generation ---

// @google/genai-schema-fix: The `Schema` type is not exported from @google/genai. Use a const object for the schema.
const goalSchema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.STRING,
      description: "A short, creative description of the goal from the perspective of city council or citizens.",
    },
    targetType: {
      type: Type.STRING,
      enum: ['population', 'money', 'building_count'],
      description: "The metric to track.",
    },
    targetValue: {
      type: Type.INTEGER,
      description: "The target numeric value to reach.",
    },
    buildingType: {
      type: Type.STRING,
      enum: [BuildingType.Residential, BuildingType.Commercial, BuildingType.Industrial, BuildingType.Park, BuildingType.Road],
      description: "Required if targetType is building_count.",
    },
    reward: {
      type: Type.INTEGER,
      description: "Monetary reward for completion.",
    },
  },
  required: ['description', 'targetType', 'targetValue', 'reward'],
};

export const generateCityGoal = async (stats: CityStats, grid: Grid): Promise<AIGoal | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  // @google/genai-api-key-fix: The API key must be obtained exclusively from the environment variable `process.env.GEMINI_API_KEY`.

  // Count buildings
  const counts: Record<string, number> = {};
  grid.flat().forEach(tile => {
    counts[tile.buildingType] = (counts[tile.buildingType] || 0) + 1;
  });

  const context = `
    Current City Stats:
    Day: ${stats.day}
    Money: $${stats.money}
    Population: ${stats.population}
    Buildings: ${JSON.stringify(counts)}
    Building Costs/Stats: ${JSON.stringify(
      Object.values(BUILDINGS).filter(b => b.type !== BuildingType.None).map(b => ({type: b.type, cost: b.cost, pop: b.popGen, income: b.incomeGen}))
    )}
  `;

  const prompt = `You are the AI City Advisor for a simulation game. Based on the current city stats, generate a challenging but achievable short-term goal for the player to help the city grow. Return JSON.`;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: modelId,
      // @google/genai-generate-content-fix: For text-only prompts, `contents` should be a single string.
      contents: `${context}\n${prompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: goalSchema,
        temperature: 0.7,
      },
    }));

    // @google/genai-response-text-fix: Access the `text` property directly from the response.
    if (response.text) {
      const goalData = JSON.parse(response.text) as Omit<AIGoal, 'completed'>;
      return { ...goalData, completed: false };
    }
  } catch (error) {
    console.error("Error generating goal:", error);
  }
  return null;
};

// --- Music Generation ---

export const generateMusic = async (prompt: string, imageBase64?: string): Promise<{audioBase64: string, mimeType: string, lyrics: string} | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  try {
    const contents = imageBase64 
      ? { parts: [{ text: prompt }, { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }] }
      : prompt;

    const response = await ai.models.generateContentStream({
      model: "lyria-3-clip-preview",
      contents,
      config: {
        // @google/genai-modality-fix: Use Modality.AUDIO for music generation.
        responseModalities: [Modality.AUDIO],
      }
    });

    let audioBase64 = "";
    let lyrics = "";
    let mimeType = "audio/wav";

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
        if (part.text && !lyrics) {
          lyrics = part.text;
        }
      }
    }

    if (!audioBase64) return null;

    return { audioBase64, mimeType, lyrics };
  } catch (error) {
    console.error("Error generating music:", error);
    return null;
  }
};

// --- Procedural Music Generation (No User Key Required) ---

const musicCompositionSchema = {
  type: Type.OBJECT,
  properties: {
    tempo: { type: Type.INTEGER, description: "BPM of the track" },
    scale: { type: Type.STRING, description: "Musical scale (e.g. C major)" },
    synthType: { 
      type: Type.STRING, 
      enum: ['amsynth', 'fmsynth', 'duosynth', 'plucksynth'],
      description: "The type of synthesizer to use"
    },
    notes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: { type: Type.STRING, description: "Timing in bars:beats:sixteenths (e.g. 0:0:0)" },
          note: { type: Type.STRING, description: "Musical note (e.g. C4, Eb3)" },
          duration: { type: Type.STRING, description: "Duration (e.g. 4n, 8n, 16n)" }
        },
        required: ['time', 'note', 'duration']
      }
    }
  },
  required: ['tempo', 'scale', 'synthType', 'notes']
};

export const generateProceduralMusic = async (prompt: string): Promise<MusicComposition | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  
  const systemInstruction = `
    You are a professional music composer. 
    Generate a short 4-bar musical loop in JSON format based on the user's description.
    Use Tone.js compatible timing (bars:beats:sixteenths).
    Keep it melodic and thematic for a city building game.
  `;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: musicCompositionSchema,
      }
    }));

    if (response.text) {
      return JSON.parse(response.text) as MusicComposition;
    }
  } catch (error) {
    console.error("Error generating procedural music:", error);
  }
  return null;
};

// --- Idea Generation ---

const ideaSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    category: { 
      type: Type.STRING, 
      enum: ['Gameplay', 'AI', 'Visuals', 'Economics', 'Social', 'Other'] 
    },
    impact: { type: Type.INTEGER, description: "1-10 impact score" },
    difficulty: { 
      type: Type.STRING, 
      enum: ['Easy', 'Medium', 'Hard'] 
    }
  },
  required: ['title', 'description', 'category', 'impact', 'difficulty']
};

export const generateFeatureIdeas = async (prompt: string): Promise<Partial<Idea> | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  
  const systemInstruction = `
    You are a Senior Game Designer and Product Manager for "Sky Metropolis", an isometric 3D city builder.
    Generate a creative, innovative, and feasible feature idea based on the user's request.
    The idea should fit the current tech stack (React, Three.js, Gemini AI).
  `;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: ideaSchema,
      }
    }));

    if (response.text) {
      return JSON.parse(response.text);
    }
  } catch (error) {
    console.error("Error generating feature ideas:", error);
  }
  return null;
};

export const generateIdeaDetails = async (idea: Idea): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  
  const prompt = `
    Provide a detailed implementation plan for the following feature idea in "Sky Metropolis":
    Title: ${idea.title}
    Category: ${idea.category}
    Description: ${idea.description}
    Impact: ${idea.impact}/10
    Difficulty: ${idea.difficulty}

    Include:
    1. Technical approach (React/Three.js/Gemini)
    2. Key components or services needed
    3. Potential challenges
    4. A "Quick Start" code snippet or pseudo-code.
    
    Format as clean Markdown.
  `;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    }));

    return response.text || null;
  } catch (error) {
    console.error("Error generating idea details:", error);
    return null;
  }
};

// --- Terrain Generation ---

const layoutSchema = {
  type: Type.OBJECT,
  properties: {
    resources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.INTEGER },
          y: { type: Type.INTEGER },
          type: { type: Type.STRING, enum: ['Energy', 'Water', 'Mineral'] }
        },
        required: ['x', 'y', 'type']
      }
    }
  },
  required: ['resources']
};

export const getOptimalLayout = async (width: number, height: number): Promise<ResourceNode[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  const prompt = `Act as a game designer. For a ${width}x${height} grid, suggest 5-8 resource nodes (x, y) of types 'Energy', 'Water', or 'Mineral'. Format as JSON. Ensure coordinates are within 0 to ${width-1} and 0 to ${height-1}.`;
  
  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: layoutSchema,
      }
    }));

    if (response.text) {
      const data = JSON.parse(response.text);
      return data.resources;
    }
  } catch (error) {
    console.error("Error generating layout:", error);
  }
  return [];
};

// --- News Feed Generation ---

// @google/genai-schema-fix: The `Schema` type is not exported from @google/genai. Use a const object for the schema.
const newsSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "A one-sentence news headline representing life in the city." },
    type: { type: Type.STRING, enum: ['positive', 'negative', 'neutral'] },
  },
  required: ['text', 'type'],
};

export const generateNewsEvent = async (stats: CityStats, recentAction: string | null): Promise<NewsItem | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  // @google/genai-api-key-fix: The API key must be obtained exclusively from the environment variable `process.env.GEMINI_API_KEY`.

  const context = `City Stats - Pop: ${stats.population}, Money: ${stats.money}, Day: ${stats.day}. ${recentAction ? `Recent Action: ${recentAction}` : ''}`;
  const prompt = "Generate a very short, isometric-sim-city style news headline based on the city state. Can be funny, cynical, or celebratory.";

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: modelId,
      // @google/genai-generate-content-fix: For text-only prompts, `contents` should be a single string.
      contents: `${context}\n${prompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: newsSchema,
        temperature: 1.1, // High temp for variety
      },
    }));

    // @google/genai-response-text-fix: Access the `text` property directly from the response.
    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        id: Date.now().toString() + Math.random(),
        text: data.text,
        type: data.type,
      };
    }
  } catch (error) {
    console.error("Error generating news:", error);
  }
  return null;
};

// --- Performance & LOD Analysis ---

const performanceSchema = {
  type: Type.OBJECT,
  properties: {
    recommendedLOD: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
    optimizationReason: { type: Type.STRING },
    targetFPS: { type: Type.INTEGER },
    predictedGrowthFactor: { type: Type.NUMBER }
  },
  required: ['recommendedLOD', 'optimizationReason', 'targetFPS', 'predictedGrowthFactor']
};

let lastRateLimitTime = 0;
const RATE_LIMIT_COOLDOWN = 60000; // 1 minute cooldown

export const analyzePerformance = async (stats: PerformanceStats, citySize: number): Promise<{ recommendedLOD: LODLevel, reason: string, predictedGrowthFactor: number } | null> => {
  if (Date.now() - lastRateLimitTime < RATE_LIMIT_COOLDOWN) {
    return null; // Still in cooldown
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  
  const prompt = `
    Act as a Graphics Performance Engineer for a Three.js city builder.
    Current Stats:
    - FPS: ${stats.fps}
    - Draw Calls: ${stats.drawCalls}
    - Triangles: ${stats.triangles}
    - City Size: ${citySize}x${citySize}
    - Current LOD: ${stats.lodLevel}

    Analyze if we should adjust the Level of Detail (LOD) to maintain 60FPS.
    Also predict a 'predictedGrowthFactor' (1.0 to 2.0) representing how much city complexity is expected to grow in the next 5 minutes, which will be used for memory pre-allocation.
    Return JSON with recommendedLOD, optimizationReason, targetFPS, and predictedGrowthFactor.
  `;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: performanceSchema,
      }
    }));

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        recommendedLOD: data.recommendedLOD as LODLevel,
        reason: data.optimizationReason,
        predictedGrowthFactor: data.predictedGrowthFactor || 1.2
      };
    }
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED');
    if (isRateLimit) {
      lastRateLimitTime = Date.now();
      console.warn("Performance analysis rate limited. Cooling down for 1 minute.");
    } else {
      console.error("Error analyzing performance:", error);
    }
  }
  return null;
};
