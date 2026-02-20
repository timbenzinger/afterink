"use client";

import { useState, useCallback } from "react";
import { DisplacementConfig, DEFAULT_CONFIG } from "@/types/config";
import { useDisplacementEngine } from "@/lib/useDisplacementEngine";
import { exportWebm } from "@/lib/exportWebm";
import { exportPngSequence } from "@/lib/exportPngSequence";
import UploadPanel from "@/components/UploadPanel";
import ControlsPanel from "@/components/ControlsPanel";
import PreviewCanvas from "@/components/PreviewCanvas";
import ExportPanel from "@/components/ExportPanel";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  const [config, setConfig] = useState<DisplacementConfig>({
    ...DEFAULT_CONFIG,
  });
  const [hasImage, setHasImage] = useState(false);
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const engine = useDisplacementEngine();

  const handleImageLoaded = useCallback(
    (source: HTMLImageElement | HTMLCanvasElement) => {
      engine.loadImage(source);
      setHasImage(true);

      const w =
        source instanceof HTMLImageElement
          ? source.naturalWidth
          : source.width;
      const h =
        source instanceof HTMLImageElement
          ? source.naturalHeight
          : source.height;
      setImageSize({ width: w, height: h });
    },
    [engine]
  );

  const handleConfigChange = useCallback(
    (partial: Partial<DisplacementConfig>) => {
      setConfig((prev) => {
        const next = { ...prev, ...partial };
        engine.updateConfig(partial);
        return next;
      });
    },
    [engine]
  );

  const handleExportWebm = useCallback(async () => {
    if (!imageSize) return;
    const totalFrames = Math.round(config.loopDuration * config.fps);
    const frames = await engine.exportFrames(totalFrames);
    const blob = await exportWebm(
      frames,
      imageSize.width,
      imageSize.height,
      config.fps
    );
    download(blob, "afterink-export.webm");
  }, [engine, config, imageSize]);

  const handleExportPng = useCallback(async () => {
    const totalFrames = Math.round(config.loopDuration * config.fps);
    const frames = await engine.exportFrames(totalFrames);
    const blob = await exportPngSequence(frames);
    download(blob, "afterink-frames.zip");
  }, [engine, config]);

  return (
    <div className="flex h-screen bg-stone-100 dark:bg-zinc-900">
      {/* Sidebar */}
      <aside className="flex w-72 flex-shrink-0 flex-col gap-6 overflow-y-auto border-r border-stone-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-stone-900 dark:text-zinc-100">
            AfterInk
          </h1>
          <ThemeToggle />
        </div>

        <UploadPanel onImageLoaded={handleImageLoaded} />
        <ControlsPanel config={config} onChange={handleConfigChange} />
        <ExportPanel
          config={config}
          onExportWebm={handleExportWebm}
          onExportPng={handleExportPng}
          hasImage={hasImage}
        />

        {imageSize && (
          <div className="text-xs text-stone-400 dark:text-zinc-600">
            {imageSize.width} x {imageSize.height} px
          </div>
        )}
      </aside>

      {/* Canvas area */}
      <main className="flex-1">
        <PreviewCanvas
          canvasRef={engine.canvasRef}
          bgTransparent={config.bgTransparent}
          bgColor={config.bgColor}
        />
      </main>
    </div>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
