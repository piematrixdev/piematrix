/**
 * Procedural Orion figure shader.
 * Draws a stylized hunter silhouette with soft edges,
 * rendered as a semi-transparent overlay on a billboard quad.
 * 
 * UV space: (0,0) = bottom-left, (1,1) = top-right
 * The figure is drawn using signed distance functions for smooth shapes.
 */

// Helper: line segment SDF
const LINE_SDF = `
float sdLine(vec2 p, vec2 a, vec2 b, float w) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - w;
}
`;

// Helper: circle SDF
const CIRCLE_SDF = `
float sdCircle(vec2 p, vec2 c, float r) {
  return length(p - c) - r;
}
`;

// Helper: smooth union
const SMOOTH_UNION = `
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
`;

export const ORION_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ORION_FRAG = `
  varying vec2 vUv;

  ${LINE_SDF}
  ${CIRCLE_SDF}
  ${SMOOTH_UNION}

  void main() {
    // Map UV to figure space — figure centered, aspect ~0.72 (26/36)
    vec2 p = vUv;

    // All coordinates in UV space (0-1)
    // Key body points (mapped from RA/Dec to UV):
    // Head center:    (0.50, 0.86)
    // L shoulder:     (0.35, 0.72)
    // R shoulder:     (0.65, 0.72)
    // Belt center:    (0.50, 0.52)
    // L hip:          (0.38, 0.48)
    // R hip:          (0.62, 0.48)
    // L foot (Rigel): (0.28, 0.18)
    // R foot (Saiph): (0.62, 0.15)
    // L hand (bow):   (0.12, 0.78)
    // R hand (club):  (0.78, 0.95)

    float bodyW = 0.025;  // body limb width
    float armW = 0.018;   // arm width
    float legW = 0.022;   // leg width

    // --- Head (circle) ---
    float head = sdCircle(p, vec2(0.50, 0.86), 0.045);

    // --- Neck ---
    float neck = sdLine(p, vec2(0.50, 0.82), vec2(0.50, 0.76), 0.015);

    // --- Torso ---
    float torsoL = sdLine(p, vec2(0.38, 0.74), vec2(0.38, 0.48), bodyW);
    float torsoR = sdLine(p, vec2(0.62, 0.74), vec2(0.62, 0.48), bodyW);
    // Shoulders
    float shoulders = sdLine(p, vec2(0.35, 0.74), vec2(0.65, 0.74), bodyW);
    // Chest fill — horizontal lines
    float chest1 = sdLine(p, vec2(0.38, 0.68), vec2(0.62, 0.68), 0.012);
    float chest2 = sdLine(p, vec2(0.38, 0.62), vec2(0.62, 0.62), 0.012);
    float chest3 = sdLine(p, vec2(0.38, 0.56), vec2(0.62, 0.56), 0.012);
    // Waist/belt
    float belt = sdLine(p, vec2(0.36, 0.48), vec2(0.64, 0.48), bodyW);

    // --- Left leg ---
    float legL1 = sdLine(p, vec2(0.42, 0.48), vec2(0.36, 0.34), legW);
    float legL2 = sdLine(p, vec2(0.36, 0.34), vec2(0.28, 0.18), legW);
    // Left foot
    float footL = sdLine(p, vec2(0.28, 0.18), vec2(0.22, 0.16), 0.015);

    // --- Right leg ---
    float legR1 = sdLine(p, vec2(0.58, 0.48), vec2(0.60, 0.34), legW);
    float legR2 = sdLine(p, vec2(0.60, 0.34), vec2(0.62, 0.18), legW);
    // Right foot
    float footR = sdLine(p, vec2(0.62, 0.18), vec2(0.68, 0.15), 0.015);

    // --- Left arm (holding shield/bow) ---
    float armL1 = sdLine(p, vec2(0.35, 0.74), vec2(0.24, 0.80), armW);
    float armL2 = sdLine(p, vec2(0.24, 0.80), vec2(0.15, 0.78), armW);
    // Shield (curved arc)
    float shield1 = sdLine(p, vec2(0.15, 0.78), vec2(0.12, 0.70), armW);
    float shield2 = sdLine(p, vec2(0.12, 0.70), vec2(0.12, 0.60), armW);
    float shield3 = sdLine(p, vec2(0.12, 0.60), vec2(0.15, 0.50), armW);
    float shield4 = sdLine(p, vec2(0.15, 0.50), vec2(0.20, 0.44), armW);

    // --- Right arm (holding club, raised) ---
    float armR1 = sdLine(p, vec2(0.65, 0.74), vec2(0.72, 0.82), armW);
    float armR2 = sdLine(p, vec2(0.72, 0.82), vec2(0.76, 0.90), armW);
    // Club
    float club1 = sdLine(p, vec2(0.76, 0.90), vec2(0.78, 0.96), 0.022);
    float club2 = sdLine(p, vec2(0.78, 0.96), vec2(0.82, 0.98), 0.018);

    // --- Sword (hanging from belt) ---
    float sword = sdLine(p, vec2(0.50, 0.48), vec2(0.50, 0.36), 0.008);
    float swordTip = sdLine(p, vec2(0.50, 0.36), vec2(0.50, 0.32), 0.005);

    // --- Combine all with smooth union ---
    float d = head;
    d = smin(d, neck, 0.02);
    d = smin(d, torsoL, 0.02);
    d = smin(d, torsoR, 0.02);
    d = smin(d, shoulders, 0.02);
    d = smin(d, chest1, 0.03);
    d = smin(d, chest2, 0.03);
    d = smin(d, chest3, 0.03);
    d = smin(d, belt, 0.02);
    d = smin(d, legL1, 0.02);
    d = smin(d, legL2, 0.02);
    d = smin(d, footL, 0.02);
    d = smin(d, legR1, 0.02);
    d = smin(d, legR2, 0.02);
    d = smin(d, footR, 0.02);
    d = smin(d, armL1, 0.02);
    d = smin(d, armL2, 0.02);
    d = smin(d, shield1, 0.02);
    d = smin(d, shield2, 0.02);
    d = smin(d, shield3, 0.02);
    d = smin(d, shield4, 0.02);
    d = smin(d, armR1, 0.02);
    d = smin(d, armR2, 0.02);
    d = smin(d, club1, 0.02);
    d = smin(d, club2, 0.02);
    d = smin(d, sword, 0.01);
    d = smin(d, swordTip, 0.01);

    // Soft edge
    float alpha = smoothstep(0.02, -0.01, d);

    // Color: bluish-white silhouette with slight internal shading
    vec3 baseColor = vec3(0.55, 0.65, 0.85);
    // Brighter at edges (rim light effect)
    float rim = smoothstep(-0.01, 0.015, d) * smoothstep(0.04, 0.0, d);
    vec3 col = baseColor + vec3(0.2, 0.2, 0.3) * rim;

    // Overall opacity
    alpha *= 0.3;

    if (alpha < 0.005) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;
