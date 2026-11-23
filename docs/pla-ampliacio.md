# Pla d'ampliació: més repertori, més colles i millor al mòbil

## Context

La web es va fer per a un ús petit: 14 cançons, una llista de targetes a dalt i la partitura a sota. Ara s'ha
compartit amb altres colles de gralla, i és possible que s'hi vulguin afegir. Si passa, ens trobarem amb tres
problemes:

- **Llibreria:** amb 100 o 300 cançons, les targetes de dalt ocupen tota la pantalla abans d'arribar a la partitura.
- **Colles:** no hi ha manera de dir de quina colla és una cançó, ni de tenir versions diferents de la mateixa cançó.
- **Mòbil:** el pentagrama és massa gran. En una pantalla de mòbil hi cap un sol compàs (2 o 3 notes) per línia.
  La causa és a `js/render.js`: cada nota reserva `MIN_NOTE_W = 46` px, perquè la targeta de digitació fa 44 px.

**Decisions preses:**

- Tot el repertori és **públic**. La web continua sent estàtica (GitHub Pages i 100webspace), sense comptes.
- **Tu centralitzes les aportacions.** Les colles envien MusicXML, PDF o fotos, i tu (amb Claude) les afegeixes.
- Una cançó pot tenir **versions per colla**, cadascuna amb les seves veus.

Va per fases. La fase 1 val la pena fer-la ja, encara que no arribin colles noves. Les fases 2 i 3 es fan quan arribin.

---

## Fase 1: mòbil i llibreria escalable — FETA (novembre 2026)

Estat: feta. Llista compacta amb filtres per `tipus`, barra lateral a l'ordinador, vistes separades al mòbil
(«← Cançons»), zoom de la partitura amb A− / A+, menú «⋯» al mòbil i llegenda plegable. La vista compacta
automàtica al mòbil no s'ha fet: amb el zoom ja no cal.

### 1a. Partitura al mòbil: zoom

- **Idea:** dibuixar la partitura en una amplada lògica més gran i reduir-la de cop amb CSS. El pentagrama, les
  targetes i les digitacions s'encongeixen igual, i caben 2 o 3 compassos per línia.
- **Dibuix:** a `draw()` de `js/main.js`, es crida `renderScore(els.partitura, shown, { width: amplada / zoom })`.
  L'opció `width` ja existeix a `renderScore`, i la impressió ja la fa servir.
- **Reducció:** el contenidor `.partitura` porta `zoom: var(--zoom)` (o `transform: scale` com a alternativa).
  Les targetes `.nota` tenen posicions absolutes en px dins de cada `.veu`, així que s'escalen bé.
- **Zoom per defecte:** segons l'amplada de pantalla. Aproximadament 1 a partir de 900 px, 0,8 en tauleta i 0,6 al
  mòbil.
- **Control de mida:** botons A− / A+ al reproductor, desats a `localStorage` amb el mateix patró que `VIEW_KEY`
  (`gralla-vista`) a `js/main.js`.
- **A revisar:**
  - Els clics a les notes. `onNoteClick` i les targetes són elements DOM, així que han de continuar funcionant.
  - El seguiment de fila durant la reproducció (`followRow`), que fa servir `getBoundingClientRect`, i el zoom
    l'afecta.
  - La impressió (`preparePrint`) ha d'ignorar el zoom.
- **Retocs complementaris al mòbil:** vista compacta automàtica (ja existeix la classe `compacte`), menys marge
  lateral i el reproductor més baix: les opcions menys usades (So, MIDI, Imprimeix) dins un menú «⋯».

### 1b. Llibreria: barra lateral a l'ordinador, pantalla pròpia al mòbil

- **Llista compacta:** a `renderCatalog` (`js/library.js`), una línia per cançó en comptes de targetes. Cada línia
  porta el títol, una etiqueta i el nombre de veus.
- **Ordinador (≥ 900 px):** maquetació de dues columnes. A l'esquerra, la llibreria (cercador i llista amb scroll
  propi, uns 280 px). A la dreta, la cançó oberta.
- **Mòbil:** dues vistes que canvien amb l'adreça, aprofitant el `hashchange` / `parseHash()` que ja hi ha.
  - Sense cançó (`#/`): només la llibreria.
  - Amb cançó (`#/<id>`): només la partitura, amb un botó «← Cançons» a dalt.
  - Així no cal fer scroll per sobre de la llista per arribar a la partitura.
- **Filtres:** xips sota el cercador, de moment per **tipus** (cercavila, ball de gegants, pasdoble, popular…).
  `filter()` a `js/library.js` ja busca per paraules. N'hi ha prou d'afegir-hi el filtre per xip.
- **Peces de suport:** «Tens un fitxer MusicXML propi?» i la llegenda de digitació passen a desplegables al final de
  la llibreria i de la cançó.

**Fitxers:** `index.html`, `css/styles.css` (maquetació i media queries), `js/library.js`, `js/main.js`
(`draw`, `setPiece`, i que `openFromHash` no faci `scrollIntoView` al mòbil) i `js/render.js` (cap canvi de
lògica; potser exposar `MIN_NOTE_W`). Després, `python3 versiona.py`.

---

## Fase 2: colles i versions (quan arribin les primeres colles)

### Dades (`partitures/`)

- **`partitures/colles.json`:** `[{ "id": "colla-x", "nom": "Colla X", "poble": "...", "web": "..." }]`.
- **Carpeta per colla:** `partitures/<colla>/<can>.musicxml`, per no barrejar centenars de fitxers.
  El repertori actual va a `partitures/general/`, o es queda on és i el catàleg ho indica amb una ruta.
- **Format d'`index.json`:** una entrada per **cançó**, amb una llista de **versions**, cadascuna amb la seva colla i
  les seves veus:
  ```json
  { "id": "gegant-del-pi", "titol": "El Gegant del Pi", "tipus": ["ball de gegants"],
    "versions": [
      { "id": "colla-x", "colla": "colla-x", "veus": [{ "nom": "1a gralla", "fitxer": "colla-x/gegant-del-pi.musicxml" }] }
    ] }
  ```
- **Compatibilitat:** les entrades actuals (`fitxer` / `veus`) es continuen llegint com una versió sense colla. Es
  fa a `entryVoices()` de `js/library.js`, i així no cal migrar-ho tot de cop.

### Interfície

- **Selector de versió:** si una cançó té diverses versions, al costat del selector de veu (`buildVoiceSelector`)
  surt «Versió: Colla X / Colla Y».
- **Adreces:** `#/<cançó>/<versió>/<veu>`. Les actuals (`#/<id>`, `#/<id>/2`, `#/<id>/totes`) continuen
  funcionant; `parseHash()` ja accepta àlies.
- **Pàgina de colla:** `#/colla/<id>`, amb el nom, el poble i la llista del seu repertori. És un enllaç que cada
  colla pot compartir amb els seus membres com si fos «la seva àrea», sense comptes.
- **Filtres:** filtre per colla a la llibreria (xips o desplegable), a més del de tipus.

### Eines per mantenir-ho (només tu)

- **`valida.py`** (com `versiona.py`, a executar abans de cada commit que toqui `partitures/`). Comprova que:
  - cada fitxer del catàleg existeix i és MusicXML vàlid;
  - les veus d'una versió tenen el mateix nombre de compassos;
  - les notes cauen dins del registre de la gralla (Sol a Re agut);
  - les colles existeixen a `colles.json`;
  - no hi ha `id` repetits.
- **Guia per a les colles** (secció al README i enllaç al formulari de contacte), amb el que han d'enviar:
  - MusicXML exportat de MuseScore, un fitxer per veu o una partitura amb diverses parts;
  - el títol, l'autor si en tenen, el tipus i el tempo;
  - si no tenen MusicXML, un PDF o una foto, que es transcriu.

---

## Fase 3: si creix molt (300+ cançons, moltes colles)

- **Catàleg:** `index.json` continua funcionant amb milers d'entrades. Ocupa uns pocs centenars de KB, i es pot
  servir comprimit. Si pesa massa, es parteix en un índex lleuger (títol, tipus, colles) i un fitxer de detall per
  colla.
- **Cercador:** a més del títol, ha de trobar autor, tipus i colla, sense distingir accents (ja ho fa amb
  `normalize`).
- **Aportacions:** si el centralitzat no dona l'abast, un formulari de pujada (PHP a 100webspace) que desa els
  fitxers a una carpeta de pendents i t'avisa per correu. Es reutilitza la protecció antispam de `contacte.php`.
  Res es publica sense revisió.
- **PWA (opcional):** amb un service worker, les partitures que ja has obert es poden fer servir sense connexió, per
  exemple al carrer en una cercavila.

---

## Verificació (per a cada fase)

- **Servidor local:** `python3 -m http.server`, i comprovar amb Playwright (Chromium) a 390 px (mòbil), 768 px
  (tauleta) i 1280 px (ordinador).
- **Fase 1:**
  - Al mòbil, una cançó en 2/4 mostra ≥ 2 compassos per línia.
  - Clicar una nota la fa sonar, i la reproducció ressalta i segueix la fila.
  - «← Cançons» torna a la llista.
  - A l'ordinador, la barra lateral fa scroll sola.
  - La impressió es veu igual que abans.
  - Els enllaços antics (`#/gener/totes`, `#/polca-dours-2a-gralla`) continuen obrint bé.
- **Fase 2:**
  - `valida.py` passa net.
  - Una cançó amb dues versions mostra el selector, i `#/colla/<id>` llista el repertori de la colla.
  - El cercador troba per colla i per tipus.
- **Sempre:** `python3 versiona.py` abans del commit si s'ha tocat `css/` o `js/`.
