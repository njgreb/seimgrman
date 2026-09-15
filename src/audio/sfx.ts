// Tiny square-wave/noise synth so the game needs no audio files.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.25;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

interface Tone {
  type?: OscillatorType;
  from: number;
  to?: number;
  dur: number;
  vol?: number;
  delay?: number;
}

function tone({ type = 'square', from, to = from, dur, vol = 0.5, delay = 0 }: Tone): void {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + delay;
  const osc = a.ctx.createOscillator();
  const gain = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(a.out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.5, delay = 0, lowpass = 3000): void {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + delay;
  const len = Math.floor(a.ctx.sampleRate * dur);
  const buffer = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(a.out);
  src.start(t);
}

export const sfx = {
  toggleMute(): boolean {
    muted = !muted;
    return muted;
  },
  // Create/resume the audio context from inside a user gesture (required on mobile browsers).
  unlock: () => void audio(),
  shoot: () => tone({ from: 880, to: 440, dur: 0.07, vol: 0.3 }),
  weapon: () => tone({ from: 300, to: 900, dur: 0.12, vol: 0.3 }),
  land: () => noise(0.05, 0.25, 0, 800),
  hurt: () => {
    tone({ from: 600, to: 150, dur: 0.2, vol: 0.4 });
    noise(0.15, 0.3);
  },
  bossHit: () => {
    tone({ from: 220, to: 110, dur: 0.08, vol: 0.4 });
    noise(0.06, 0.35, 0, 1500);
  },
  deflect: () => tone({ type: 'triangle', from: 1200, to: 1600, dur: 0.05, vol: 0.3 }),
  enemyShoot: () => tone({ from: 500, to: 250, dur: 0.08, vol: 0.2 }),
  beep: () => tone({ from: 1400, dur: 0.06, vol: 0.2 }),
  whoosh: () => noise(0.25, 0.25, 0, 1200),
  boom: () => {
    noise(0.5, 0.6, 0, 900);
    tone({ from: 150, to: 40, dur: 0.4, vol: 0.4 });
  },
  death: () => {
    for (let i = 0; i < 6; i++) tone({ from: 800 - i * 100, to: 200, dur: 0.12, vol: 0.3, delay: i * 0.08 });
    noise(0.6, 0.4, 0.05, 1200);
  },
  teleport: () => tone({ from: 200, to: 1600, dur: 0.25, vol: 0.25 }),
  tick: () => tone({ from: 1000, dur: 0.03, vol: 0.15 }),
  cursor: () => tone({ from: 700, dur: 0.04, vol: 0.2 }),
  select: () => {
    tone({ from: 523, dur: 0.08, vol: 0.3 });
    tone({ from: 784, dur: 0.12, vol: 0.3, delay: 0.08 });
  },
  jingle: () => {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((n, i) => tone({ from: n, dur: 0.14, vol: 0.3, delay: i * 0.12 }));
  },
  freeze: () => {
    tone({ type: 'triangle', from: 1800, to: 900, dur: 0.3, vol: 0.3 });
    tone({ type: 'triangle', from: 2400, to: 1200, dur: 0.3, vol: 0.2, delay: 0.05 });
  },
};
