import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const GameView = lazy(() => import("@/components/GameView"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Voxel City — Isometric 3D City Builder" },
      {
        name: "description",
        content:
          "Build a retro voxel metropolis: generate terrain, lay roads, zone districts and watch traffic and population grow in a 3D isometric world.",
      },
      { property: "og:title", content: "Voxel City — Isometric 3D City Builder" },
      {
        property: "og:description",
        content:
          "Generate terrain, lay roads, zone districts and watch traffic and population grow in a retro voxel 3D world.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Loading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-panel-deep">
      <p className="text-display animate-pulse text-xs text-primary">LOADING VOXEL CITY…</p>
    </div>
  );
}

function Index() {
  return (
    <ClientOnly fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <GameView />
      </Suspense>
    </ClientOnly>
  );
}
