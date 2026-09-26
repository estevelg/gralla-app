// Llibreria de partitures: catàleg a partitures/index.json.

const BASE = 'partitures/';

const normalize = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export async function loadCatalog() {
  const res = await fetch(`${BASE}index.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error("No s'ha pogut carregar la llista de cançons.");
  return res.json();
}

export async function fetchPiece(entry) {
  const res = await fetch(BASE + entry.fitxer);
  if (!res.ok) throw new Error(`No s'ha pogut carregar «${entry.titol}».`);
  return res.text();
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
      const meta = [entry.nivell, entry.notes].filter(Boolean).join(' · ');
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
