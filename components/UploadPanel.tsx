"use client";

import { useCallback, useRef, useState } from "react";
import { rasterizeSvg } from "@/lib/useDisplacementEngine";

interface UploadPanelProps {
  onImageLoaded: (
    source: HTMLImageElement | HTMLCanvasElement,
    name: string
  ) => void;
}

export default function UploadPanel({ onImageLoaded }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [svgScale, setSvgScale] = useState(2);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setFileName(file.name);

      try {
        if (file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
          const text = await file.text();
          const canvas = await rasterizeSvg(text, svgScale);
          onImageLoaded(canvas, file.name);
        } else {
          // PNG or other raster image
          const img = new Image();
          const url = URL.createObjectURL(file);
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = url;
          });
          URL.revokeObjectURL(url);
          onImageLoaded(img, file.name);
        }
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setLoading(false);
      }
    },
    [onImageLoaded, svgScale]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
        Upload
      </h3>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-lg border border-dashed border-stone-300 p-4 text-center text-sm text-stone-400 transition hover:border-indigo-400 hover:text-stone-600 dark:border-zinc-600 dark:text-zinc-500 dark:hover:border-indigo-500 dark:hover:text-zinc-300"
      >
        {loading
          ? "Loading..."
          : fileName
            ? fileName
            : "Drop PNG or SVG here, or click to browse"}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".png,.svg,image/png,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-zinc-500">
        <label htmlFor="svg-scale">SVG raster scale:</label>
        <select
          id="svg-scale"
          value={svgScale}
          onChange={(e) => setSvgScale(Number(e.target.value))}
          className="rounded bg-stone-200 px-2 py-1 text-stone-800 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={3}>3x</option>
          <option value={4}>4x</option>
        </select>
      </div>
    </div>
  );
}
