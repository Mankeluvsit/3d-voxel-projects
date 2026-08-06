import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { generateCityGoal, generateNewsEvent, generateFeatureDetails } from "./services/geminiService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/gemini/goal", async (req, res) => {
    try {
      console.log("Received goal request");
      const { stats, grid } = req.body;
      const goal = await generateCityGoal(stats, grid);
      res.json(goal);
    } catch (error) {
      console.error("Goal generation error:", error);
      res.status(500).json({ error: "Failed to generate goal" });
    }
  });

  app.post("/api/gemini/news", async (req, res) => {
    try {
      console.log("Received news request");
      const { stats, recentAction } = req.body;
      const news = await generateNewsEvent(stats, recentAction);
      res.json(news);
    } catch (error) {
      console.error("News generation error:", error);
      res.status(500).json({ error: "Failed to generate news" });
    }
  });

  app.post("/api/gemini/feature", async (req, res) => {
    try {
      console.log("Received feature co-creation request");
      const { ideas } = req.body;
      const result = await generateFeatureDetails(ideas);
      res.json({ result });
    } catch (error) {
      console.error("Feature API execution error:", error);
      res.status(500).json({ error: "Failed to co-create feature specifications" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
