import { ResourceNode, CityStats, Grid, AIGoal, NewsItem, LODLevel, PerformanceStats } from "../types";

let cachedStatus = {
  provider: "gemini",
  isRateLimited: false,
  lastErrorMessage: "",
  cooldownRemaining: 0
};

const updateStatusFromBackend = async () => {
  try {
    const res = await fetch("/api/ai/status");
    if (res.ok) {
      cachedStatus = await res.json();
    }
  } catch (e) {
    // Silent fail if server is initializing or offline
  }
};

// Update status every 2 seconds to keep it sync with server state
updateStatusFromBackend();
setInterval(updateStatusFromBackend, 2000);

export const getAiStatus = () => cachedStatus;

export const generateCityGoal = async (stats: CityStats, grid: Grid): Promise<AIGoal | null> => {
  try {
    const res = await fetch("/api/ai/goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stats, grid }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.error("Client error generateCityGoal:", err);
    return null;
  }
};

export const generateProceduralMusic = async (prompt: string) => {
  try {
    const res = await fetch("/api/ai/procedural-music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.error("Client error generateProceduralMusic:", err);
    return null;
  }
};

export const generateFeatureIdeas = async (prompt: string) => {
  try {
    const res = await fetch("/api/ai/feature-ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.error("Client error generateFeatureIdeas:", err);
    return null;
  }
};

export const generateIdeaDetails = async (idea: any) => {
  try {
    const res = await fetch("/api/ai/idea-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.error("Client error generateIdeaDetails:", err);
    return null;
  }
};

export const getOptimalLayout = async (width: number, height: number): Promise<ResourceNode[]> => {
  try {
    const res = await fetch("/api/ai/optimal-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ width, height }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.result || [];
  } catch (err) {
    console.error("Client error getOptimalLayout:", err);
    return [];
  }
};

export const generateNewsEvent = async (stats: CityStats, recentAction: string | null): Promise<NewsItem | null> => {
  try {
    const res = await fetch("/api/ai/news-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stats, recentAction }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.error("Client error generateNewsEvent:", err);
    return null;
  }
};

export const analyzePerformance = async (stats: PerformanceStats, citySize: number) => {
  try {
    const res = await fetch("/api/ai/analyze-performance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stats, citySize }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.error("Client error analyzePerformance:", err);
    return null;
  }
};

export const generateMusic = async (prompt: string, imageBase64?: string): Promise<{url: string, lyrics: string} | null> => {
  try {
    const res = await fetch("/api/ai/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, imageBase64 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.result || !data.result.audioBase64) return null;

    const { audioBase64, mimeType, lyrics } = data.result;

    // Decode base64 audio into a playable Blob URL in browser
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);

    return { url, lyrics };
  } catch (err) {
    console.error("Client error generating music:", err);
    return null;
  }
};
