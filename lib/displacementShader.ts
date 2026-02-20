/**
 * Turbulent Displacement Shader
 *
 * Applies animated FBM (Fractional Brownian Motion) noise-based displacement
 * to an input texture with alpha-aware edge masking.
 *
 * Seamless looping is achieved by driving the noise offset with a circular
 * path in 2D: uTimeVec = (cos(2*PI*t), sin(2*PI*t)), where t cycles 0→1
 * over one loop period. Because the noise function is continuous and the
 * offset traces a closed circle, the start and end frames match perfectly.
 *
 * Uniforms:
 *   uSampler        – input texture (auto-set by PixiJS)
 *   uResolution     – texture size in pixels
 *   uTimeVec        – vec2(cos(2πt), sin(2πt)) for seamless loop
 *   uAmountPx       – displacement magnitude in pixels
 *   uSize           – noise spatial scale (higher = larger features)
 *   uOctaves        – FBM octave count (1–6), controls detail
 *   uSpeed          – radius of the circular time path
 *   uSeed           – noise coordinate offset for variation
 *   uEdgeStrength   – 0 = displace everywhere, 1 = edges only
 *   uEdgeThreshold  – alpha gradient cutoff for edge detection
 */

export const fragmentShader = `
precision highp float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;

uniform vec2  uResolution;
uniform vec2  uTimeVec;
uniform float uAmountPx;
uniform float uSize;
uniform float uOctaves;
uniform float uSpeed;
uniform float uSeed;
uniform float uEdgeStrength;
uniform float uEdgeThreshold;

// ─── Simplex 2D noise (Ashima Arts / Stefan Gustavson) ───────────────

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
    const vec4 C = vec4(
        0.211324865405187,   // (3 - sqrt(3)) / 6
        0.366025403784439,   // 0.5 * (sqrt(3) - 1)
       -0.577350269189626,   // -1 + 2 * C.x
        0.024390243902439    // 1 / 41
    );

    // First corner
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);

    // Other corners
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;

    // Permutations
    i = mod289(i);
    vec3 p = permute(
        permute(i.y + vec3(0.0, i1.y, 1.0))
              + i.x + vec3(0.0, i1.x, 1.0)
    );

    vec3 m = max(0.5 - vec3(
        dot(x0, x0),
        dot(x12.xy, x12.xy),
        dot(x12.zw, x12.zw)
    ), 0.0);
    m = m * m;
    m = m * m;

    vec3 x  = 2.0 * fract(p * C.www) - 1.0;
    vec3 h  = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;

    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

    vec3 g;
    g.x  = a0.x * x0.x  + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;

    return 130.0 * dot(m, g);
}

// ─── FBM (Fractional Brownian Motion) ────────────────────────────────
// Sums multiple octaves of noise at increasing frequency / decreasing amplitude.
// The loop cap of 8 satisfies WebGL 1 constant-bound requirements;
// uOctaves (passed as float) controls the effective octave count.

float fbm(vec2 p) {
    float value     = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    int   octaves   = int(uOctaves);

    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        value     += amplitude * snoise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}

// ─── Main ────────────────────────────────────────────────────────────

void main() {
    vec2 uv = vTextureCoord;
    vec2 pixelSize = 1.0 / uResolution;

    // Circular time offset for seamless looping.
    // uTimeVec already contains (cos(2πt), sin(2πt)),
    // multiplied by uSpeed to control the "orbit radius" in noise space.
    vec2 circularTime = uTimeVec * uSpeed;

    // Noise sample coordinates: map UV to pixel space scaled by uSize,
    // offset by seed and animated by circular time.
    vec2 noiseCoord = uv * uResolution / uSize + circularTime + uSeed;

    // Two independent FBM samples for X and Y displacement.
    // The vec2(43.0, 17.0) offset decorrelates the two channels.
    float noiseX = fbm(noiseCoord);
    float noiseY = fbm(noiseCoord + vec2(43.0, 17.0));

    // Convert displacement from pixel units to UV-space.
    vec2 displacement = vec2(noiseX, noiseY) * uAmountPx * pixelSize;

    // ── Edge mask via alpha gradient ─────────────────────────────────
    // Sample the alpha channel in 4 cardinal directions to approximate
    // the spatial gradient of alpha. High gradient = near a transparency edge.
    float aL = texture2D(uSampler, uv + vec2(-pixelSize.x, 0.0)).a;
    float aR = texture2D(uSampler, uv + vec2( pixelSize.x, 0.0)).a;
    float aU = texture2D(uSampler, uv + vec2(0.0, -pixelSize.y)).a;
    float aD = texture2D(uSampler, uv + vec2(0.0,  pixelSize.y)).a;

    float gradient = length(vec2(aR - aL, aD - aU));
    float edgeMask = smoothstep(uEdgeThreshold, uEdgeThreshold + 0.15, gradient);

    // Mix between full displacement (1.0) and edge-only (edgeMask)
    // based on uEdgeStrength.
    displacement *= mix(1.0, edgeMask, uEdgeStrength);

    // Sample texture at displaced UV, preserving original alpha.
    vec4 color = texture2D(uSampler, uv + displacement);

    gl_FragColor = color;
}
`;

export const vertexShader: string | undefined = undefined; // use PixiJS default
