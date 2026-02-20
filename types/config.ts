export interface DisplacementConfig {
  /** Displacement amount in pixels (0–12) */
  amountPx: number;
  /** Noise scale / feature size (2–80) */
  size: number;
  /** FBM octave count / complexity (1–6) */
  octaves: number;
  /** Animation speed / circular path radius (0–3) */
  speed: number;
  /** Noise seed offset */
  seed: number;
  /** Edge mask strength: 0 = uniform, 1 = edge-only (0–1) */
  edgeStrength: number;
  /** Alpha gradient threshold for edge detection (0–1) */
  edgeThreshold: number;
  /** Loop duration in seconds (2–6) */
  loopDuration: number;
  /** Frames per second (12 | 24 | 30) */
  fps: number;
  /** Whether background is transparent */
  bgTransparent: boolean;
  /** Background color hex (used when bgTransparent is false) */
  bgColor: string;
  /**
   * Posterize time: discretize animation into N steps per second.
   * 0 = smooth/off. 4–8 gives stop-motion / sketch jitter.
   * Equivalent to posterizeTime(N) in After Effects.
   */
  posterize: number;
}

export const DEFAULT_CONFIG: DisplacementConfig = {
  amountPx: 4,
  size: 20,
  octaves: 3,
  speed: 1,
  seed: 0,
  edgeStrength: 0,
  edgeThreshold: 0.1,
  loopDuration: 3,
  fps: 24,
  bgTransparent: true,
  bgColor: "#ffffff",
  posterize: 0,
};
