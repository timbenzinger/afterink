"use client";

import { useState } from "react";
import type { DisplacementConfig } from "@/types/config";

interface ExportPanelProps {
  config: DisplacementConfig;
  onExportWebm: () => Promise<void>;
  onExportPng: () => Promise<void>;
  hasImage: boolean;
}

export default function ExportPanel({
  config,
  onExportWebm,
  onExportPng,
  hasImage,
}: ExportPanelProps) {
  const [exporting, setExporting] = useState<"webm" | "png" | null>(null);

  const totalFrames = Math.round(config.loopDuration * config.fps);

  const handleExport = async (type: "webm" | "png") => {
    setExporting(type);
    try {
      if (type === "webm") {
        await onExportWebm();
      } else {
        await onExportPng();
      }
    } catch (err) {
      console.error(`Export ${type} failed:`, err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
        Export
      </h3>

      <div className="text-xs text-stone-400 dark:text-zinc-500">
        {totalFrames} frames at {config.fps} fps ({config.loopDuration}s loop)
      </div>

      <button
        disabled={!hasImage || exporting !== null}
        onClick={() => handleExport("webm")}
        className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        {exporting === "webm" ? "Exporting WebM..." : "Export WebM (VP9 Alpha)"}
      </button>

      <button
        disabled={!hasImage || exporting !== null}
        onClick={() => handleExport("png")}
        className="w-full rounded bg-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-300 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
      >
        {exporting === "png" ? "Exporting PNGs..." : "Export PNG Sequence (ZIP)"}
      </button>
    </div>
  );
}
