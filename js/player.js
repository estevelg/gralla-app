// Reproductor: converteix la partitura en esdeveniments i els programa amb Web Audio.
// Timbre per defecte: "shanai" (General MIDI), el més semblant a la gralla.

import { unrollMeasures } from './musicxml.js';

const SMPLR_URL = 'https://cdn.jsdelivr.net/npm/smplr@1.0.0/+esm';
const LOOKAHEAD = 0.25; // segons programats per avançat
const TICK_MS = 25;

// Esdeveniments en negres (quarter notes) des de l'inici.
//  sounds: notes que sonen (les lligadures s'ajunten en una sola nota)
//  marks:  què cal ressaltar a cada moment (nota o silenci de la partitura)
export function buildEvents(score, soRealSemitones = 0) {
  const sounds = [];
  const marks = [];
  let t = 0;
  let open = null; // nota lligada pendent
  for (const mi of unrollMeasures(score.measures)) {
    for (const n of score.measures[mi].notes) {
      marks.push({ start: t, dur: n.durQ, id: n.id });
      if (!n.isRest) {
        if (n.tieStop && open && open.midi === n.midi + soRealSemitones) {
          open.dur += n.durQ;
        } else {
          open = { start: t, dur: n.durQ, midi: n.midi + soRealSemitones };
          sounds.push(open);
        }
        if (!n.tieStart) open = null;
      } else {
        open = null;
      }
      t += n.durQ;
    }
  }
  return { sounds, marks, totalQ: t };
}

// Síntesi senzilla (per si no es pot descarregar el so de mostra).
function fallbackSynth(ctx) {
  const out = ctx.createGain();
  out.gain.value = 0.18;
  out.connect(ctx.destination);
  const voices = new Set();
  return {
    start({ note, time, duration }) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const env = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 440 * 2 ** ((note - 69) / 12);
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 0.8;
      env.gain.setValueAtTime(0, time);
      env.gain.linearRampToValueAtTime(1, time + 0.02);
      env.gain.setValueAtTime(1, time + Math.max(0.03, duration - 0.03));
      env.gain.linearRampToValueAtTime(0, time + duration);
      osc.connect(filter).connect(env).connect(out);
      osc.start(time);
      osc.stop(time + duration + 0.05);
      voices.add(osc);
      osc.onended = () => voices.delete(osc);
    },
    stop() {
      for (const o of voices) { try { o.stop(); } catch { /* ja aturat */ } }
      voices.clear();
    },
  };
}

export class Player {
  constructor({ onMark, onState, onStatus }) {
    this.onMark = onMark;       // (id | null) nota a ressaltar
    this.onState = onState;     // ('playing' | 'paused' | 'stopped')
    this.onStatus = onStatus;   // text d'estat (càrrega del so)
    this.ctx = null;
    this.instruments = {};
    this.instrumentName = 'shanai';
    this.events = { sounds: [], marks: [], totalQ: 0 };
    this.baseTempo = 100;
    this.tempoFactor = 1;
    this.loop = false;
    this.state = 'stopped';
    this.positionQ = 0;
    this.currentMark = null;
  }

  setScore(score, soRealSemitones) {
    this.stop();
    this.events = buildEvents(score, soRealSemitones);
    this.baseTempo = score.tempo;
  }

  get secPerQ() { return 60 / (this.baseTempo * this.tempoFactor); }

  async ensureAudio() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.getInstrument();
  }

  async getInstrument() {
    const name = this.instrumentName;
    if (this.instruments[name]) return this.instruments[name];
    this.onStatus?.('Carregant el so…');
    try {
      const { Soundfont } = await import(SMPLR_URL);
      const inst = Soundfont(this.ctx, { instrument: name, volume: 90 });
      await inst.ready;
      this.instruments[name] = inst;
    } catch (err) {
      console.warn("No s'ha pogut carregar el so de mostra; s'usa un so sintètic.", err);
      this.instruments[name] = fallbackSynth(this.ctx);
    }
    this.onStatus?.('');
    return this.instruments[name];
  }

  async setInstrument(name) {
    const wasPlaying = this.state === 'playing';
    if (wasPlaying) this.pause();
    this.instrumentName = name;
    if (this.ctx) await this.getInstrument();
    if (wasPlaying) this.play();
  }

  setTempoFactor(f) {
    if (this.state === 'playing') this.anchor(this.currentQ());
    this.tempoFactor = f;
  }

  currentQ() {
    if (this.state !== 'playing') return this.positionQ;
    return this.anchorQ + (this.ctx.currentTime - this.anchorTime) / this.secPerQ;
  }

  anchor(q) {
    this.anchorQ = q;
    this.anchorTime = this.ctx.currentTime;
  }

  async play(fromQ = this.positionQ) {
    if (!this.events.sounds.length) return;
    this.inst = await this.ensureAudio();
    if (this.state === 'playing') return;
    if (fromQ >= this.events.totalQ) fromQ = 0;
    this.state = 'playing';
    this.onState?.('playing');
    this.anchorQ = fromQ;
    this.anchorTime = this.ctx.currentTime + 0.08;
    this.scheduledUntilQ = fromQ;
    this.nextSound = this.events.sounds.findIndex((s) => s.start >= fromQ - 1e-6);
    if (this.nextSound < 0) this.nextSound = this.events.sounds.length;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  tick() {
    const { sounds, totalQ } = this.events;
    const nowQ = this.anchorQ + (this.ctx.currentTime + LOOKAHEAD - this.anchorTime) / this.secPerQ;
    while (this.nextSound < sounds.length && sounds[this.nextSound].start < nowQ) {
      const s = sounds[this.nextSound++];
      const time = this.anchorTime + (s.start - this.anchorQ) * this.secPerQ;
      // Un petit silenci entre notes, com el cop de llengua.
      const duration = Math.max(0.05, s.dur * this.secPerQ - Math.min(0.06, s.dur * this.secPerQ * 0.12));
      this.inst.start({ note: s.midi, time: Math.max(time, this.ctx.currentTime), duration, velocity: 100 });
    }
    this.updateMark();
    if (this.currentQ() >= totalQ) {
      if (this.loop) {
        this.anchorQ = 0;
        this.anchorTime = this.anchorTime + totalQ * this.secPerQ;
        this.nextSound = 0;
      } else {
        this.stop();
      }
    }
  }

  updateMark() {
    const q = this.currentQ();
    const marks = this.events.marks;
    let id = null;
    // Cerca binària de l'últim esdeveniment que ha començat.
    let lo = 0;
    let hi = marks.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (marks[mid].start <= q) { id = marks[mid].id; lo = mid + 1; } else hi = mid - 1;
    }
    if (q < 0) id = null;
    if (id !== this.currentMark) {
      this.currentMark = id;
      this.onMark?.(id);
    }
  }

  halt() {
    clearInterval(this.timer);
    this.inst?.stop();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.positionQ = Math.max(0, this.currentQ());
    this.halt();
    this.state = 'paused';
    this.onState?.('paused');
  }

  stop() {
    if (this.state === 'playing') this.halt();
    this.state = 'stopped';
    this.positionQ = 0;
    this.currentMark = null;
    this.onMark?.(null);
    this.onState?.('stopped');
  }

  // Comença a sonar des d'una nota concreta (per id de la partitura).
  seekToMark(id) {
    const mark = this.events.marks.find((m) => m.id === id);
    if (!mark) return;
    const wasPlaying = this.state === 'playing';
    if (wasPlaying) this.halt();
    this.state = 'paused';
    this.positionQ = mark.start;
    this.currentMark = id;
    this.onMark?.(id);
    if (wasPlaying) this.play(mark.start);
    else this.onState?.('paused');
  }

  // Toca una sola nota (en so real) per escoltar-la.
  async previewNote(midi, seconds = 0.8) {
    const inst = await this.ensureAudio();
    inst.start({ note: midi, time: this.ctx.currentTime + 0.02, duration: seconds, velocity: 100 });
  }
}
