"use client";

import { useEffect, useRef } from "react";

type LivingFieldProps = {
  /** 0..1. Lower seeds stay dark until the world has enough contributions. */
  energy: number;
  /** A live moment quiets the field so it does not compete with the task. */
  quiet?: boolean;
  accent?: string;
};

const VERT = `
attribute vec2 aPos;
attribute float aSeed;
uniform vec2 uMouse;
uniform float uTime;
uniform float uEnergy;
uniform float uMouseOn;
uniform float uQuiet;
uniform float uPointScale;
uniform float uAspect;
varying float vAlpha;
varying float vWake;
void main() {
  float awake = 1.0 - smoothstep(uEnergy, uEnergy + 0.035, aSeed);
  vec2 p = vec2(aPos.x / max(uAspect, 0.01), aPos.y);
  float drift = uTime * (0.22 + aSeed * 0.35) * (1.0 - uQuiet * 0.85);
  p.x += sin(drift + aSeed * 18.0) * 0.012;
  p.y += cos(drift * 0.8 + aSeed * 11.0) * 0.012;
  vec2 mouse = vec2(uMouse.x / max(uAspect, 0.01), uMouse.y);
  vec2 d = p - mouse;
  float dist = length(d);
  float wake = smoothstep(0.34, 0.0, dist) * uMouseOn * (1.0 - uQuiet);
  p += normalize(d + vec2(0.0001)) * wake * 0.09;
  gl_Position = vec4(p, 0.0, 1.0);
  gl_PointSize = uPointScale * (0.55 + aSeed * 1.15) * (1.0 + wake * 1.8);
  vWake = wake;
  vAlpha = awake * (0.28 + 0.42 * (0.5 + 0.5 * sin(uTime * 1.6 + aSeed * 40.0))) * (1.0 - uQuiet * 0.78) + wake * 0.55;
}
`;

const FRAG = `
precision mediump float;
uniform vec3 uColor;
varying float vAlpha;
varying float vWake;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  float disc = smoothstep(0.5, 0.08, d);
  vec3 color = mix(uColor, vec3(1.0), vWake * 0.55);
  gl_FragColor = vec4(color, disc * vAlpha);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    console.warn(log || "Field shader failed to compile.");
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function parseHex(hex: string): [number, number, number] {
  const raw = hex.trim().replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0.812, 1, 0.506];
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

function readAccent(explicit?: string): [number, number, number] {
  if (explicit) return parseHex(explicit);
  if (typeof document === "undefined") return [0.812, 1, 0.506];
  const fromCss = getComputedStyle(document.documentElement).getPropertyValue("--csc-accent").trim();
  return parseHex(fromCss || "#CFFF81");
}

/**
 * Cursor-reactive point field for the field lab. Not mounted on live Gardens or Blooms.
 */
export default function LivingField({ energy, quiet = false, accent }: LivingFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const energyRef = useRef(energy);
  const quietRef = useRef(quiet);
  energyRef.current = energy;
  quietRef.current = quiet;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const pointCount = window.innerWidth < 800 ? 2200 : 6400;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const positions = new Float32Array(pointCount * 2);
    const seeds = new Float32Array(pointCount);
    for (let i = 0; i < pointCount; i++) {
      const t = (i + 0.5) / pointCount;
      const radius = Math.sqrt(t) * 0.82;
      const angle = i * golden;
      positions[i * 2] = Math.cos(angle) * radius;
      positions[i * 2 + 1] = Math.sin(angle) * radius;
      seeds[i] = t;
    }

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const seedBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    const seedLoc = gl.getAttribLocation(program, "aSeed");
    gl.enableVertexAttribArray(seedLoc);
    gl.vertexAttribPointer(seedLoc, 1, gl.FLOAT, false, 0, 0);

    const uMouse = gl.getUniformLocation(program, "uMouse");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uEnergy = gl.getUniformLocation(program, "uEnergy");
    const uMouseOn = gl.getUniformLocation(program, "uMouseOn");
    const uQuiet = gl.getUniformLocation(program, "uQuiet");
    const uPointScale = gl.getUniformLocation(program, "uPointScale");
    const uAspect = gl.getUniformLocation(program, "uAspect");
    const uColor = gl.getUniformLocation(program, "uColor");
    const [r, g, b] = readAccent(accent);
    gl.uniform3f(uColor, r, g, b);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, on: 0, ton: 0 };
    const onMove = (event: PointerEvent) => {
      pointer.tx = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = -((event.clientY / window.innerHeight) * 2 - 1);
      pointer.ton = event.pointerType === "touch" || reduce ? 0 : 1;
    };
    const onLeave = () => {
      pointer.ton = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    document.documentElement.addEventListener("pointerleave", onLeave);

    let frame = 0;
    let last = performance.now();
    let time = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width < 2 || height < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(width * dpr);
      const h = Math.round(height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      time += dt * (reduce ? 0.05 : 1);
      const k = 1 - Math.pow(0.02, dt);
      pointer.x += (pointer.tx - pointer.x) * k * 0.55;
      pointer.y += (pointer.ty - pointer.y) * k * 0.55;
      pointer.on += (pointer.ton - pointer.on) * k * 0.4;
      gl.uniform2f(uMouse, pointer.x, pointer.y);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uEnergy, Math.max(0, Math.min(1, energyRef.current)));
      gl.uniform1f(uMouseOn, reduce ? 0 : pointer.on);
      gl.uniform1f(uQuiet, quietRef.current ? 1 : 0);
      gl.uniform1f(uPointScale, (window.innerWidth < 800 ? 2.4 : 3.1) * dpr);
      gl.uniform1f(uAspect, width / height);
      gl.drawArrays(gl.POINTS, 0, pointCount);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(seedBuf);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [accent]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
