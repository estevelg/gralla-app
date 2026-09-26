// Lectura de MusicXML (.musicxml / .xml) i MusicXML comprimit (.mxl).
// Només es llegeix la primera part i la primera veu: la gralla és monòdica.

const STEP_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export async function readScoreFile(file) {
  const name = file.name.toLowerCase();
  let xmlText;
  if (name.endsWith('.mxl')) {
    xmlText = await unzipMxl(await file.arrayBuffer());
  } else {
    xmlText = await file.text();
  }
  const score = parseMusicXML(xmlText);
  if (!score.title) score.title = file.name.replace(/\.(musicxml|xml|mxl)$/i, '');
  return score;
}

async function unzipMxl(buffer) {
  const zip = await window.JSZip.loadAsync(buffer);
  let path = null;
  const container = zip.file('META-INF/container.xml');
  if (container) {
    const doc = new DOMParser().parseFromString(await container.async('string'), 'application/xml');
    path = doc.querySelector('rootfile')?.getAttribute('full-path');
  }
  if (!path) {
    path = Object.keys(zip.files).find((p) => !p.startsWith('META-INF') && /\.(xml|musicxml)$/i.test(p));
  }
  if (!path || !zip.file(path)) throw new Error("No s'ha trobat la partitura dins del fitxer .mxl.");
  return zip.file(path).async('string');
}

const childText = (el, sel) => el.querySelector(sel)?.textContent.trim();
const childNum = (el, sel) => {
  const t = childText(el, sel);
  return t === undefined || t === '' ? undefined : Number(t);
};

export function parseMusicXML(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error("El fitxer no és un MusicXML vàlid.");
  const root = doc.documentElement;
  if (root.nodeName === 'score-timewise') {
    throw new Error('Format "score-timewise" no suportat. Exporta la partitura de nou des de MuseScore.');
  }
  if (root.nodeName !== 'score-partwise') throw new Error("El fitxer no és una partitura MusicXML.");

  const title = childText(root, 'work > work-title') || childText(root, 'movement-title') ||
    [...root.querySelectorAll('credit-words')].map((c) => c.textContent.trim()).find(Boolean) || '';

  const part = root.querySelector('part');
  if (!part) throw new Error('La partitura no conté cap part.');

  let divisions = 1;
  let fifths = 0;
  let beats = 4;
  let beatType = 4;
  let tempo = null;
  let voice = null;
  let activeEnding = null; // caselles (1a, 2a…) que poden ocupar diversos compassos
  const measures = [];

  for (const mEl of part.querySelectorAll(':scope > measure')) {
    const m = {
      index: measures.length,
      number: mEl.getAttribute('number'),
      notes: [],
      repeatStart: false,
      repeatEnd: 0,
      endings: null,
      endingStart: false,
      endingStop: false,
      keyChange: measures.length === 0,
      timeChange: measures.length === 0,
    };

    for (const el of mEl.children) {
      switch (el.nodeName) {
        case 'attributes': {
          const d = childNum(el, 'divisions');
          if (d) divisions = d;
          const f = childNum(el, 'key > fifths');
          if (f !== undefined) { if (f !== fifths) m.keyChange = true; fifths = f; }
          const b = childNum(el, 'time > beats');
          const bt = childNum(el, 'time > beat-type');
          if (b && bt) { if (b !== beats || bt !== beatType) m.timeChange = true; beats = b; beatType = bt; }
          break;
        }
        case 'direction':
        case 'sound': {
          const s = el.nodeName === 'sound' ? el : el.querySelector('sound');
          const t = s?.getAttribute('tempo') ?? childText(el, 'metronome > per-minute');
          if (t && !Number.isNaN(Number(t)) && tempo === null) tempo = Number(t);
          break;
        }
        case 'barline': {
          const rep = el.querySelector('repeat');
          if (rep?.getAttribute('direction') === 'forward') m.repeatStart = true;
          if (rep?.getAttribute('direction') === 'backward') m.repeatEnd = Number(rep.getAttribute('times')) || 2;
          const end = el.querySelector('ending');
          if (end?.getAttribute('type') === 'start') {
            const numbers = (end.getAttribute('number') || '1').split(/[,\s]+/).filter(Boolean).map(Number);
            activeEnding = { numbers, label: end.textContent.trim() || `${numbers.join(', ')}.` };
            m.endingStart = true;
          } else if (end) {
            m.endingStop = end.getAttribute('type') === 'stop';
            m.endingClose = true;
          }
          break;
        }
        case 'note': {
          if (el.querySelector('grace') || el.querySelector('cue') || el.querySelector('chord')) break;
          const v = childText(el, 'voice') || '1';
          if (voice === null) voice = v;
          if (v !== voice) break;
          m.notes.push(parseNote(el, divisions, m, beats, beatType));
          break;
        }
        default:
          break;
      }
    }
    if (activeEnding) {
      m.endings = activeEnding.numbers;
      m.endingLabel = activeEnding.label;
      if (m.endingClose) activeEnding = null;
    }
    m.fifths = fifths;
    m.beats = beats;
    m.beatType = beatType;
    m.notes.forEach((n, i) => { n.id = `m${m.index}n${i}`; });
    measures.push(m);
  }

  if (!measures.some((m) => m.notes.some((n) => !n.isRest))) {
    throw new Error('La partitura no conté cap nota.');
  }
  return { title, tempo: tempo || 100, measures };
}

function parseNote(el, divisions, m, beats, beatType) {
  const isRest = !!el.querySelector('rest');
  const durDiv = childNum(el, 'duration') || 0;
  const n = {
    isRest,
    durQ: durDiv / divisions,
    type: childText(el, 'type') || null,
    dots: el.querySelectorAll('dot').length,
    tieStart: !!el.querySelector('tie[type="start"], tied[type="start"]'),
    tieStop: !!el.querySelector('tie[type="stop"], tied[type="stop"]'),
    tuplet: null,
  };
  const actual = childNum(el, 'time-modification > actual-notes');
  const normal = childNum(el, 'time-modification > normal-notes');
  if (actual && normal) n.tuplet = { actual, normal };
  if (isRest) {
    n.wholeMeasure = el.querySelector('rest')?.getAttribute('measure') === 'yes' || !n.type;
    if (n.wholeMeasure) n.durQ = n.durQ || (beats * 4) / beatType;
  } else {
    n.step = childText(el, 'pitch > step');
    n.alter = Math.round(childNum(el, 'pitch > alter') || 0);
    n.octave = childNum(el, 'pitch > octave');
    n.midi = (n.octave + 1) * 12 + STEP_SEMITONES[n.step] + n.alter;
  }
  return n;
}

// Ordre de reproducció dels compassos, desplegant repeticions i caselles 1a/2a.
export function unrollMeasures(measures) {
  const order = [];
  const finished = new Set();
  let start = 0;
  let pass = 1;
  let jumpedFrom = -1; // compàs amb la barra de repetició que ens ha fet tornar enrere
  let i = 0;
  let guard = 0;
  while (i < measures.length && guard++ < 10000) {
    const m = measures[i];
    if (pass > 1 && i > jumpedFrom && !m.endings) {
      // Hem sortit de les caselles: la repetició s'ha acabat.
      pass = 1;
      start = i;
    }
    if (m.repeatStart && pass === 1) start = i;
    if (m.endings && !m.endings.includes(pass)) { i++; continue; }
    order.push(i);
    if (m.repeatEnd && !finished.has(i)) {
      const times = Math.max(m.repeatEnd, m.endings ? Math.max(...m.endings) + 1 : 0);
      if (pass < times) {
        pass++;
        jumpedFrom = i;
        i = start;
        continue;
      }
      finished.add(i);
      pass = 1;
      start = i + 1;
    }
    i++;
  }
  return order;
}

// Transposició de la notació (per a partitures escrites en un altre to).
const SHARP_NAMES = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
const FLAT_NAMES = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];

export function transposeScore(score, semitones) {
  if (!semitones) return score;
  const measures = score.measures.map((m) => {
    let f = (((m.fifths + 7 * semitones) % 12) + 12) % 12;
    if (f > 6) f -= 12;
    const names = f < 0 ? FLAT_NAMES : SHARP_NAMES;
    const notes = m.notes.map((n) => {
      if (n.isRest) return { ...n };
      const midi = n.midi + semitones;
      const [step, alter] = names[((midi % 12) + 12) % 12];
      return { ...n, midi, step, alter, octave: Math.floor(midi / 12) - 1 };
    });
    return { ...m, fifths: f, notes };
  });
  return { ...score, measures };
}
