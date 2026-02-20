"use client";

import { useRef, useEffect, useCallback } from "react";
import type { DisplacementConfig } from "@/types/config";
import { DEFAULT_CONFIG } from "@/types/config";
import { fragmentShader } from "./displacementShader";

export interface DisplacementEngine {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  loadImage: (source: HTMLImageElement | HTMLCanvasElement) => void;
  updateConfig: (config: Partial<DisplacementConfig>) => void;
  exportFrames: (totalFrames: number) => Promise<Blob[]>;
  destroy: () => void;
}

interface PixiRefs {
  app: import("pixi.js").Application | null;
  filter: import("pixi.js").Filter | null;
  sprite: import("pixi.js").Sprite | null;
  PIXI: typeof import("pixi.js") | null;
}

/**
 * Rasterize an SVG string to a canvas at the given scale multiplier.
 */
export async function rasterizeSvg(
  svgText: string,
  scale: number = 1
): Promise<HTMLCanvasElement> {
  const img = new Image();
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load SVG"));
    img.src = url;
  });

  URL.revokeObjectURL(url);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth * scale;
  canvas.height = img.naturalHeight * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas;
}

export function useDisplacementEngine(): DisplacementEngine {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixiRef = useRef<PixiRefs>({
    app: null,
    filter: null,
    sprite: null,
    PIXI: null,
  });
  const configRef = useRef<DisplacementConfig>({ ...DEFAULT_CONFIG });
  const startTimeRef = useRef<number>(0);
  const destroyedRef = useRef(false);

  // Initialize PixiJS application
  useEffect(() => {
    if (!canvasRef.current) return;
    destroyedRef.current = false;

    let cancelled = false;

    async function init() {
      const PIXI = await import("pixi.js");
      if (cancelled || destroyedRef.current) return;

      const canvas = canvasRef.current!;
      const app = new PIXI.Application({
        view: canvas,
        width: canvas.width || 800,
        height: canvas.height || 600,
        backgroundAlpha: 0,
        preserveDrawingBuffer: true,
        antialias: false,
        backgroundColor: 0x000000,
        // Pin to 1 — avoids canvas.width being doubled on retina displays,
        // which would break the display sizing calculation in PreviewCanvas.
        resolution: 1,
      });

      pixiRef.current.app = app;
      pixiRef.current.PIXI = PIXI;
      startTimeRef.current = performance.now();

      // Live animation: update uTimeVec each tick
      app.ticker.add(() => {
        const filter = pixiRef.current.filter;
        const config = configRef.current;
        if (!filter) return;

        const elapsed = (performance.now() - startTimeRef.current) / 1000;
        let t = (elapsed / config.loopDuration) % 1;

        // Posterize: snap t to discrete steps → stop-motion / sketch feel.
        // Equivalent to posterizeTime(N) in After Effects.
        // At 0, disabled (smooth). At 4–8, produces visible hold-then-snap jitter.
        if (config.posterize > 0) {
          const stepsPerLoop = config.posterize * config.loopDuration;
          t = Math.floor(t * stepsPerLoop) / stepsPerLoop;
        }

        const angle = t * Math.PI * 2;
        filter.uniforms.uTimeVec = [Math.cos(angle), Math.sin(angle)];
      });
    }

    init();

    return () => {
      cancelled = true;
      if (pixiRef.current.app) {
        pixiRef.current.app.destroy(true, { children: true });
        pixiRef.current.app = null;
        pixiRef.current.filter = null;
        pixiRef.current.sprite = null;
      }
    };
  }, []);

  const loadImage = useCallback(
    (source: HTMLImageElement | HTMLCanvasElement) => {
      const { app, PIXI } = pixiRef.current;
      if (!app || !PIXI) return;

      // Remove existing sprite
      if (pixiRef.current.sprite) {
        app.stage.removeChild(pixiRef.current.sprite);
        pixiRef.current.sprite.destroy();
        pixiRef.current.sprite = null;
      }

      // Get source dimensions
      const w =
        source instanceof HTMLImageElement
          ? source.naturalWidth
          : source.width;
      const h =
        source instanceof HTMLImageElement
          ? source.naturalHeight
          : source.height;

      // Resize the renderer to match the image
      app.renderer.resize(w, h);

      // Create texture from source
      const texture = PIXI.Texture.from(source);
      const sprite = new PIXI.Sprite(texture);

      // Create the displacement filter
      const config = configRef.current;
      const filter = new PIXI.Filter(undefined, fragmentShader, {
        uResolution: [w, h],
        uTimeVec: [1.0, 0.0],
        uAmountPx: config.amountPx,
        uSize: config.size,
        uOctaves: config.octaves,
        uSpeed: config.speed,
        uSeed: config.seed,
        uEdgeStrength: config.edgeStrength,
        uEdgeThreshold: config.edgeThreshold,
      });

      // The filter needs padding so displaced pixels at the edges render
      filter.padding = Math.ceil(config.amountPx) + 2;

      sprite.filters = [filter];
      app.stage.addChild(sprite);

      pixiRef.current.sprite = sprite;
      pixiRef.current.filter = filter;

      // Update background
      updateBackground(app, config);
    },
    []
  );

  const updateConfig = useCallback((partial: Partial<DisplacementConfig>) => {
    configRef.current = { ...configRef.current, ...partial };
    const config = configRef.current;
    const { filter, app } = pixiRef.current;

    if (filter) {
      filter.uniforms.uAmountPx = config.amountPx;
      filter.uniforms.uSize = config.size;
      filter.uniforms.uOctaves = config.octaves;
      filter.uniforms.uSpeed = config.speed;
      filter.uniforms.uSeed = config.seed;
      filter.uniforms.uEdgeStrength = config.edgeStrength;
      filter.uniforms.uEdgeThreshold = config.edgeThreshold;
      filter.padding = Math.ceil(config.amountPx) + 2;
    }

    if (app) {
      updateBackground(app, config);
    }
  }, []);

  /**
   * Deterministic offline render loop.
   * Stops the live ticker, renders each frame with manually computed uTimeVec,
   * extracts pixels via canvas.toBlob(), then restarts the ticker.
   */
  const exportFrames = useCallback(
    async (totalFrames: number): Promise<Blob[]> => {
      const { app, filter } = pixiRef.current;
      if (!app || !filter) throw new Error("Engine not initialized");

      // Pause live animation
      app.ticker.stop();

      const blobs: Blob[] = [];
      const canvas = app.view as HTMLCanvasElement;

      const config = configRef.current;

      for (let i = 0; i < totalFrames; i++) {
        // Deterministic time: t goes from 0 to just-below 1
        let t = i / totalFrames;

        // Mirror the posterize quantization so the export matches the live preview
        if (config.posterize > 0) {
          const stepsPerLoop = config.posterize * config.loopDuration;
          t = Math.floor(t * stepsPerLoop) / stepsPerLoop;
        }

        const angle = t * Math.PI * 2;
        filter.uniforms.uTimeVec = [Math.cos(angle), Math.sin(angle)];

        // Force render this frame
        app.renderer.render(app.stage);

        // Extract frame as PNG blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
            "image/png"
          );
        });

        blobs.push(blob);
      }

      // Resume live animation
      app.ticker.start();
      startTimeRef.current = performance.now();

      return blobs;
    },
    []
  );

  const destroy = useCallback(() => {
    destroyedRef.current = true;
    if (pixiRef.current.app) {
      pixiRef.current.app.destroy(true, { children: true });
      pixiRef.current.app = null;
      pixiRef.current.filter = null;
      pixiRef.current.sprite = null;
    }
  }, []);

  return { canvasRef, loadImage, updateConfig, exportFrames, destroy };
}

function updateBackground(
  app: import("pixi.js").Application,
  config: DisplacementConfig
) {
  if (config.bgTransparent) {
    app.renderer.background.alpha = 0;
  } else {
    app.renderer.background.alpha = 1;
    app.renderer.background.color = parseInt(
      config.bgColor.replace("#", ""),
      16
    );
  }
}
