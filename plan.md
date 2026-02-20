# High-Level Architecture

You are building:

> A browser-based Turbulent Displace engine
> supporting PNG + SVG input
> exporting alpha WebM or PNG sequences
> with optional background compositing

Core components:

1. File ingestion (PNG + SVG)
2. Rendering pipeline (WebGL + shader)
3. Displacement engine (fractal noise + edge mask)
4. Export engine (WebM alpha + PNG ZIP)
5. Optional background compositor

---

# Important Design Decision (Vector Support)

SVGs do **not** go directly into WebGL as vectors.

Instead:

1. Parse SVG
2. Render it to a high-resolution canvas
3. Convert to texture
4. Feed texture into same displacement shader

This keeps the pipeline unified.

You are not animating vectors.
You are rasterizing vectors first.

That keeps everything simple.

---

# Updated Feature Plan (With Vector + Background)

## Upload Support

### Accept:

* `.png`
* `.svg`

### Pipeline:

* If PNG → load as texture
* If SVG → render to offscreen canvas at chosen resolution → convert to texture

Resolution control:

* Base resolution selector:

  * 1x
  * 2x
  * Custom width/height

---

# Rendering Engine

Use:

* PixiJS (recommended)
* Custom fragment shader

Scene graph:

```
Root
 ├── Background Layer (optional solid color)
 └── Displaced Sprite Layer
```

Background is rendered first if defined.

If background is transparent:

* clearColor = (0,0,0,0)

If background color selected:

* clearColor = chosen color
* disable alpha export (optional toggle)

---

# Shader Plan (Final Version)

Uniforms:

```
uTexture
uResolution
uTimeVec (vec2)
uAmountPx
uSize
uOctaves
uSpeed
uSeed
uEdgeStrength
uEdgeThreshold
uUseEdgeMask (bool)
```

Flow:

1. Compute UV
2. Compute FBM noise (octaves controlled by uOctaves)
3. Compute alpha gradient (edge mask)
4. Compute displacement vector
5. Apply edge scaling
6. Sample texture
7. Output RGBA (preserve alpha)

Looping via:

```
t = frameIndex / totalFrames
uTimeVec = vec2(cos(2πt), sin(2πt))
```

This guarantees seamless loop.

---

# Export Modes

Since you're Chrome-only, we can simplify.

## Mode 1 — WebM with Alpha (Primary)

Use:

```
canvas.captureStream(fps)
MediaRecorder({ mimeType: "video/webm;codecs=vp9" })
```

Important:

* WebGL canvas must preserve alpha
* Don’t composite background if alpha export desired
* Chrome supports alpha in VP9

---

## Mode 2 — PNG Sequence ZIP (Fallback + Production Safe)

Process:

* Render each frame to offscreen canvas
* Extract RGBA pixels
* Encode PNG
* Zip with fflate
* Download

This is your guaranteed production path.

---

# Background Color Handling

UI toggle:

```
[ ] Transparent background
[ ] Solid background color: #FFFFFF
```

If solid selected:

* Shader unchanged
* Renderer clears with background color
* Alpha output disabled (or optional)
* WebM exported without alpha

If transparent selected:

* Clear to (0,0,0,0)
* WebM alpha enabled

---

# UI Controls (Final Spec)

### File Section

* Upload PNG / SVG
* Resolution selector (for SVG)
* Fit to view

### Turbulent Controls

* Amount (0–12 px)
* Size (2–80)
* Complexity (1–6 octaves)
* Speed (0–3)
* Seed
* Edge-only (toggle)
* Edge Strength (0–1)
* Edge Threshold (0–1)

### Loop Controls

* Loop Length (2–6s)
* FPS (12/24/30)

### Background

* Transparent (default)
* Solid color picker

### Export

* Export WebM (alpha if transparent)
* Export PNG sequence
* Show estimated file size

---

# Project Structure (Next.js App Router)

```
/app
  /page.tsx
/components
  UploadPanel.tsx
  ControlsPanel.tsx
  PreviewCanvas.tsx
  ExportPanel.tsx
/lib
  createPixiApp.ts
  displacementShader.ts
  noise.ts
  exportWebm.ts
  exportPngSequence.ts
/types
  config.ts
```