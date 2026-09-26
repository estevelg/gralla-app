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
};

let original = null;   // partitura tal com s'ha llegit
let score = null;      // partitura (transposada si cal)
let index = new Map(); // id de nota → elements dibuixats
let active = null;

const player = new Player({
  onMark: highlight,
  onState: (state) => {
    els.play.classList.toggle('sonant', state === 'playing');
    els.play.setAttribute('aria-label', state === 'playing' ? 'Pausa' : 'Reprodueix');
  },
  onStatus: (text) => { els.estat.textContent = text || tempoText(); },
});

function tempoText() {
  if (!score) return '';
  return `♩ = ${Math.round(score.tempo * player.tempoFactor)}`;
}

// ---------- Càrrega ----------

function showError(msg) {
  els.error.textContent = msg;
  els.error.hidden = !msg;
}

async function loadFile(file) {
  try {
    showError('');
    setScore(await readScoreFile(file));
    markSelected(els.llista, null);
    history.replaceState(null, '', location.pathname);
  } catch (err) {
    console.error(err);
    showError(err.message || "No s'ha pogut llegir la partitura.");
  }
}

let catalog = [];

async function loadFromLibrary(entry, { scroll = true } = {}) {
  try {
    showError('');
    const piece = parseMusicXML(await fetchPiece(entry));
    piece.title = entry.titol;
    if (location.hash !== `#/${entry.id}`) history.replaceState(null, '', `#/${entry.id}`);
    markSelected(els.llista, entry.id);
    setScore(piece, { scroll });
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

function openFromHash({ scroll = true } = {}) {
  const id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const entry = id && catalog.find((e) => e.id === id);
  if (entry) loadFromLibrary(entry, { scroll });
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

function setScore(s, { scroll = true } = {}) {
  original = s;
  els.transposa.value = 0;
  els.obra.hidden = false;
  applyTransposition(0);
  if (scroll) els.obra.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function applyTransposition(semitones) {
  score = transposeScore(original, semitones);
  player.setScore(score, SO_REAL);
  els.titol.textContent = score.title || 'Partitura';
  els.estat.textContent = tempoText();
  draw();
  checkRange();
}

function draw() {
  if (!score) return;
  active = null;
  index = renderScore(els.partitura, score, { onNoteClick });
  if (player.currentMark) highlight(player.currentMark);
}

// ---------- Registre ----------

function outOfRange(s, t = 0) {
  let n = 0;
  for (const m of s.measures) for (const note of m.notes) if (!note.isRest && !inRange(note.midi + t)) n++;
  return n;
}

function checkRange() {
  const bad = outOfRange(score);
  if (!bad) { els.avis.hidden = true; return; }
  let best = 0;
  let bestBad = bad;
  for (let t = -12; t <= 12; t++) {
    const b = outOfRange(score, t);
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

function highlight(id) {
  if (active) {
    const prev = index.get(active);
    prev?.card?.classList.remove('actiu');
    prev?.group?.classList.remove('actiu');
  }
  active = id;
  if (!id) return;
  const entry = index.get(id);
  if (!entry) return;
  entry.card?.classList.add('actiu');
  entry.group?.classList.add('actiu');
  followRow(entry.row);
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
  if (!score) return;
  const bytes = buildMidi(player.events, score.tempo * player.tempoFactor, els.timbre.value, score.title);
  const name = (score.title || 'gralla').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
  downloadMidi(bytes, `${name || 'gralla'}.mid`);
});

els.transposa.addEventListener('change', () => {
  if (!original) return;
  const t = Math.max(-12, Math.min(12, Math.round(Number(els.transposa.value) || 0)));
  els.transposa.value = t;
  applyTransposition(t);
});

document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || !score || e.target.closest('input, select, textarea, button, summary')) return;
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
