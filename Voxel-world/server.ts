import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as gemini from "./services/geminiService.js";
import * as openai from "./services/openaiService.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use process.env directly on the server
  const provider = process.env.VITE_AI_PROVIDER || process.env.AI_PROVIDER || "gemini";
  console.log(`Server initialized: using ${provider.toUpperCase()} as AI provider.`);

  let isRateLimited = false;
  let lastErrorTime = 0;
  let lastErrorMessage = "";
  const COOLDOWN_MS = 60000; // 1 minute global cooldown on errors

  const checkRateLimit = () => {
    if (isRateLimited && Date.now() - lastErrorTime > COOLDOWN_MS) {
      isRateLimited = false;
      lastErrorMessage = "";
    }
    return isRateLimited;
  };

  const handleAiError = (error: any) => {
    const errorMessage = error?.message || String(error);
    const isQuota = error?.status === 429 || errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED");
    
    if (isQuota) {
      isRateLimited = true;
      lastErrorTime = Date.now();
      lastErrorMessage = "Quota exceeded. Cooling down.";
      console.warn("Server AI Quota exceeded. Entering cooldown.");
    } else if (errorMessage.includes("API_KEY is not set") || errorMessage.includes("ApiKey is not set") || errorMessage.includes("not set")) {
      isRateLimited = true;
      lastErrorTime = Date.now();
      lastErrorMessage = "API Key missing.";
      console.error("Server AI Configuration Error: API Key is not set.");
    } else {
      console.error("Server AI Service Error:", error);
    }
  };

  app.use(express.json({ limit: "50mb" }));

  // Express API routes go here FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/ai/status", (req, res) => {
    const rateLimited = checkRateLimit();
    res.json({
      provider,
      isRateLimited: rateLimited,
      lastErrorMessage,
      cooldownRemaining: rateLimited ? Math.max(0, Math.round((COOLDOWN_MS - (Date.now() - lastErrorTime)) / 1000)) : 0
    });
  });

  app.post("/api/ai/goal", async (req, res) => {
    if (checkRateLimit()) {
      return res.status(429).json({ error: lastErrorMessage });
    }
    const { stats, grid } = req.body;
    try {
      let result;
      if (provider === "openai") {
        try {
          result = await openai.generateCityGoal(stats, grid);
          if (!result) {
            console.warn("OpenAI generateCityGoal returned null, falling back to Gemini.");
            result = await gemini.generateCityGoal(stats, grid);
          }
        } catch (openaiErr: any) {
          console.warn("OpenAI generateCityGoal failed, falling back to Gemini:", openaiErr?.message || openaiErr);
          result = await gemini.generateCityGoal(stats, grid);
        }
      } else {
        result = await gemini.generateCityGoal(stats, grid);
      }
      res.json({ result });
    } catch (e: any) {
      handleAiError(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ai/procedural-music", async (req, res) => {
    if (checkRateLimit()) {
      return res.status(429).json({ error: lastErrorMessage });
    }
    const { prompt } = req.body;
    try {
      let result;
      if (provider === "openai") {
        try {
          result = await openai.generateProceduralMusic(prompt);
          if (!result) {
            console.warn("OpenAI generateProceduralMusic returned null, falling back to Gemini.");
            result = await gemini.generateProceduralMusic(prompt);
          }
        } catch (openaiErr: any) {
          console.warn("OpenAI generateProceduralMusic failed, falling back to Gemini:", openaiErr?.message || openaiErr);
          result = await gemini.generateProceduralMusic(prompt);
        }
      } else {
        result = await gemini.generateProceduralMusic(prompt);
      }
      res.json({ result });
    } catch (e: any) {
      handleAiError(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ai/feature-ideas", async (req, res) => {
    if (checkRateLimit()) {
      return res.status(429).json({ error: lastErrorMessage });
    }
    const { prompt } = req.body;
    try {
      let result;
      if (provider === "openai") {
        try {
          result = await openai.generateFeatureIdeas(prompt);
          if (!result) {
            console.warn("OpenAI generateFeatureIdeas returned null, falling back to Gemini.");
            result = await gemini.generateFeatureIdeas(prompt);
          }
        } catch (openaiErr: any) {
          console.warn("OpenAI generateFeatureIdeas failed, falling back to Gemini:", openaiErr?.message || openaiErr);
          result = await gemini.generateFeatureIdeas(prompt);
        }
      } else {
        result = await gemini.generateFeatureIdeas(prompt);
      }
      res.json({ result });
    } catch (e: any) {
      handleAiError(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ai/idea-details", async (req, res) => {
    if (checkRateLimit()) {
      return res.status(429).json({ error: lastErrorMessage });
    }
    const { idea } = req.body;
    try {
      let result;
      if (provider === "openai") {
        try {
          result = await openai.generateIdeaDetails(idea);
          if (!result) {
            console.warn("OpenAI generateIdeaDetails returned null, falling back to Gemini.");
            result = await gemini.generateIdeaDetails(idea);
          }
        } catch (openaiErr: any) {
          console.warn("OpenAI generateIdeaDetails failed, falling back to Gemini:", openaiErr?.message || openaiErr);
          result = await gemini.generateIdeaDetails(idea);
        }
      } else {
        result = await gemini.generateIdeaDetails(idea);
      }
      res.json({ result });
    } catch (e: any) {
      handleAiError(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ai/optimal-layout", async (req, res) => {
    if (checkRateLimit()) {
      return res.status(429).json({ error: lastErrorMessage });
    }
    const { width, height } = req.body;
    try {
      let result;
      if (provider === "openai") {
        try {
          result = await openai.getOptimalLayout(width, height);
          if (!result || result.length === 0) {
            console.warn("OpenAI getOptimalLayout returned null/empty, falling back to Gemini.");
            result = await gemini.getOptimalLayout(width, height);
          }
        } catch (openaiErr: any) {
          console.warn("OpenAI getOptimalLayout failed, falling back to Gemini:", openaiErr?.message || openaiErr);
          result = await gemini.getOptimalLayout(width, height);
        }
      } else {
        result = await gemini.getOptimalLayout(width, height);
      }
      res.json({ result });
    } catch (e: any) {
      handleAiError(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ai/news-event", async (req, res) => {
    if (checkRateLimit()) {
      return res.status(429).json({ error: lastErrorMessage });
    }
    const { stats, recentAction } = req.body;
    try {
      let result;
      if (provider === "openai") {
        try {
          result = await openai.generateNewsEvent(stats, recentAction);
          if (!result) {
            console.warn("OpenAI generateNewsEvent returned null, falling back to Gemini.");
            result = await gemini.generateNewsEvent(stats, recentAction);
          }
        } catch (openaiErr: any) {
          console.warn("OpenAI generateNewsEvent failed, falling back to Gemini:", openaiErr?.message || openaiErr);
          result = await gemini.generateNewsEvent(stats, recentAction);
        }
      } else {
        result = await gemini.generateNewsEvent(stats, recentAction);
      }
      res.json({ result });
    } catch (e: any) {
      handleAiError(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ai/analyze-performance", async (req, res) => {
    if (checkRateLimit()) {
      return res.status(429).json({ error: lastErrorMessage });
    }
    const { stats, citySize } = req.body;
    try {
      let result;
      if (provider === "openai") {
        try {
          result = await openai.analyzePerformance(stats, citySize);
          if (!result) {
            console.warn("OpenAI analyzePerformance returned null, falling back to Gemini.");
            result = await gemini.analyzePerformance(stats, citySize);
          }
        } catch (openaiErr: any) {
          console.warn("OpenAI analyzePerformance failed, falling back to Gemini:", openaiErr?.message || openaiErr);
          result = await gemini.analyzePerformance(stats, citySize);
        }
      } else {
        result = await gemini.analyzePerformance(stats, citySize);
      }
      res.json({ result });
    } catch (e: any) {
      handleAiError(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ai/music", async (req, res) => {
    const { prompt, imageBase64 } = req.body;
    try {
      // gemini.generateMusic is a Gemini-specific feature (Lyria).
      const result = await gemini.generateMusic(prompt, imageBase64);
      res.json({ result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development / Single Page App loading
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
