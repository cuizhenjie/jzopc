/**
 * 共享 GLSL 片段。
 * 语法按 three.js 默认 GLSL1 书写（attribute / varying / gl_FragColor）。
 * 若启用 glslVersion: THREE.GLSL3，需同步改为 in / out。
 */

/** 3D simplex noise（Ashima / Ian McEwan，MIT 许可，公共领域实现） */
export const simplex3d = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

/** 无散度 curl 场：让粒子沿旋涡流动，避免直冲 */
export const curlNoise = /* glsl */ `
vec3 curl(vec3 p, float t) {
  const float e = 0.12;
  float n1 = snoise(p + vec3(0.0, e, 0.0) + t);
  float n2 = snoise(p - vec3(0.0, e, 0.0) + t);
  float n3 = snoise(p + vec3(0.0, 0.0, e) + t);
  float n4 = snoise(p - vec3(0.0, 0.0, e) + t);
  float n5 = snoise(p + vec3(e, 0.0, 0.0) + t);
  float n6 = snoise(p - vec3(e, 0.0, 0.0) + t);

  float x = (n3 - n4) - (n1 - n2);
  float y = (n5 - n6) - (n3 - n4);
  float z = (n1 - n2) - (n5 - n6);

  return normalize(vec3(x, y, z) + 1e-5) * 0.5;
}
`;

/** 品牌色板：深藏蓝 → 主蓝 → 青绿 → 亮青 */
export const brandRamp = /* glsl */ `
vec3 brandRamp(float t) {
  vec3 c0 = vec3(0.078, 0.184, 0.349);  // #142F59
  vec3 c1 = vec3(0.114, 0.498, 0.729);  // #1D7FBA
  vec3 c2 = vec3(0.341, 0.714, 0.647);  // #57B6A5
  vec3 c3 = vec3(0.102, 0.659, 0.827);  // #1AA8D3
  t = clamp(t, 0.0, 1.0);
  if (t < 0.333) return mix(c0, c1, t / 0.333);
  if (t < 0.666) return mix(c1, c2, (t - 0.333) / 0.333);
  return mix(c2, c3, (t - 0.666) / 0.334);
}
`;
