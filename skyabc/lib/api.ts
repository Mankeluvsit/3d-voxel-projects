import { AIGoal, CityStats, Grid, NewsItem } from "../types";

export const fetchNewGoal = async (stats: CityStats, grid: Grid): Promise<AIGoal | null> => {
  const response = await fetch("/api/gemini/goal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stats, grid }),
  });
  if (!response.ok) return null;
  return await response.json();
};

export const fetchNewsEvent = async (stats: CityStats, recentAction: string | null): Promise<NewsItem | null> => {
  const response = await fetch("/api/gemini/news", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stats, recentAction }),
  });
  if (!response.ok) return null;
  return await response.json();
};
