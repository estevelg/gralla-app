// Dibuix de la partitura amb VexFlow, i sota cada nota el nom i la digitació.

import { getFingering } from './fingerings.js';
import { fingeringSVG } from './fingering-svg.js';

const VF = () => window.Vex.Flow;

const NAMES = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
const ALTER_SYMBOL = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };
const ALTER_KEY = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' };
const KEYS = { 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#', '-1': 'F', '-2': 'Bb', '-3': 'Eb', '-4': 'Ab', '-5': 'Db', '-6': 'Gb', '-7': 'Cb' };
const DURATIONS = { breve: 'w', whole: 'w', half: 'h', quarter: 'q', eighth: '8', '16th': '16', '32nd': '32', '64th': '64' };

const STAFF_H = 132;       // alçada de la zona del pentagrama
const STAVE_Y = 22;        // espai a dalt per a les caselles 1a/2a i notes agudes
const PAD_X = 6;
const CARD_H = 162;        // nom + digitació
const MIN_NOTE_W = 46;     // espai mínim per nota (hi ha d'haver lloc per a la digitació)

export function noteName(n) {
  return NAMES[n.step] + (ALTER_SYMBOL[n.alter] ?? '');
}

function durationFor(n) {
  if (n.type && DURATIONS[n.type]) return { dur: DURATIONS[n.type], dots: n.dots };
  // Sense <type>: es dedueix de la durada.
  const table = [[4, 'w', 0], [3, 'h', 1], [2, 'h', 0], [1.5, 'q', 1], [1, 'q', 0], [0.75, '8', 1], [0.5, '8', 0], [0.25, '16', 0]];
  const hit = table.find(([q]) => Math.abs(q - n.durQ) < 1e-3) || [1, 'q', 0];
  return { dur: hit[1], dots: hit[2] };
}

function makeStaveNotes(measure) {
  const { StaveNote, Dot } = VF();
  return measure.notes.map((n) => {
    let sn;
    if (n.isRest && n.wholeMeasure) {
      sn = new StaveNote({ keys: ['b/4'], duration: 'wr', clef: 'treble' });
      sn.setCenterAlignment?.(true);
    } else {
      const { dur, dots } = durationFor(n);
      const key = n.isRest ? 'b/4' : `${n.step.toLowerCase()}${ALTER_KEY[n.alter] ?? ''}/${n.octave}`;
      sn = new StaveNote({ keys: [key], duration: dur + (n.isRest ? 'r' : ''), clef: 'treble', auto_stem: true });
      for (let i = 0; i < dots; i++) Dot.buildAndAttach([sn], { all: true });
    }
    sn.setAttribute('id', `nota-${n.id}`);
    return sn;
  });
}

function headerWidth(m, isRowStart, isFirst) {
  let w = 0;
  if (isRowStart) w += 34 + Math.abs(m.fifths) * 10;
  else if (m.keyChange) w += 12 + Math.abs(m.fifths) * 10;
  if (isFirst || m.timeChange) w += 26;
  if (m.repeatStart) w += 12;
  return w;
}

function measureMinWidth(m) {
  const accidentals = m.notes.filter((n) => !n.isRest && n.alter).length;
  return Math.max(90, m.notes.length * MIN_NOTE_W + accidentals * 12 + 26);
}

// Reparteix els compassos en files segons l'amplada disponible.
function layoutRows(measures, width) {
  const rows = [];
  let row = [];
  let used = 0;
  measures.forEach((m, i) => {
    const inline = measureMinWidth(m) + headerWidth(m, false, i === 0);
    if (row.length && used + inline > width) {
      rows.push(row);
      row = [];
      used = 0;
    }
    const min = measureMinWidth(m) + headerWidth(m, row.length === 0, i === 0);
    row.push({ m, min });
    used += min;
  });
  if (row.length) rows.push(row);
  return rows;
}

/**
 * Dibuixa la partitura dins de `container`.
 * Retorna un Map id → { card, group, note } per poder ressaltar i fer clic.
 */
export function renderScore(container, score, { onNoteClick } = {}) {
  const {
    Renderer, Stave, Voice, Formatter, Accidental, Beam, Tuplet, StaveTie, Barline, VoltaType,
  } = VF();
  container.innerHTML = '';
  const width = Math.max(300, container.clientWidth);
  const rows = layoutRows(score.measures, width - 2 * PAD_X);
  const index = new Map();
  let pendingTie = null; // nota VexFlow amb lligadura oberta

  rows.forEach((row, rIdx) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'fila';
    rowEl.style.height = `${STAFF_H + CARD_H}px`;
    const staffEl = document.createElement('div');
    staffEl.className = 'pentagrama';
    rowEl.append(staffEl);
    container.append(rowEl);

    const renderer = new Renderer(staffEl, Renderer.Backends.SVG);
    renderer.resize(width, STAFF_H);
    const ctx = renderer.getContext();

    const minTotal = row.reduce((s, r) => s + r.min, 0);
    const isLast = rIdx === rows.length - 1;
    const stretch = isLast && minTotal < width * 0.7 ? 1 : (width - 2 * PAD_X) / minTotal;
    let x = PAD_X;
    const ties = [];
    const rowNotes = [];

    row.forEach(({ m, min }, cIdx) => {
      const w = min * stretch;
      const stave = new Stave(x, STAVE_Y, w);
      const first = m.index === 0;
      if (cIdx === 0) {
        stave.addClef('treble');
        if (m.fifths) stave.addKeySignature(KEYS[m.fifths]);
        if (m.index > 0) stave.setMeasure(Number(m.number) || m.index + 1);
      } else if (m.keyChange) {
        stave.addKeySignature(KEYS[m.fifths]);
      }
      if (first || m.timeChange) stave.addTimeSignature(`${m.beats}/${m.beatType}`);
      if (m.repeatStart) stave.setBegBarType(Barline.type.REPEAT_BEGIN);
      if (m.repeatEnd) stave.setEndBarType(Barline.type.REPEAT_END);
      else if (m.index === score.measures.length - 1) stave.setEndBarType(Barline.type.END);
      if (m.endings) {
        const type = m.endingStart && m.endingStop ? VoltaType.BEGIN_END
          : m.endingStart ? VoltaType.BEGIN
            : m.endingStop ? VoltaType.END : VoltaType.MID;
        stave.setVoltaType(type, m.endingStart ? m.endingLabel : '', -8);
      }
      stave.setContext(ctx).draw();

      const notes = makeStaveNotes(m);
      if (notes.length) {
        const voice = new Voice({ num_beats: m.beats, beat_value: m.beatType }).setMode(Voice.Mode.SOFT);
        voice.addTickables(notes);
        Accidental.applyAccidentals([voice], KEYS[m.fifths]);

        // Tresets i altres grups irregulars.
        const tuplets = [];
        for (let i = 0; i < m.notes.length; i++) {
          const t = m.notes[i].tuplet;
          if (!t) continue;
          const group = notes.slice(i, i + t.actual);
          if (group.length === t.actual) {
            tuplets.push(new Tuplet(group, { num_notes: t.actual, notes_occupied: t.normal }));
          }
          i += t.actual - 1;
        }

        // En 2/2 s'agrupen les corxeres de negra en negra, més fàcil de llegir.
        const groups = Beam.getDefaultBeamGroups(m.beatType === 2 ? '2/4' : `${m.beats}/${m.beatType}`);
        const beams = Beam.generateBeams(notes, { groups });
        new Formatter({ softmaxFactor: 4 }).joinVoices([voice]).formatToStave([voice], stave);
        voice.draw(ctx, stave);
        beams.forEach((b) => b.setContext(ctx).draw());
        tuplets.forEach((t) => t.setContext(ctx).draw());

        m.notes.forEach((n, i) => {
          const sn = notes[i];
          if (n.isRest) { pendingTie = null; }
          else {
            if (n.tieStop && pendingTie) ties.push([pendingTie, sn]);
            pendingTie = n.tieStart ? sn : null;
          }
          rowNotes.push({ n, sn });
        });
      }
      x += w;
    });

    // Lligadures (també les que travessen el canvi de fila).
    ties.forEach(([a, b]) => {
      const sameRow = rowNotes.some((r) => r.sn === a);
      new StaveTie({
        first_note: sameRow ? a : null,
        last_note: b,
        first_indices: [0],
        last_indices: [0],
      }).setContext(ctx).draw();
    });
    if (pendingTie && rowNotes.some((r) => r.sn === pendingTie)) {
      new StaveTie({ first_note: pendingTie, last_note: null, first_indices: [0], last_indices: [0] })
        .setContext(ctx).draw();
    }

    // Targetes amb el nom i la digitació de cada nota.
    rowNotes.forEach(({ n, sn }) => {
      const group = staffEl.querySelector(`#vf-nota-${n.id}`);
      const entry = { group, note: n, row: rowEl };
      if (!n.isRest) {
        const cx = (sn.getNoteHeadBeginX() + sn.getNoteHeadEndX()) / 2;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'nota';
        card.dataset.id = n.id;
        card.style.left = `${cx}px`;
        card.style.top = `${STAFF_H}px`;
        const fing = getFingering(n.midi);
        if (!fing) card.classList.add('fora');
        if (n.tieStop) card.classList.add('lligada');
        card.innerHTML = `<span class="nom">${noteName(n)}</span>${fingeringSVG(fing)}${fing?.overblow ? '<span class="bufa" title="Bufa amb més pressió">fort</span>' : ''}`;
        card.title = fing ? `${noteName(n)}${fing.overblow ? ' (agut: bufa amb més pressió)' : ''}` : `${noteName(n)}: fora del registre de la gralla`;
        card.addEventListener('click', () => onNoteClick?.(n));
        rowEl.append(card);
        entry.card = card;
      }
      if (group) {
        group.style.cursor = 'pointer';
        group.addEventListener('click', () => onNoteClick?.(n));
      }
      index.set(n.id, entry);
    });
  });

  return index;
}
