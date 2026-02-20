"use client";

import { useEffect, useRef, useState } from "react";

interface PreviewCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  bgTransparent: boolean;
  bgColor: string;
}

type CanvasRefCallback = (el: HTMLCanvasElement | null) => void;

const ZOOM_LEVELS = [25, 50, 75, 100] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export default function PreviewCanvas({
  canvasRef,
  bgTransparent,
  bgColor,
}: PreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomLevel | null>(null);
  const [hovered, setHovered] = useState(false);

  // Re-runs when zoom changes so updateSize closes over the correct value.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    function updateSize() {
      const cw = container!.clientWidth;
      const ch = container!.clientHeight;
      const aw = canvas!.width;
      const ah = canvas!.height;
      if (aw === 0 || ah === 0) return;

      let w: number, h: number;
      if (zoom !== null) {
        w = aw * (zoom / 100);
        h = ah * (zoom / 100);
      } else {
        const scale = Math.min(cw / aw, ch / ah, 1);
        w = aw * scale;
        h = ah * scale;
      }
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
    }

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    const mutationObserver = new MutationObserver(updateSize);
    mutationObserver.observe(canvas, {
      attributes: true,
      attributeFilter: ["width", "height"],
    });

    updateSize();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [canvasRef, zoom]);

  const backgroundStyle = bgTransparent
    ? {
        backgroundImage:
          "repeating-conic-gradient(var(--checker-a) 0% 25%, var(--checker-b) 0% 50%)",
        backgroundSize: "20px 20px",
      }
    : { backgroundColor: bgColor };

  return (
    <div className="relative h-full w-full">
      {/* Scrollable canvas area. The inner flex div uses min-h/w-full so the
          canvas is centered when smaller than the viewport, while the outer
          overflow-auto lets it scroll when larger (e.g. at 100% zoom). */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-auto"
        style={backgroundStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex min-h-full min-w-full items-center justify-center">
          <div className="relative">
            <canvas
              ref={
                ((el: HTMLCanvasElement | null) => {
                  (
                    canvasRef as React.MutableRefObject<HTMLCanvasElement | null>
                  ).current = el;
                }) as CanvasRefCallback
              }
              width={800}
              height={600}
              className="block"
            />
            {hovered && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  outline: "1px solid rgba(255,255,255,0.6)",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Zoom controls – absolutely positioned over the scroll area so they
          don't scroll with the canvas. */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
        <div className="pointer-events-auto flex divide-x divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white/80 shadow-sm backdrop-blur-sm dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/80">
          {ZOOM_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setZoom(zoom === level ? null : level)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                zoom === level
                  ? "bg-stone-100 text-stone-900 dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-stone-400 hover:text-stone-700 dark:text-zinc-500 dark:hover:text-zinc-200"
              }`}
            >
              {level}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
