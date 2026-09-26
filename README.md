# Gralla seca · Digitacions

Web-app per a principiants de gralla seca: tries una cançó de la llibreria (o carregues un MusicXML propi) i
- la pots escoltar (so de xeremia/shanai, oboè o flauta; velocitat ajustable, repetició),
- veus el pentagrama original i, sota cada nota, el **nom** i el **dibuix de la digitació**,
- la nota que sona es ressalta i la vista la segueix,
- pots descarregar-la en **MIDI**.

Les digitacions surten de la taula de la gralla Bessó ([pacobesso.net](https://www.pacobesso.net)),
de Sol a Re agut. Per a Re♯ i La♯ es fa servir la posició normal.

## Obrir-la en local

Cal un petit servidor web (els mòduls JavaScript no funcionen obrint l'`index.html` directament):

```bash
python3 -m http.server 8765 --directory gralla-app
```

i obre <http://localhost:8765>.

## Llibreria de partitures

Les cançons són a `partitures/`: un fitxer `.musicxml` per peça i el catàleg `partitures/index.json`:

```json
{ "id": "germa-jaume", "titol": "Germà Jaume", "fitxer": "germa-jaume.musicxml",
  "categoria": "Exercicis", "nivell": "Inicial", "notes": "Tradicional" }
```

Cada peça té un enllaç directe: `https://estevelg.github.io/gralla-app/#/<id>`.

Per afegir-ne una: transcriure-la a MusicXML, desar-la a `partitures/`, afegir-la a `index.json` i fer push.
GitHub Pages s'actualitza sol en un parell de minuts.

## Publicar a GitHub Pages

1. Puja aquesta carpeta a un repositori de GitHub.
2. *Settings → Pages → Build and deployment*: font **Deploy from a branch**, branca `main`, carpeta `/ (root)`.
3. En un parell de minuts la web serà a `https://<usuari>.github.io/<repositori>/`.

## Estructura

| Fitxer | Què fa |
| --- | --- |
| `js/fingerings.js` | Taula de digitacions (MIDI escrit → 7 forats) i notes on cal bufar més fort |
| `js/fingering-svg.js` | Dibuix d'una digitació |
| `js/musicxml.js` | Lectura de MusicXML/MXL, repeticions i caselles, transposició |
| `js/render.js` | Pentagrama amb VexFlow + nom i digitació sota cada nota |
| `js/player.js` | Reproducció amb Web Audio (smplr, sons General MIDI) |
| `js/midi-export.js` | Exportació a fitxer MIDI |
| `js/library.js` | Llista de cançons, cercador i enllaços directes |
| `partitures/` | Llibreria de partitures i catàleg `index.json` |

Llibreries (per CDN): VexFlow 4, JSZip, smplr.
