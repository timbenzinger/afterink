Build a Chrome-only internal web tool using Next.js (App Router) + TypeScript + PixiJS.

Goal:
Upload PNG or SVG and apply an animated Turbulent Displace-like effect with alpha support. Export seamless loop as WebM (VP9 alpha) or PNG sequence.

Requirements:

1) File Support:
- Accept PNG and SVG.
- SVG must be rasterized to canvas at selectable resolution before creating a WebGL texture.

2) Rendering:
- Use PixiJS.
- Implement custom fragment shader for animated FBM displacement.
- Uniforms:
  - uAmountPx
  - uSize
  - uOctaves
  - uSpeed
  - uSeed
  - uEdgeStrength
  - uEdgeThreshold
  - uTimeVec
- Implement seamless looping:
  t = frameIndex / totalFrames
  uTimeVec = vec2(cos(2πt), sin(2πt))

3) Edge Mask:
- Compute alpha gradient in shader.
- Use smoothstep(edgeThreshold, ...) to build mask.
- Multiply displacement by mix(1.0, edge, edgeStrength).

4) Background:
- Support transparent background OR solid color.
- If transparent, preserve alpha in output.

5) Export:
- Primary: WebM via MediaRecorder with mimeType "video/webm;codecs=vp9".
- Fallback: PNG sequence zipped using fflate.
- Render frames deterministically for export.

6) UI:
- Sliders for all displacement parameters.
- Loop length + FPS control.
- Real-time preview.
- Clean component architecture.

Deliver:
- Fully runnable Next.js project.
- Documented shader.
- Deterministic export logic.Additional constraints:
- Pin PixiJS to v7 (not v8).
- Use fflate (not JSZip) for PNG sequence export.
- Export must use a deterministic offline render loop:
  step frameIndex from 0 to totalFrames-1, manually set uTimeVec each frame,
  call renderer.render(), then extract pixels via canvas.toBlob() or getImageData().
  Do not rely on canvas.captureStream() for frame-accurate export.
- Add uResolution and uSeed to all shader uniform declarations.
- Wrap PixiJS app in a useDisplacementEngine hook that returns
  { canvasRef, updateConfig, exportFrames, destroy }.