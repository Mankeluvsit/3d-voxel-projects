/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";
import { AIGoal, BuildingType, CityStats, Grid, NewsItem } from "../types";
import { BUILDINGS } from "../constants";

let ai: GoogleGenAI | null = null;
function getAI() {
  if (!ai) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing API Key");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

const modelId = 'gemini-3.5-flash';

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
    const response = await getAI().models.generateContent({
      model: modelId,
      contents: `${context}\n${prompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: goalSchema,
        temperature: 0.7,
      },
    });

    if (response.text) {
      const goalData = JSON.parse(response.text) as Omit<AIGoal, 'completed'>;
      return { ...goalData, completed: false };
    }
  } catch (error) {
    console.error("Error generating goal:", error);
  }
  return null;
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
  // @google/genai-api-key-fix: The API key must be obtained exclusively from the environment variable `process.env.API_KEY`. Do not add checks for its existence.

  const context = `City Stats - Pop: ${stats.population}, Money: ${stats.money}, Day: ${stats.day}. ${recentAction ? `Recent Action: ${recentAction}` : ''}`;
  const prompt = "Generate a very short, isometric-sim-city style news headline based on the city state. Can be funny, cynical, or celebratory.";

  try {
    const response = await getAI().models.generateContent({
      model: modelId,
      contents: `${context}\n${prompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: newsSchema,
        temperature: 1.1, // High temp for variety
      },
    });

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

export const generateFeatureDetails = async (ideas: { text: string; category: string }[]): Promise<string> => {
  const context = `Features to co-create and synthesize:\n${ideas.map((i, idx) => `${idx + 1}. [${i.category}] ${i.text}`).join('\n')}`;
  const prompt = `You are a visionary Lead AI Game Designer.
The team is developing SkyMetropolis: a stylish 3D procedural isometric town builder.
The player has selected these new gameplay feature concepts from the Lab incubator:

${context}

Synthesize these features into a highly cohesive, polished, professional GDD (Game Design Document) and implementation proposal. Keep it highly readable and visually attractive.
Provide a beautiful Markdown document structured as follows:

## 🎴 SYNTHESIZED MECHANIC: [Invent a creative combined name]
A stylish, cinematic description of how this co-created feature fits into the city simulation as an advanced, high-tech, or ecological grid enhancement.

### 🎮 Gameplay & Economic Integration
- **Grid Interactions**: Specifically how this affects nearby Residential, Commercial, and Industrial zones.
- **Resource Flow**: Efficiency coefficients, daily treasury impacts, operating costs, power generation, or transit bonuses.
- **Dynamic Milestones**: Any unlock parameters or levels required.

### 🎨 Isometric 3D Visual Specification
- **Mesh Geometries**: Core volumetric primitives (extrusions, lattices, rotary fans).
- **Aesthetic Direction**: Color palette, roughness, metallic accents, and particle glow suggestions.
- **Micro-Animations**: Rotation rates, bouncing indicators, or hovering feedback to display activity.

### 📢 Advisory News Feed Interventions
Give 3 cool ticker messages that would stream in the advisor's log once active (including Positive, Negative, and Neutral variants).

Keep the tone expert, clean, professional, and full of design passion. No preamble.`;

  try {
    const response = await getAI().models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        temperature: 0.85,
      },
    });
    return response.text || "Connection completed, but no design details were returned.";
  } catch (error) {
    console.error("Error generating feature specs:", error);
    return "Error: Neural net synthesis failed. Please ensure your Gemini API key is valid.";
  }
};