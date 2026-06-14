// dissolve.frag — block → sand "crumble" (docs/03 §1a)
// Noise-threshold discard with a hot glowing edge band. uProgress is tweened
// 0→1 (~280 ms) per clearing block, with a slight left→right stagger.
//
// Reference GLSL for the GPU dissolve path (wired into the ultra PostFX in
// Phase 5). The DissolvePipeline currently drives an equivalent sub-tile crumble
// on the CPU so the effect runs identically across all quality tiers.
precision mediump float;

varying vec2 outTexCoord;
uniform sampler2D uMainSampler; // the white block texture (tinted via uColor)
uniform float uProgress;        // 0 = solid, 1 = fully dissolved
uniform float uEdgeWidth;       // glow band width, e.g. 0.08
uniform vec3  uEdgeColor;       // hot sand edge color
uniform vec3  uColor;           // block's palette color

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec4 tex = texture2D(uMainSampler, outTexCoord);
  float n = noise(outTexCoord * 18.0); // grain frequency
  if (n < uProgress) discard;          // already turned to sand
  float band = smoothstep(uProgress, uProgress + uEdgeWidth, n);
  vec3 col = mix(uEdgeColor, tex.rgb * uColor, band);
  gl_FragColor = vec4(col, tex.a);
}
