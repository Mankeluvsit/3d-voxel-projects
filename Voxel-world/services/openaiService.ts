import OpenAI from "openai";
import { AIGoal, BuildingType, CityStats, Grid, NewsItem, MusicComposition, Idea, ResourceNode, PerformanceStats, LODLevel } from "../types";
import { BUILDINGS } from "../constants";

const modelId = "gpt-4o-mini"; // or "gpt-4o"

const getOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
};

// --- Helper for Retries ---
const callWithRetry = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let delay = 2000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error?.status === 429 && i < maxRetries - 1) {
        console.warn(`OpenAI Rate limit hit (attempt ${i + 1}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
};

export const generateCityGoal = async (stats: CityStats, grid: Grid): Promise<AIGoal | null> => {
  console.log("OpenAI: Generating city goal...");
  try {
    const openai = getOpenAI();
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
    `;

    const response = await callWithRetry(() => openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: "system", content: "You are the AI City Advisor for a simulation game. Generate a challenging but achievable short-term goal for the player. Return JSON." },
        { role: "user", content: context }
      ],
      response_format: { type: "json_object" }
    }));

    const content = response.choices[0].message.content;
    if (content) {
      const goalData = JSON.parse(content);
      return { ...goalData, completed: false };
    }
  } catch (error) {
    console.error("Error generating goal with OpenAI:", error);
    throw error;
  }
};

export const generateProceduralMusic = async (prompt: string): Promise<MusicComposition | null> => {
  try {
    const openai = getOpenAI();
    const response = await callWithRetry(() => openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: "system", content: "You are a professional music composer. Generate a short 4-bar musical loop in JSON format based on the user's description. Use Tone.js compatible timing (bars:beats:sixteenths)." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    }));

    const content = response.choices[0].message.content;
    if (content) {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("Error generating procedural music with OpenAI:", error);
    throw error;
  }
};

export const generateFeatureIdeas = async (prompt: string): Promise<Partial<Idea> | null> => {
  try {
    const openai = getOpenAI();
    const response = await callWithRetry(() => openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: "system", content: "You are a Senior Game Designer for 'Sky Metropolis'. Generate a creative feature idea in JSON format." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    }));

    const content = response.choices[0].message.content;
    if (content) {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("Error generating feature ideas with OpenAI:", error);
    throw error;
  }
};

export const generateIdeaDetails = async (idea: Idea): Promise<string | null> => {
  try {
    const openai = getOpenAI();
    const prompt = `Provide a detailed implementation plan for: ${idea.title}. Description: ${idea.description}. Format as Markdown.`;
    const response = await callWithRetry(() => openai.chat.completions.create({
      model: modelId,
      messages: [{ role: "user", content: prompt }]
    }));

    return response.choices[0].message.content || null;
  } catch (error) {
    console.error("Error generating idea details with OpenAI:", error);
    throw error;
  }
};

export const getOptimalLayout = async (width: number, height: number): Promise<ResourceNode[]> => {
  try {
    const openai = getOpenAI();
    const prompt = `Suggest 5-8 resource nodes for a ${width}x${height} grid. Return JSON with a 'resources' array of {x, y, type}.`;
    const response = await callWithRetry(() => openai.chat.completions.create({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    }));

    const content = response.choices[0].message.content;
    if (content) {
      return JSON.parse(content).resources;
    }
  } catch (error) {
    console.error("Error generating layout with OpenAI:", error);
    throw error;
  }
};

export const generateNewsEvent = async (stats: CityStats, recentAction: string | null): Promise<NewsItem | null> => {
  try {
    const openai = getOpenAI();
    const context = `Stats: Pop ${stats.population}, Money ${stats.money}. Action: ${recentAction}`;
    const response = await callWithRetry(() => openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: "system", content: "Generate a short, funny city news headline in JSON format with 'text' and 'type' (positive/negative/neutral)." },
        { role: "user", content: context }
      ],
      response_format: { type: "json_object" }
    }));

    const content = response.choices[0].message.content;
    if (content) {
      const data = JSON.parse(content);
      return {
        id: Date.now().toString() + Math.random(),
        text: data.text,
        type: data.type,
      };
    }
  } catch (error) {
    console.error("Error generating news with OpenAI:", error);
    throw error;
  }
};

let lastRateLimitTime = 0;
const RATE_LIMIT_COOLDOWN = 60000;

export const analyzePerformance = async (stats: PerformanceStats, citySize: number): Promise<{ recommendedLOD: LODLevel, reason: string, predictedGrowthFactor: number } | null> => {
  if (Date.now() - lastRateLimitTime < RATE_LIMIT_COOLDOWN) return null;

  try {
    const openai = getOpenAI();
    const prompt = `Analyze performance for a Three.js city builder. Stats: FPS ${stats.fps}, Draw Calls ${stats.drawCalls}, Triangles ${stats.triangles}. Return JSON with recommendedLOD (High/Medium/Low), optimizationReason, and predictedGrowthFactor (1.0-2.0).`;
    
    const response = await callWithRetry(() => openai.chat.completions.create({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    }));

    const content = response.choices[0].message.content;
    if (content) {
      const data = JSON.parse(content);
      return {
        recommendedLOD: data.recommendedLOD as LODLevel,
        reason: data.optimizationReason,
        predictedGrowthFactor: data.predictedGrowthFactor || 1.2
      };
    }
  } catch (error: any) {
    if (error?.status === 429) {
      lastRateLimitTime = Date.now();
    }
    console.error("Error analyzing performance with OpenAI:", error);
    throw error;
  }
};
