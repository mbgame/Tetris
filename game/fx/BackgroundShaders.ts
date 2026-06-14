import type { SceneTheme } from "../levels/levels";

/**
 * Themed full-screen background fragment shaders, one per SceneTheme, animated by
 * uTime and dimmed by uDim (docs/03 §3). Each is intentionally cheap — it fills
 * the screen every frame. BackgroundScene renders them at a tier-scaled internal
 * resolution and upscales.
 *
 * Contract (verified against Phaser 4 Shader GameObject): `gl_FragCoord` is
 * available; uniforms uResolution (vec2), uTime (float, seconds), uDim (float).
 */
const HEADER = `
precision mediump float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uDim;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }
vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0,0.0,1.0); }
`;

/** Each body must define `vec3 scene(vec2 uv, float t)`. */
const BODIES: Record<SceneTheme, string> = {
  dawn: `vec3 scene(vec2 uv,float t){
    vec3 col=mix(vec3(0.95,0.55,0.45),vec3(0.25,0.35,0.6),uv.y);
    for(int i=0;i<5;i++){ float fi=float(i);
      vec2 c=vec2(fract(0.2*fi+0.03*t),0.4+0.5*sin(t*0.3+fi));
      col+=0.05*hue(0.08*fi)*smoothstep(0.12,0.0,distance(uv,c)); }
    return col; }`,
  neon: `vec3 scene(vec2 uv,float t){
    vec3 col=mix(vec3(0.02,0.0,0.08),vec3(0.1,0.0,0.2),uv.y);
    float g=abs(fract(uv.x*12.0)-0.5);
    float horizon=smoothstep(0.5,0.48,uv.y);
    col+=vec3(0.0,0.8,1.0)*smoothstep(0.04,0.0,g)*horizon*0.5;
    float lines=abs(fract((uv.y-0.03*t)*20.0)-0.5);
    col+=vec3(1.0,0.0,0.8)*smoothstep(0.03,0.0,lines)*(1.0-horizon)*0.3;
    return col; }`,
  crystal: `vec3 scene(vec2 uv,float t){
    vec2 p=uv*5.0; vec2 g=floor(p); float f=hash(g+floor(t*0.2));
    vec3 col=mix(vec3(0.1,0.2,0.3),vec3(0.4,0.6,0.8),f);
    col+=0.2*hue(f)*smoothstep(0.4,0.0,length(fract(p)-0.5));
    return col; }`,
  dunes: `vec3 scene(vec2 uv,float t){
    vec3 col=mix(vec3(0.85,0.6,0.3),vec3(0.4,0.25,0.4),uv.y);
    for(int i=0;i<4;i++){ float fi=float(i);
      float h=0.2+0.12*fi+0.04*sin(uv.x*4.0+fi+t*0.1);
      col=mix(col,vec3(0.6-0.1*fi,0.4-0.06*fi,0.25),smoothstep(h+0.01,h,uv.y)); }
    return col; }`,
  ocean: `vec3 scene(vec2 uv,float t){
    vec3 col=mix(vec3(0.0,0.15,0.3),vec3(0.0,0.05,0.15),uv.y);
    float c=sin(uv.x*18.0+t)*sin(uv.y*18.0-t*0.7);
    col+=vec3(0.2,0.5,0.7)*smoothstep(0.6,1.0,c)*0.4*(1.0-uv.y);
    return col; }`,
  forge: `vec3 scene(vec2 uv,float t){
    vec3 col=mix(vec3(0.5,0.1,0.0),vec3(0.05,0.0,0.0),uv.y);
    float e=fbm(uv*6.0+vec2(0.0,-t));
    col+=vec3(1.0,0.4,0.0)*smoothstep(0.6,0.9,e)*(1.0-uv.y);
    return col; }`,
  aurora: `vec3 scene(vec2 uv,float t){
    vec3 col=vec3(0.02,0.03,0.08);
    float band=sin(uv.x*3.0+t*0.5+fbm(uv*3.0+t*0.1)*3.0);
    float a=smoothstep(0.0,0.15,0.15-abs(uv.y-0.5-0.12*band));
    col+=mix(vec3(0.0,0.8,0.5),vec3(0.5,0.0,0.8),uv.x)*a;
    return col; }`,
  sky: `vec3 scene(vec2 uv,float t){
    vec3 col=mix(vec3(0.5,0.7,0.95),vec3(0.2,0.4,0.7),uv.y);
    float cl=fbm(uv*3.0+vec2(t*0.05,0.0));
    col=mix(col,vec3(1.0),smoothstep(0.55,0.8,cl)*0.6);
    return col; }`,
  void: `vec3 scene(vec2 uv,float t){
    vec3 col=vec3(0.02,0.0,0.05);
    col+=hue(0.7+0.1*sin(t*0.1))*fbm(uv*3.0+t*0.02)*0.3;
    vec2 g=floor(uv*60.0); float st=hash(g);
    col+=vec3(step(0.985,st))*(0.5+0.5*sin(t*2.0+st*20.0));
    return col; }`,
  prism: `vec3 scene(vec2 uv,float t){
    vec2 p=uv-0.5; float a=atan(p.y,p.x)+t*0.3;
    vec3 col=hue(a/6.2831+0.5)*0.5;
    col+=hue(length(p)*2.0-t*0.2)*0.4;
    return col*0.7; }`,
};

const FOOTER = `
void main(){
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 col = scene(uv, uTime);
  col *= (1.0 - uDim);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function fragForTheme(theme: SceneTheme): string {
  return HEADER + BODIES[theme] + FOOTER;
}
