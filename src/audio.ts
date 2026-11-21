// Procedural 8-bit sound effects built on the Web Audio API (no asset files).
let ctx: AudioContext | null = null;
let master: GainNode;
let engineGain: GainNode;
let noiseBuf: AudioBuffer;

/** Must be called from a user gesture (key press / click) to unlock audio. */
export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 48;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    osc.connect(engineGain).connect(master);
    osc.start();
  }
  if (ctx.state === "suspended") ctx.resume();
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol = 0.25, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur);
}

function noise(dur: number, vol: number, cutoff: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(cutoff, t);
  f.frequency.exponentialRampToValueAtTime(100, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5, dur);
}

export const sfx = {
  shoot: () => tone("square", 800, 180, 0.09, 0.12),
  brick: () => noise(0.09, 0.3, 3000),
  steel: () => tone("square", 260, 200, 0.07, 0.18),
  explode: () => {
    noise(0.55, 0.6, 1200);
    tone("sawtooth", 150, 25, 0.5, 0.25);
  },
  start: () =>
    [392, 392, 523, 659, 784].forEach((f, i) => tone("square", f, f, 0.12, 0.15, i * 0.12)),
  clear: () =>
    [523, 659, 784, 1047].forEach((f, i) => tone("square", f, f, 0.14, 0.15, i * 0.1)),
  over: () =>
    [440, 392, 349, 294, 220].forEach((f, i) => tone("triangle", f, f * 0.98, 0.3, 0.3, i * 0.25)),
  engine: (on: boolean) => {
    if (ctx) engineGain.gain.setTargetAtTime(on ? 0.06 : 0, ctx.currentTime, 0.05);
  },
};
