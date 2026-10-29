// PixelForge WebGL 2 GLSL shaders (upgraded with Sobel-Edge, Hybrid Edge-Medoid, Kuwahara Cartoon Brush, and 1px Ink Outlines).

export const COMMON = /* glsl */`
uniform sampler2D u_palette;
uniform int u_count;
uniform int u_distance;

ivec2 topDown() { return ivec2(int(gl_FragCoord.x), int(u_resolution.y) - 1 - int(gl_FragCoord.y)); }
vec4 at(sampler2D t, ivec2 p) { ivec2 s = textureSize(t, 0); p = clamp(p, ivec2(0), s - 1); return texelFetch(t, ivec2(p.x, s.y - 1 - p.y), 0); }
bool inside(ivec2 p) { return p.x >= 0 && p.y >= 0 && p.x < int(u_resolution.x) && p.y < int(u_resolution.y); }
vec3 palColor(int i) { return texelFetch(u_palette, ivec2(i, 0), 0).rgb; }

float linear1(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
vec3 oklab(vec3 c) {
  c = vec3(linear1(c.r), linear1(c.g), linear1(c.b));
  float l = pow(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, 1.0 / 3.0);
  float m = pow(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, 1.0 / 3.0);
  float s = pow(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b, 1.0 / 3.0);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
              1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
              0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 space(vec3 c) { return u_distance == 1 ? c : oklab(c); }
int nearestIndex(vec3 c) {
  vec3 p = space(c);
  vec3 w = u_distance == 1 ? vec3(0.299, 0.587, 0.114) : vec3(1.0, 1.15, 1.15);
  int best = 0; float bd = 1e20;
  for (int i = 0; i < 256; i++) {
    if (i >= u_count) break;
    vec3 d = p - space(palColor(i));
    float dist = dot(w * d, w * d);
    if (dist < bd) { bd = dist; best = i; }
  }
  return best;
}
int colorKey(vec4 c) {
  if (c.a < 0.5) return -1;
  ivec3 b = ivec3(floor(c.rgb * 255.0 + 0.5));
  return b.r * 65536 + b.g * 256 + b.b;
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
`;

/** Resample (0=box, 1=nearest, 2=sobel, 3=hybrid) + optional Kuwahara + adjust + alpha cut. */
export const PREP = /* glsl */`
uniform int u_resample;
uniform int u_kuwahara;
uniform vec4 u_adjust;
uniform float u_hue;
uniform float u_alphaCut;
uniform ivec4 u_crop;

vec4 sampleSrc(ivec2 pos) {
  if (u_kuwahara <= 0) return at(iChannel0, pos);
  vec4 center = at(iChannel0, pos);
  if (center.a <= 0.0) return center;
  float bestVar = 1e18;
  vec3 bestCol = center.rgb;
  int rad = min(4, u_kuwahara);
  for (int qy = 0; qy < 2; qy++) {
    for (int qx = 0; qx < 2; qx++) {
      vec3 sumC = vec3(0.0);
      float sumL = 0.0, sumL2 = 0.0, cnt = 0.0;
      for (int dy = 0; dy <= 4; dy++) {
        if (dy > rad) break;
        int yy = pos.y + (qy == 0 ? -dy : dy);
        for (int dx = 0; dx <= 4; dx++) {
          if (dx > rad) break;
          int xx = pos.x + (qx == 0 ? -dx : dx);
          vec4 sc = at(iChannel0, ivec2(xx, yy));
          float l = luma(sc.rgb);
          sumC += sc.rgb; sumL += l; sumL2 += l * l; cnt += 1.0;
        }
      }
      float ml = sumL / cnt;
      float v = (sumL2 / cnt) - ml * ml;
      if (v < bestVar) { bestVar = v; bestCol = sumC / cnt; }
    }
  }
  return vec4(bestCol, center.a);
}

float sobelAt(ivec2 p) {
  float lmm = luma(at(iChannel0, p + ivec2(-1, -1)).rgb);
  float lm0 = luma(at(iChannel0, p + ivec2( 0, -1)).rgb);
  float lmp = luma(at(iChannel0, p + ivec2( 1, -1)).rgb);
  float l0m = luma(at(iChannel0, p + ivec2(-1,  0)).rgb);
  float l0p = luma(at(iChannel0, p + ivec2( 1,  0)).rgb);
  float lpm = luma(at(iChannel0, p + ivec2(-1,  1)).rgb);
  float lp0 = luma(at(iChannel0, p + ivec2( 0,  1)).rgb);
  float lpp = luma(at(iChannel0, p + ivec2( 1,  1)).rgb);
  float gx = (lmp + 2.0 * l0p + lpp) - (lmm + 2.0 * l0m + lpm);
  float gy = (lpm + 2.0 * lp0 + lpp) - (lmm + 2.0 * lm0 + lmp);
  return sqrt(gx * gx + gy * gy);
}

void main() {
  ivec2 P = topDown();
  ivec2 R = ivec2(u_resolution);
  ivec2 O = u_crop.xy;
  ivec2 S = u_crop.zw;
  int nx = u_resample == 1 ? 1 : clamp((S.x + R.x - 1) / R.x, 1, 12);
  int ny = u_resample == 1 ? 1 : clamp((S.y + R.y - 1) / R.y, 1, 12);

  vec4 boxAcc = vec4(0.0);
  vec3 salAcc = vec3(0.0);
  float salW = 0.0;
  float minL = 1e9, maxL = -1e9;

  for (int j = 0; j < 12; j++) {
    if (j >= ny) break;
    int sy = min(S.y - 1, ((2 * (P.y * ny + j) + 1) * S.y) / (2 * R.y * ny));
    for (int i = 0; i < 12; i++) {
      if (i >= nx) break;
      int sx = min(S.x - 1, ((2 * (P.x * nx + i) + 1) * S.x) / (2 * R.x * nx));
      ivec2 sp = O + ivec2(sx, sy);
      vec4 c = sampleSrc(sp);
      boxAcc += vec4(c.rgb * c.a, c.a);
      if (u_resample >= 2 && c.a > 0.0) {
        float l = luma(c.rgb);
        minL = min(minL, l); maxL = max(maxL, l);
        float mag = sobelAt(sp);
        float w = (u_resample == 2 ? (mag + 0.02) : (1.0 + 3.2 * mag)) * c.a;
        salAcc += c.rgb * w;
        salW += w;
      }
    }
  }

  vec3 c = boxAcc.a > 0.0 ? boxAcc.rgb / boxAcc.a : vec3(0.0);
  float a = boxAcc.a / float(nx * ny);

  if (u_resample == 2 && salW > 0.0) {
    c = salAcc / salW;
  } else if (u_resample == 3 && (maxL - minL) > 0.10) {
    float midL = 0.5 * (minL + maxL);
    vec3 loC = vec3(0.0), hiC = vec3(0.0);
    float loW = 0.0, hiW = 0.0;
    float hNx = 0.5 * max(1.0, float(nx)), hNy = 0.5 * max(1.0, float(ny));
    for (int j = 0; j < 12; j++) {
      if (j >= ny) break;
      int sy = min(S.y - 1, ((2 * (P.y * ny + j) + 1) * S.y) / (2 * R.y * ny));
      float dyc = ((float(j) + 0.5) - hNy) / hNy;
      for (int i = 0; i < 12; i++) {
        if (i >= nx) break;
        int sx = min(S.x - 1, ((2 * (P.x * nx + i) + 1) * S.x) / (2 * R.x * nx));
        ivec2 sp = O + ivec2(sx, sy);
        vec4 sc = sampleSrc(sp);
        if (sc.a <= 0.0) continue;
        float l = luma(sc.rgb);
        float mag = sobelAt(sp);
        float dxc = ((float(i) + 0.5) - hNx) / hNx;
        float cw = max(0.25, 1.35 - 0.55 * (dxc * dxc + dyc * dyc));
        float pw = (sc.a * cw) / (1.0 + 2.5 * mag);
        if (l <= midL) { loC += sc.rgb * pw; loW += pw; }
        else { hiC += sc.rgb * pw; hiW += pw; }
      }
    }
    vec3 plat = c;
    if (hiW * 1.12 >= loW && hiW > 0.0) plat = hiC / hiW;
    else if (loW > 0.0) plat = loC / loW;
    float span = clamp(((maxL - minL) - 0.10) / 0.22, 0.0, 1.0);
    float blend = span * span * (3.0 - 2.0 * span) * 0.98;
    c = mix(c, plat, blend);
  }

  float br = u_adjust.x, co = u_adjust.y, sa = u_adjust.z, ga = u_adjust.w;
  if (br != 0.0 || co != 0.0 || sa != 0.0 || ga != 1.0 || u_hue != 0.0) {
    float f = co >= 0.0 ? 1.0 / (1.0 - 0.99 * co) : 1.0 + co;
    c = (c + br - 0.5) * f + 0.5;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = l + (c - l) * (1.0 + sa);
    if (u_hue != 0.0) {
      float h = radians(u_hue), k = cos(h), q = sin(h);
      c = vec3(
        (0.213 + 0.787 * k - 0.213 * q) * c.r + (0.715 - 0.715 * k - 0.715 * q) * c.g + (0.072 - 0.072 * k + 0.928 * q) * c.b,
        (0.213 - 0.213 * k + 0.143 * q) * c.r + (0.715 + 0.285 * k + 0.140 * q) * c.g + (0.072 - 0.072 * k - 0.283 * q) * c.b,
        (0.213 - 0.213 * k - 0.787 * q) * c.r + (0.715 - 0.715 * k + 0.715 * q) * c.g + (0.072 + 0.928 * k + 0.072 * q) * c.b);
    }
    c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / ga));
  }
  a = (a >= u_alphaCut && a > 0.0) ? 1.0 : 0.0;
  fragColor = vec4(c * a, a);
}
`;

export const QUANT = /* glsl */`
uniform sampler2D u_matrix;
uniform int u_mode;
uniform float u_levels;
uniform float u_amount;

void main() {
  ivec2 P = topDown();
  vec4 p = at(iChannel0, P);
  if (p.a < 0.5) { fragColor = vec4(0.0); return; }
  vec3 c = p.rgb;
  if (u_mode == 0) { fragColor = vec4(floor(c * 255.0 + 0.5) / 255.0, 1.0); return; }
  if (u_mode == 2) {
    ivec2 ms = textureSize(u_matrix, 0);
    float v = floor(at(u_matrix, ivec2(P.x % ms.x, P.y % ms.y)).r * 255.0 + 0.5);
    float t = (v + 0.5) / u_levels - 0.5;
    c = clamp(c + t * u_amount, 0.0, 1.0);
  }
  fragColor = vec4(palColor(nearestIndex(c)), 1.0);
}
`;

export const DIFFUSE = /* glsl */`
uniform int u_recursion;
uniform int u_on;
uniform int u_skew;
uniform float u_strength;
uniform int u_kn;
uniform vec3 u_kernel[12];

void main() {
  if (u_on == 0) { fragColor = vec4(0.0, 0.0, 0.0, -1.0); return; }
  ivec2 P = topDown();
  int k = P.x + u_skew * P.y;
  int r = u_recursion;
  if (k < r) { fragColor = at(iChannel1, P); return; }
  if (k > r) { fragColor = vec4(0.0, 0.0, 0.0, -1.0); return; }
  vec4 p = at(iChannel0, P);
  if (p.a < 0.5) { fragColor = vec4(0.0, 0.0, 0.0, -2.0); return; }
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    if (i >= u_kn) break;
    ivec2 Q = P - ivec2(u_kernel[i].xy);
    if (!inside(Q)) continue;
    vec4 e = at(iChannel1, Q);
    if (e.a >= 0.0) acc += e.rgb * u_kernel[i].z;
  }
  vec3 c = clamp(p.rgb + acc * u_strength, 0.0, 1.0);
  int idx = nearestIndex(c);
  fragColor = vec4(c - palColor(idx), float(idx));
}
`;

export const RESOLVE = /* glsl */`
uniform int u_on;
void main() {
  ivec2 P = topDown();
  if (u_on == 0) { fragColor = at(iChannel0, P); return; }
  vec4 d = at(iChannel1, P);
  fragColor = d.a < 0.0 ? vec4(0.0) : vec4(palColor(int(d.a + 0.5)), 1.0);
}
`;

export const ORPHAN = /* glsl */`
uniform int u_on;
void main() {
  ivec2 P = topDown();
  vec4 me = at(iChannel0, P);
  fragColor = me;
  if (u_on == 0) return;
  int c = colorKey(me);
  ivec2 off[4] = ivec2[4](ivec2(0, -1), ivec2(1, 0), ivec2(0, 1), ivec2(-1, 0));
  int ks[4]; vec4 cs[4]; int n = 0;
  for (int i = 0; i < 4; i++) {
    ivec2 Q = P + off[i];
    if (!inside(Q)) continue;
    cs[n] = at(iChannel0, Q); ks[n] = colorKey(cs[n]);
    if (ks[n] == c) return;
    n++;
  }
  if (n < 2) return;
  int best = 0, bc = 0;
  for (int i = 0; i < 4; i++) {
    if (i >= n) break;
    int m = 0;
    for (int j = 0; j < 4; j++) { if (j >= n) break; if (ks[j] == ks[i]) m++; }
    if (m > bc) { bc = m; best = i; }
  }
  fragColor = cs[best];
}
`;

export const SMOOTH = /* glsl */`
uniform int u_on;
void main() {
  ivec2 P = topDown();
  vec4 me = at(iChannel0, P);
  fragColor = me;
  if (u_on == 0) return;
  int c = colorKey(me);
  ivec2 R = ivec2(u_resolution);
  int ks[9]; vec4 cs[9];
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
    ivec2 Q = clamp(P + ivec2(i - 1, j - 1), ivec2(0), R - 1);
    cs[j * 3 + i] = at(iChannel0, Q); ks[j * 3 + i] = colorKey(cs[j * 3 + i]);
  }
  for (int i = 0; i < 9; i++) {
    if (ks[i] == c) continue;
    int m = 0;
    for (int j = 0; j < 9; j++) if (ks[j] == ks[i]) m++;
    if (m >= 5) { fragColor = cs[i]; return; }
  }
}
`;

/** Outline: 0 none, 1 outer, 2 inner, 3 internal comic ink. */
export const OUTLINE = /* glsl */`
uniform int u_outline;
uniform int u_corners;
uniform vec3 u_outlineColor;
bool opaqueAt(ivec2 q) { return inside(q) && at(iChannel0, q).a > 0.5; }
void main() {
  ivec2 P = topDown();
  vec4 me = at(iChannel0, P);
  fragColor = me;
  if (u_outline == 0) return;
  ivec2 off[8] = ivec2[8](ivec2(0, -1), ivec2(1, 0), ivec2(0, 1), ivec2(-1, 0), ivec2(-1, -1), ivec2(1, -1), ivec2(1, 1), ivec2(-1, 1));
  int n = u_corners == 1 ? 8 : 4;
  bool o = me.a > 0.5;
  if (u_outline == 3) {
    if (!o) return;
    float lm = luma(me.rgb);
    for (int i = 0; i < 8; i++) {
      if (i >= n) break;
      ivec2 Q = P + off[i];
      if (!opaqueAt(Q)) continue;
      if (luma(at(iChannel0, Q).rgb) - lm >= 0.28) { fragColor = vec4(u_outlineColor, 1.0); return; }
    }
    return;
  }
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    ivec2 Q = P + off[i];
    if (!inside(Q)) continue;
    bool other = opaqueAt(Q);
    if (u_outline == 1 ? (!o && other) : (o && !other)) { fragColor = vec4(u_outlineColor, 1.0); return; }
  }
}
`;
