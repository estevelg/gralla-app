// Llibreria de partitures: catàleg a partitures/index.json.

const BASE = 'partitures/';

const normalize = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export async function loadCatalog() {
  const res = await fetch(`${BASE}index.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error("No s'ha pogut carregar la llista de cançons.");
  return res.json();
}

// Veus d'una cançó: les entrades d'una sola veu tenen "fitxer"; les altres, "veus".
export function entryVoices(entry) {
  return entry.veus?.length ? entry.veus : [{ nom: 'Gralla', fitxer: entry.fitxer }];
}

// Descarrega el text MusicXML de cada veu.
export function fetchPiece(entry) {
  return Promise.all(entryVoices(entry).map(async (v) => {
    const res = await fetch(BASE + v.fitxer);
    if (!res.ok) throw new Error(`No s'ha pogut carregar «${entry.titol}».`);
    return { nom: v.nom, xml: await res.text() };
  }));
}

// Pinta la llista agrupada per categoria. Retorna una funció per filtrar-la.
export function renderCatalog(container, emptyEl, catalog, onPick) {
  const categories = new Map();
  for (const entry of catalog) {
    const cat = entry.categoria || 'Altres';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat).push(entry);
  }

  const items = [];
  container.innerHTML = '';
  for (const [cat, entries] of categories) {
    const group = document.createElement('section');
    group.className = 'categoria';
    const h = document.createElement('h3');
    h.textContent = cat;
    group.append(h);
    const list = document.createElement('div');
    list.className = 'targetes';
    for (const entry of entries) {
      const a = document.createElement('a');
      a.className = 'targeta';
      a.href = `#/${entry.id}`;
      a.dataset.id = entry.id;
      const voices = entryVoices(entry);
      const meta = [entry.notes, voices.length > 1 ? `${voices.length} veus` : ''].filter(Boolean).join(' · ');
      a.innerHTML = `<span class="targeta-titol"></span>${meta ? '<span class="targeta-meta"></span>' : ''}`;
      a.querySelector('.targeta-titol').textContent = entry.titol;
      if (meta) a.querySelector('.targeta-meta').textContent = meta;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        onPick(entry);
      });
      list.append(a);
      items.push({ el: a, group, text: normalize(`${entry.titol} ${cat} ${meta}`) });
    }
    group.append(list);
    container.append(group);
  }

  return function filter(query) {
    const q = normalize(query.trim());
    const visibleGroups = new Set();
    let count = 0;
    for (const it of items) {
      const show = !q || q.split(/\s+/).every((w) => it.text.includes(w));
      it.el.hidden = !show;
      if (show) { visibleGroups.add(it.group); count++; }
    }
    for (const g of container.querySelectorAll('.categoria')) g.hidden = !visibleGroups.has(g);
    emptyEl.hidden = count > 0;
  };
}

export function markSelected(container, id) {
  for (const el of container.querySelectorAll('.targeta')) {
    el.classList.toggle('seleccionada', el.dataset.id === id);
  }
}
