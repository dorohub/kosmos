// Hyperraum-Sternentunnel: Sternstreifen, Tunnelwände, Zoom-Unschärfe und Austrittsblitz.
export const WarpTunnelShader = {
  uniforms: {
    tDiffuse: { value: null },
    uI: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uFlash: { value: 0 },
    uTint: { value: [0.55, 0.75, 1.0] },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uI; uniform float uTime; uniform float uAspect; uniform float uFlash; uniform vec3 uTint;
    varying vec2 vUv;
    float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      vec2 p = c * vec2(uAspect, 1.0);
      float r = length(p);
      float a = atan(p.y, p.x) / 6.28318 + 0.5;
      // Zoom-Unschärfe der Szene nach außen
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec3 blur = vec3(0.0);
      for (int i = 0; i < 12; i++) {
        float s = 1.0 - float(i) * 0.03 * uI;
        blur += texture2D(tDiffuse, 0.5 + c * s).rgb;
      }
      blur /= 12.0;
      vec3 col = mix(base, blur, clamp(uI * 1.3, 0.0, 1.0) * smoothstep(0.05, 0.45, r));
      // Sternstreifen auf vielen Bahnen
      vec3 streaks = vec3(0.0);
      for (int layer = 0; layer < 3; layer++) {
        float lanes = 90.0 + float(layer) * 70.0;
        float fa = a * lanes;
        float lane = floor(fa) + float(layer) * 997.0;
        float across = abs(fract(fa) - 0.5) * 2.0;
        float spd = 0.35 + h1(lane) * 0.9;
        float z = fract(h1(lane + 3.1) + uTime * spd * (0.25 + uI * 1.3));
        float head = pow(z, 1.6) * 1.25;
        float len = 0.02 + uI * 0.45 * z * z;
        float along = smoothstep(head - len, head, r) * (1.0 - smoothstep(head, head + 0.004, r));
        float thin = pow(1.0 - across, 10.0 + 30.0 * (1.0 - r));
        float b = along * thin * step(0.35, h1(lane + 9.7)) * (0.6 + 1.6 * h1(lane + 5.3));
        vec3 sc = mix(vec3(0.75, 0.88, 1.0), mix(uTint, vec3(0.85, 0.6, 1.0), h1(lane + 1.7)), 0.6);
        streaks += sc * b;
      }
      // Tunnelwände: wandernde Lichtringe
      float rings = pow(0.5 + 0.5 * sin(log(r + 0.02) * 22.0 - uTime * 18.0), 6.0);
      float walls = smoothstep(0.18, 0.75, r) * rings * (0.4 + 0.6 * sin(a * 6.28318 * 7.0 + uTime * 2.0) * 0.5 + 0.3);
      vec3 tunnel = mix(uTint, vec3(0.6, 0.35, 1.0), smoothstep(0.3, 0.8, r)) * walls * 0.35;
      // Zentrum (Ziel) leuchtet
      float core = exp(-r * 11.0) * 0.5;
      col += (streaks * 2.2 + tunnel + uTint * core) * uI;
      // dunkle Vignette während des Sprungs
      col *= 1.0 - uI * 0.55 * smoothstep(0.35, 0.95, r);
      col += vec3(0.85, 0.92, 1.0) * uFlash;
      gl_FragColor = vec4(col, 1.0);
    }`,
};
