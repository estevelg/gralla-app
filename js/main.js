import { readScoreFile, parseMusicXML, transposeScore } from './musicxml.js';
import { renderScore } from './render.js';
import { getFingering, inRange, SO_REAL, LOWEST, HIGHEST } from './fingerings.js';
import { fingeringSVG } from './fingering-svg.js';
import { Player } from './player.js';
import { buildMidi, downloadMidi } from './midi-export.js';
import { loadCatalog, fetchPiece, renderCatalog, markSelected } from './library.js';

const $ = (sel) => document.querySelector(sel);

const els = {
  zona: $('#zona'),
  llista: $('#llista'),
  llistaBuida: $('#llista-buida'),
  cerca: $('#cerca'),
  fitxer: $('#fitxer'),
  error: $('#error'),
  obra: $('#obra'),
  titol: $('#titol'),
  estat: $('#estat'),
  play: $('#play'),
  atura: $('#atura'),
  tempo: $('#tempo'),
  tempoValor: $('#tempo-valor'),
  bucle: $('#bucle'),
  timbre: $('#timbre'),
  midi: $('#midi'),
  avis: $('#avis'),
  partitura: $('#partitura'),
  taula: $('#taula-graella'),
  transposa: $('#transposa'),
  veus: $('#veus'),
};

let piece = null;      // cançó tal com s'ha llegit: { title, voices: [{ nom, score }] }
let selection = 0;     // veu que es mostra: índex de veu o 'totes'
let shown = [];        // veus que es mostren i sonen (transposades si cal)
let index = new Map(); // id de nota → elements dibuixats
let active = [];

const player = new Player({
  onMark: highlight,
  onState: (state) => {
    els.play.classList.toggle('sonant', state === 'playing');
    els.play.setAttribute('aria-label', state === 'playing' ? 'Pausa' : 'Reprodueix');
  },
  onStatus: (text) => { els.estat.textContent = text || tempoText(); },
});

const baseTempo = () => shown[0].score.tempo;

function tempoText() {
  if (!shown.length) return '';
  return `♩ = ${Math.round(baseTempo() * player.tempoFactor)}`;
}

// ---------- Càrrega ----------

function showError(msg) {
  els.error.textContent = msg;
  els.error.hidden = !msg;
}

async function loadFile(file) {
  try {
    showError('');
    const score = await readScoreFile(file);
    currentEntry = null;
    setPiece({ title: score.title, voices: [{ nom: 'Gralla', score: tagVoice(score, 0) }] }, 0);
    markSelected(els.llista, null);
    history.replaceState(null, '', location.pathname);
  } catch (err) {
    console.error(err);
    showError(err.message || "No s'ha pogut llegir la partitura.");
  }
}

let catalog = [];

// Identificadors de nota únics per veu (les veus comparteixen la mateixa pàgina).
function tagVoice(score, v) {
  for (const m of score.measures) for (const n of m.notes) n.id = `v${v}-${n.id}`;
  return score;
}

function hashFor(entry, sel) {
  const suffix = sel === 'totes' ? '/totes' : sel > 0 ? `/${sel + 1}` : '';
  return `#/${entry.id}${suffix}`;
}

async function loadFromLibrary(entry, { scroll = true, voice = 0 } = {}) {
  try {
    showError('');
    const loaded = await fetchPiece(entry);
    const voices = loaded.map(({ nom, xml }, i) => ({ nom, score: tagVoice(parseMusicXML(xml), i) }));
    if (voices.some((v) => v.score.measures.length !== voices[0].score.measures.length)) {
      throw new Error(`Les veus de «${entry.titol}» no tenen el mateix nombre de compassos.`);
    }
    currentEntry = entry;
    if (location.hash !== hashFor(entry, voice)) history.replaceState(null, '', hashFor(entry, voice));
    markSelected(els.llista, entry.id);
    setPiece({ title: entry.titol, voices }, voice, { scroll });
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

let currentEntry = null;

// Troba la cançó i la veu d'un enllaç: #/<id>, #/<id>/2 o #/<id>/totes
// (també s'accepta l'id antic d'una veu, p. ex. #/polca-dours-2a-gralla).
function parseHash() {
  const [id, veu] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  if (!id) return null;
  let entry = catalog.find((e) => e.id === id);
  let voice = 0;
  if (entry) {
    const n = entry.veus?.length || 1;
    if (veu === 'totes' && n > 1) voice = 'totes';
    else if (Number(veu) >= 1 && Number(veu) <= n) voice = Number(veu) - 1;
  } else {
    entry = catalog.find((e) => e.veus?.some((v) => v.id === id));
    if (entry) voice = entry.veus.findIndex((v) => v.id === id);
  }
  return entry ? { entry, voice } : null;
}

function openFromHash({ scroll = true } = {}) {
  const target = parseHash();
  if (!target) return;
  if (target.entry === currentEntry && piece) {
    selectVoice(target.voice);
  } else {
    loadFromLibrary(target.entry, { scroll, voice: target.voice });
  }
}

async function initLibrary() {
  try {
    catalog = await loadCatalog();
    const filter = renderCatalog(els.llista, els.llistaBuida, catalog, (entry) => loadFromLibrary(entry));
    els.cerca.addEventListener('input', () => filter(els.cerca.value));
    openFromHash();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

function setPiece(p, voice = 0, { scroll = true } = {}) {
  piece = p;
  selection = voice;
  els.transposa.value = 0;
  els.obra.hidden = false;
  buildVoiceSelector();
  applyTransposition(0);
  if (scroll) els.obra.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Selector de veu: 1a gralla, 2a gralla o totes alhora.
function buildVoiceSelector() {
  const n = piece.voices.length;
  els.veus.hidden = n < 2;
  els.veus.innerHTML = '';
  if (n < 2) return;
  const options = piece.voices.map((v, i) => [i, v.nom]);
  options.push(['totes', n === 2 ? 'Les dues' : 'Totes']);
  for (const [value, label] of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.dataset.sel = value;
    btn.textContent = label;
    btn.addEventListener('click', () => selectVoice(value));
    els.veus.append(btn);
  }
  markVoiceSelector();
}

function markVoiceSelector() {
  for (const btn of els.veus.querySelectorAll('button')) {
    btn.setAttribute('aria-checked', String(btn.dataset.sel === String(selection)));
  }
}

function selectVoice(value) {
  if (!piece || value === selection) return;
  selection = value;
  markVoiceSelector();
  if (currentEntry && location.hash !== hashFor(currentEntry, selection)) {
    history.replaceState(null, '', hashFor(currentEntry, selection));
  }
  applyTransposition(Number(els.transposa.value) || 0);
}

function applyTransposition(semitones) {
  const voices = selection === 'totes' ? piece.voices : [piece.voices[selection] ?? piece.voices[0]];
  shown = voices.map(({ nom, score }) => ({ nom, score: transposeScore(score, semitones) }));
  player.setScore(shown.map((v) => v.score), SO_REAL);
  els.titol.textContent = piece.title || 'Partitura';
  els.estat.textContent = tempoText();
  draw();
  checkRange();
}

function draw() {
  if (!shown.length) return;
  active = [];
  index = renderScore(els.partitura, shown, { onNoteClick });
  if (player.currentMarks.length) highlight(player.currentMarks);
}

// ---------- Registre ----------

function outOfRange(voices, t = 0) {
  let n = 0;
  for (const { score } of voices) {
    for (const m of score.measures) for (const note of m.notes) if (!note.isRest && !inRange(note.midi + t)) n++;
  }
  return n;
}

function checkRange() {
  const bad = outOfRange(shown);
  if (!bad) { els.avis.hidden = true; return; }
  let best = 0;
  let bestBad = bad;
  for (let t = -12; t <= 12; t++) {
    const b = outOfRange(shown, t);
    if (b < bestBad || (b === bestBad && Math.abs(t) < Math.abs(best))) { best = t; bestBad = b; }
  }
  els.avis.hidden = false;
  els.avis.innerHTML = `<strong>${bad} ${bad > 1 ? 'notes' : 'nota'}</strong> fora del registre de la gralla (Sol a Re agut), marcades en vermell.`;
  if (best && bestBad < bad) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'boto-text';
    btn.textContent = `Transposa ${best > 0 ? '+' : ''}${best} semitons`;
    btn.addEventListener('click', () => {
      const total = Number(els.transposa.value) + best;
      els.transposa.value = total;
      applyTransposition(total);
    });
    els.avis.append(btn);
  }
}

// ---------- Ressaltat ----------

function highlight(ids) {
  for (const id of active) {
    const prev = index.get(id);
    prev?.card?.classList.remove('actiu');
    prev?.group?.classList.remove('actiu');
  }
  active = ids || [];
  let row = null;
  for (const id of active) {
    const entry = index.get(id);
    if (!entry) continue;
    entry.card?.classList.add('actiu');
    entry.group?.classList.add('actiu');
    row ??= entry.row;
  }
  followRow(row);
}

function followRow(row) {
  if (player.state !== 'playing' || !row) return;
  const bar = document.getElementById('reproductor').getBoundingClientRect();
  const r = row.getBoundingClientRect();
  if (r.top < bar.bottom + 8 || r.bottom > window.innerHeight - 8) {
    window.scrollTo({ top: window.scrollY + r.top - bar.bottom - 16, behavior: 'smooth' });
  }
}

function onNoteClick(note) {
  player.seekToMark(note.id);
  if (player.state !== 'playing' && !note.isRest) player.previewNote(note.midi + SO_REAL);
}

// ---------- Taula completa ----------

function buildTable() {
  const names = { 0: 'Do', 1: 'Do♯', 2: 'Re', 3: 'Re♯', 4: 'Mi', 5: 'Fa', 6: 'Fa♯', 7: 'Sol', 8: 'Sol♯', 9: 'La', 10: 'La♯', 11: 'Si' };
  for (let midi = LOWEST; midi <= HIGHEST; midi++) {
    const f = getFingering(midi);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'nota';
    card.innerHTML = `<span class="nom">${names[midi % 12]}</span><span class="octava">${midi >= 79 ? 'agut' : 'greu'}</span>${fingeringSVG(f)}${f.overblow ? '<span class="bufa">fort</span>' : ''}`;
    card.addEventListener('click', () => player.previewNote(midi + SO_REAL));
    els.taula.append(card);
  }
}

// ---------- Esdeveniments ----------

els.fitxer.addEventListener('change', () => {
  const file = els.fitxer.files[0];
  if (file) loadFile(file);
  els.fitxer.value = '';
});

['dragenter', 'dragover'].forEach((type) => els.zona.addEventListener(type, (e) => {
  e.preventDefault();
  els.zona.classList.add('sobre');
}));
['dragleave', 'drop'].forEach((type) => els.zona.addEventListener(type, () => els.zona.classList.remove('sobre')));
els.zona.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

window.addEventListener('hashchange', () => openFromHash());

els.play.addEventListener('click', async () => {
  if (player.state === 'playing') { player.pause(); return; }
  els.play.disabled = true;
  try { await player.play(); } finally { els.play.disabled = false; }
});
els.atura.addEventListener('click', () => player.stop());

els.tempo.addEventListener('input', () => {
  const pct = Number(els.tempo.value);
  els.tempoValor.textContent = `${pct} %`;
  player.setTempoFactor(pct / 100);
  els.estat.textContent = tempoText();
});
els.bucle.addEventListener('change', () => { player.loop = els.bucle.checked; });
els.timbre.addEventListener('change', () => player.setInstrument(els.timbre.value));

els.midi.addEventListener('click', () => {
  if (!shown.length) return;
  const voiceName = piece.voices.length > 1 ? (selection === 'totes' ? '' : shown[0].nom) : '';
  const title = [piece.title, voiceName].filter(Boolean).join(' ');
  const bytes = buildMidi(player.events, baseTempo() * player.tempoFactor, els.timbre.value, title);
  const name = (title || 'gralla').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
  downloadMidi(bytes, `${name || 'gralla'}.mid`);
});

els.transposa.addEventListener('change', () => {
  if (!piece) return;
  const t = Math.max(-12, Math.min(12, Math.round(Number(els.transposa.value) || 0)));
  els.transposa.value = t;
  applyTransposition(t);
});

document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || !shown.length || e.target.closest('input, select, textarea, button, summary')) return;
  e.preventDefault();
  els.play.click();
});

let resizeTimer;
let lastWidth = els.partitura.clientWidth;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (els.partitura.clientWidth !== lastWidth) {
      lastWidth = els.partitura.clientWidth;
      draw();
    }
  }, 150);
});

buildTable();
initLibrary();
