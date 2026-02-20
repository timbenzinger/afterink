# AfterInk

A Chrome-only browser tool for applying animated turbulent displacement to PNG and SVG assets. Exports seamless-looping WebM (VP9 alpha) or PNG sequences.

---

## Quick start

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # production build
```

---

## Project structure

```
app/
  layout.tsx              Root layout + metadata
  page.tsx                Main page — wires engine hook to UI components
  globals.css             Tailwind + range slider overrides

components/
  UploadPanel.tsx         Drag-and-drop PNG/SVG ingestion + SVG raster scale
  ControlsPanel.tsx       All displacement sliders + loop + background controls
  PreviewCanvas.tsx       Checkerboard-backed canvas, auto-fits to window
  ExportPanel.tsx         Export buttons + frame count readout

lib/
  useDisplacementEngine.ts   Core PixiJS v7 hook — the engine
  displacementShader.ts      Documented GLSL fragment shader
  exportWebm.ts              MediaRecorder/VP9 export
  exportPngSequence.ts       fflate ZIP export

types/
  config.ts               DisplacementConfig interface + defaults
```

---

## How the engine works

### `useDisplacementEngine` hook

The single source of truth for rendering. Returns:


| Member                  | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| `canvasRef`             | Attach to `<canvas>` — PixiJS renders into it                |
| `loadImage(source)`     | Load a PNG `<img>` or rasterized SVG `<canvas>` as a texture |
| `updateConfig(partial)` | Push uniform changes to the GPU without re-creating anything |
| `exportFrames(n)`       | Deterministic offline render — returns `n` PNG `Blob`s       |
| `destroy()`             | Tear down the PixiJS app                                     |


**Initialization** is deferred to a `useEffect` with a dynamic `import('pixi.js')` so PixiJS never runs during SSR.

**Live animation loop** — PixiJS `ticker` runs at the display refresh rate. Each tick:

1. Computes elapsed time → `t ∈ [0, 1)` over the loop duration
2. Optionally quantizes `t` (posterize, see below)
3. Sets `uTimeVec = [cos(2πt), sin(2πt)]` on the filter
4. PixiJS calls `renderer.render()` automatically

**Deterministic export loop** — `exportFrames` stops the ticker, manually steps `i` from `0` to `totalFrames - 1`, computes `t = i / totalFrames` (with posterize applied), sets `uTimeVec`, calls `renderer.render()`, then calls `canvas.toBlob()` to extract each PNG. The ticker is restarted after all frames are captured.

---

## The displacement shader

`lib/displacementShader.ts` contains a single WebGL 1 fragment shader.

### Noise stack

```
snoise(v)        2D simplex noise, range ≈ [-1, 1]
  └── fbm(p)     Fractional Brownian Motion — sums N octaves of snoise
                 at doubling frequency and halving amplitude
```

`fbm` is called twice with a spatial offset of `vec2(43, 17)` to produce decorrelated X and Y displacement values.

### Seamless looping

The time input is a 2D unit vector that traces a circle:

```
uTimeVec = (cos(2πt), sin(2πt))
```

This vector is added to the noise coordinate (scaled by `uSpeed`). Because the path is a closed circle in 2D noise space, `t=0` and `t=1` land on exactly the same noise coordinate — the loop is mathematically gapless.

The alternative (a sawtooth `t` directly) would require the noise field to repeat, which creates a visible hard cut at the loop point.

### Edge mask

The shader approximates the spatial gradient of the image's alpha channel by sampling in four cardinal directions and computing the gradient magnitude:

```glsl
float gradient = length(vec2(aR - aL, aD - aU));
float edgeMask  = smoothstep(uEdgeThreshold, uEdgeThreshold + 0.15, gradient);
```

`edgeMask` is 1.0 near transparency boundaries and 0.0 inside fully opaque or fully transparent regions.

Final displacement is then:

```glsl
displacement *= mix(1.0, edgeMask, uEdgeStrength);
```

- `uEdgeStrength = 0` → full displacement everywhere (ignore edges)
- `uEdgeStrength = 1` → displacement only at alpha boundaries

### Uniforms reference


| Uniform          | Type        | Description                                       |
| ---------------- | ----------- | ------------------------------------------------- |
| `uSampler`       | `sampler2D` | Input texture (set automatically by PixiJS)       |
| `uResolution`    | `vec2`      | Texture dimensions in pixels                      |
| `uTimeVec`       | `vec2`      | `(cos(2πt), sin(2πt))` — drives the seamless loop |
| `uAmountPx`      | `float`     | Displacement magnitude in pixels                  |
| `uSize`          | `float`     | Noise spatial scale — larger = bigger features    |
| `uOctaves`       | `float`     | Number of FBM octaves (cast to `int` in shader)   |
| `uSpeed`         | `float`     | Radius of the circular time path in noise space   |
| `uSeed`          | `float`     | Offset added to noise coordinates for variation   |
| `uEdgeStrength`  | `float`     | 0 = uniform, 1 = edge-only                        |
| `uEdgeThreshold` | `float`     | Alpha gradient cutoff for edge detection          |


---

## Controls reference

### Displacement


| Control        | Range   | Effect                                                     |
| -------------- | ------- | ---------------------------------------------------------- |
| Amount (px)    | 0 – 12  | How far pixels are pushed in screen space                  |
| Size           | 2 – 80  | Feature size of the noise pattern                          |
| Complexity     | 1 – 6   | FBM octave count — more octaves = more detail              |
| Speed          | 0 – 3   | Orbit radius in noise space; larger = more motion per loop |
| Seed           | 0 – 100 | Shifts the noise field to a different starting position    |
| Edge Strength  | 0 – 1   | Concentrates displacement toward alpha edges               |
| Edge Threshold | 0 – 1   | Alpha gradient sensitivity for edge detection              |


### Loop


| Control       | Description                                          |
| ------------- | ---------------------------------------------------- |
| Duration (s)  | Total loop length in seconds (2 – 6)                 |
| Export FPS    | Frame rate written to the export file (4 – 30)       |
| **Posterize** | Steps per second for quantized animation (see below) |


### Background

Toggle between transparent (preserves alpha in WebM) and a solid color. When a solid color is set, the renderer clears to that color before drawing.

---

## Posterize — stop-motion / sketch feel

Posterize quantizes the animation time to `N` discrete states per second, equivalent to After Effects' `posterizeTime(N)`.

```
t = floor(t × N × duration) / (N × duration)
```

Each state is held until the next snap. At `4–8 fps`, this produces the jittery, hand-drawn illustration feel. At `0`, the animation is smooth.

This also eliminates perceived easing. Easing appears in continuous mode because the FBM gradient varies spatially — some sections of the circular time path produce faster-changing displacement than others. Posterize replaces that smooth variation with hard jumps, so rate-of-change is irrelevant.

The same quantization is applied inside `exportFrames`, so exported files always match the live preview exactly.

---

## SVG input

SVGs are not passed directly to WebGL. The pipeline is:

1. Read the SVG file as text
2. Render it into an offscreen `<canvas>` via a `<img>` element at a chosen scale (1×–4×)
3. Pass the canvas to `loadImage()` as a normal raster source
4. PixiJS creates a WebGL texture from it

Choose a higher scale before loading if your SVG has fine detail that would be lost at native resolution.

---

## Export

### WebM (VP9 alpha)

1. `exportFrames()` renders all `N` frames deterministically and returns PNG blobs
2. Each blob is drawn to a 2D canvas via `createImageBitmap`
3. `canvas.captureStream(0)` gives a stream with manual frame control
4. `track.requestFrame()` pushes each frame to the `MediaRecorder`
5. `MediaRecorder` encodes with `video/webm;codecs=vp9`

VP9 in Chrome preserves the alpha channel. Use a transparent background and the exported video will composite correctly over anything in your NLE or browser.

### PNG sequence (ZIP)

1. `exportFrames()` renders all `N` frames, each as a PNG blob
2. `fflate.zipSync()` packs them into a ZIP at compression level 0 (store-only, since PNGs are already compressed)
3. Files are named `frame_0000.png`, `frame_0001.png`, …

Use this for import into After Effects, Premiere, DaVinci Resolve, or any tool that accepts image sequences.

---

## Dependencies


| Package       | Version | Role                                 |
| ------------- | ------- | ------------------------------------ |
| `pixi.js`     | `^7.4`  | WebGL renderer + filter system       |
| `fflate`      | `^0.8`  | ZIP encoding for PNG sequence export |
| `next`        | `^14.2` | App framework (App Router)           |
| `tailwindcss` | `^3.4`  | UI styling                           |


PixiJS is pinned to v7. v8 has a different filter API and is not compatible with the current shader setup without changes.