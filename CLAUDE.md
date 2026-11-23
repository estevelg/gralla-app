# Que sonin les gralles! — context per a Claude

Web-app estàtica (HTML + CSS + JS en mòduls, sense build) per aprendre gralla seca: llibreria de partitures en
MusicXML, reproducció, i el nom i la digitació sota cada nota. El README explica el funcionament i l'estructura;
`docs/pla-ampliacio.md` és el pla si s'hi afegeixen colles i molt més repertori (fase 1 feta; fases 2-3 pendents).

## Com treballem

- **Idioma:** tot en català: la web, els textos, els comentaris del codi i els missatges de commit.
- **Publicació:** els canvis es fan i es pugen **directament a `main`** (GitHub Pages en publica la branca `main`).
  L'Esteve també la puja a 100webspace amb `./crea-zip.sh`; recorda-li-ho quan acabis un canvi.
- **Abans de cada commit que toqui `css/` o `js/`:** `python3 versiona.py` (posa la versió a les adreces del CSS i
  del JS de l'`index.html`; sense això el navegador barreja fitxers antics i nous).
- **Provar abans de pujar:** `python3 -m http.server` i Playwright amb Chromium (`/opt/pw-browsers/chromium` al
  núvol). Des del núvol el CDN de VexFlow no hi arriba: serveix `vexflow@4.2.5` en local amb `page.route`
  (`npm pack vexflow@4.2.5`). Comprova sempre a **390 px (mòbil vertical)**, **844 × 340 (mòbil apaisat)** i
  **1280 px (ordinador)**, i mira captures de pantalla, no només números.
- **No afegir funcions que no faran servir:** s'han tret expressament els exercicis, el nivell de dificultat,
  carregar un MusicXML propi i els botons de filtre per tipus. No els tornis a posar sense que ho demani.
- Si l'Esteve proposa un canvi d'interfície, dona la teva opinió i proposa millores abans de fer-lo si és gran.

## Afegir una cançó (el més habitual)

L'Esteve envia una imatge o PDF de la partitura; es transcriu a MusicXML a mà (amb un petit script Python que
genera els compassos) i s'afegeix a `partitures/index.json`.

- **Tempo:** si la partitura no en diu, posa'n un de raonable i digues-ho.
- **Veus:** cada veu és un fitxer (`<id>.musicxml`, `<id>-2a-gralla.musicxml`) i totes han de tenir **els mateixos
  compassos**, repeticions i caselles. Al catàleg, una sola entrada amb `veus` (i `fitxer` = la 1a veu, per
  compatibilitat). Format: vegeu el README.
- **Anacrusi:** com a compàs `implicit="yes"` número 0. El compàs inicial curt (1/4, 1/8) es posa així.
- **Notació:** notes escrites tal com a la partitura (registre de la gralla: Sol4 a Re6). Amb armadura, les
  alteracions van a `<alter>` igualment (p. ex. fa♯ en Sol major).
- **Escanejos de poca resolució:** digues clarament quins compassos són dubtosos perquè els revisi.
- **Abans de pujar:** comprova que el XML és vàlid i que la peça es dibuixa sense errors a la web.

## Fitxers clau

- `index.html`, `css/styles.css` (pantalla; mòbil `< 900 px` o alçada `≤ 500 px`), `css/print.css` (A5 apaisat).
- `js/main.js` (estat, reproductor, zoom de la partitura, barra plegable al mòbil, impressió),
  `js/render.js` (VexFlow + targetes), `js/musicxml.js`, `js/player.js`, `js/library.js`, `js/fingerings.js`.
- `contacte.php`: formulari de contacte a 100webspace. `contacte-config.php` (adreça de destí i secret) **no és al
  repositori** (`.gitignore`) i no s'ha de demanar ni escriure enlloc.
