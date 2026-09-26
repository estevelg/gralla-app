# Gralla seca · Digitacions

Web-app per a principiants de gralla seca: carregues una partitura en MusicXML i
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

## Partitures en PDF o foto

1. Obre el PDF amb **MuseScore 4** (*Fitxer → Importa PDF*) o amb **Audiveris** per a fotos i escanejats.
2. Revisa i corregeix les notes que s'hagin llegit malament.
3. *Fitxer → Exporta → MusicXML* (`.mxl` o `.musicxml`) i carrega el fitxer a l'app.

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
| `examples/` | Partitures d'exemple |

Llibreries (per CDN): VexFlow 4, JSZip, smplr.
