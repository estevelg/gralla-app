# Que sonin les gralles!

Web-app per a principiants de gralla seca: tries una cançó de la llibreria (o carregues un MusicXML propi) i
- la pots escoltar (so de xeremia/shanai, oboè o flauta; velocitat ajustable, repetició),
- veus el pentagrama original i, sota cada nota, el **nom** i el **dibuix de la digitació**,
- la nota que sona es ressalta i la vista la segueix amb antelació (sempre es veu la fila següent, per llegir endavant),
- amb les dues veus juntes, la 2a es veu en vermell molt fosc,
- a la barra es tria què es veu (caselles **Pentagrama**, **Notes** i **Digitació**, mínim una de marcada) i l'elecció es recorda,
- pots descarregar-la en **MIDI**,
- hi ha un formulari de **Contacte** (només a l'allotjament amb PHP; a GitHub Pages es mostra un enllaç a aquest),
- hi ha un **afinador de gralla** (botó «Afinador»): tries la nota (Sol greu, Do, Sol agut o qualsevol altra), actives el micròfon i una barra mostra la desviació en cents; és verda dins de ±10 cents,
- pots **imprimir-la** (botó «Imprimeix»): A5 apaisat, amb el títol i la vista, la veu i la transposició que tinguis seleccionades, per posar-la al faristol; la mida es tria sola (entre el 70 % i el 40 %) perquè tota la cançó càpiga, si pot ser, en un sol full,

Les digitacions surten de la taula de la gralla Bessó ([pacobesso.net](https://www.pacobesso.net)),
de Sol a Re agut. Per a Re♯ i La♯ es fa servir la posició normal.

## Obrir-la en local

Cal un petit servidor web (els mòduls JavaScript no funcionen obrint l'`index.html` directament):

```bash
python3 -m http.server 8765 --directory gralla-app
```

i obre <http://localhost:8765>.

## Llibreria de partitures

Les cançons són a `partitures/`: un fitxer `.musicxml` per veu i el catàleg `partitures/index.json`.

Cançó d'una sola veu:

```json
{ "id": "hereu-riera", "titol": "L'hereu Riera", "fitxer": "hereu-riera.musicxml",
  "categoria": "Repertori", "notes": "Tradicional" }
```

Cançó amb diverses veus (a la web es tria 1a gralla, 2a gralla o totes alhora). Totes les veus
han de tenir els mateixos compassos. El `id` d'una veu és opcional: serveix perquè un enllaç antic
com `#/polca-dours-2a-gralla` obri la cançó amb aquesta veu. El `fitxer` de fora (la 1a veu) és perquè
un navegador que encara tingui el JavaScript antic a la memòria cau pugui obrir la cançó igualment.

```json
{ "id": "gener", "titol": "Gener", "categoria": "Repertori", "notes": "Pasdoble",
  "fitxer": "gener.musicxml",
  "veus": [
    { "nom": "1a gralla", "fitxer": "gener.musicxml" },
    { "nom": "2a gralla", "fitxer": "gener-2a-gralla.musicxml" }
  ] }
```

Cada peça té un enllaç directe: `https://estevelg.github.io/gralla-app/#/<id>`. Per a una veu concreta:
`#/<id>/2` (2a gralla) o `#/<id>/totes` (totes alhora).

Per afegir-ne una: transcriure-la a MusicXML, desar-la a `partitures/`, afegir-la a `index.json` i fer push.
GitHub Pages s'actualitza sol en un parell de minuts.

## Publicar a GitHub Pages

**Abans de cada commit que toqui `css/` o `js/`, executa `python3 versiona.py`.** Posa una versió a les adreces
del CSS i dels mòduls a l'`index.html` (i un mapa d'importacions). Sense això, GitHub Pages deixa que el navegador
guardi 10 minuts els fitxers antics i la web es veu trencada (HTML nou amb estils o codi vell).

1. Puja aquesta carpeta a un repositori de GitHub.
2. *Settings → Pages → Build and deployment*: font **Deploy from a branch**, branca `main`, carpeta `/ (root)`.
3. En un parell de minuts la web serà a `https://<usuari>.github.io/<repositori>/`.

## Publicar a 100webspace (o un altre allotjament) a mà

```bash
./crea-zip.sh
```

Crea `~/Downloads/gralla-app-web.zip` amb només els fitxers de la web (`index.html`, `css/`, `js/`, `partitures/`).
Al Gestor de fitxers de l'allotjament: obre la carpeta pública (normalment `public_html`), esborra-hi la pàgina
per defecte, puja el ZIP i extreu-lo (els fitxers han de quedar directament dins la carpeta, no dins una subcarpeta).
L'afinador usa el micròfon, que els navegadors només permeten en **https**: comprova que l'adreça comença per `https://`.

## Formulari de contacte

`contacte.php` rep el formulari (`js/contacte.js`) i l'envia per correu amb `mail()`. Contra el spam: camp parany,
testimoni signat pel servidor (d'un sol ús, amb temps mínim i caducitat), màxim 1 enllaç, missatges repetits ignorats,
límit de 3 missatges/hora per IP i de 30 al dia en total, i neteja de capçaleres. **L'adreça de destí no és al repositori** (és públic): és a
`contacte-config.php`, que està a `.gitignore` i només existeix en local i al servidor (`crea-zip.sh` l'inclou al ZIP):

```php
<?php return ['destinatari' => 'tu@exemple.com', 'remitent' => 'no-reply@exemple.com', 'secret' => '<text aleatori de 32+ caràcters>'];
```

## Estructura

| Fitxer | Què fa |
| --- | --- |
| `js/fingerings.js` | Taula de digitacions (MIDI escrit → 7 forats) i notes on cal bufar més fort |
| `js/fingering-svg.js` | Dibuix d'una digitació |
| `js/musicxml.js` | Lectura de MusicXML/MXL, repeticions i caselles, D.S./D.C. al Fine, canvis de tempo, transposició |
| `js/render.js` | Pentagrama amb VexFlow + nom i digitació sota cada nota |
| `js/player.js` | Reproducció amb Web Audio (smplr, sons General MIDI) |
| `js/midi-export.js` | Exportació a fitxer MIDI |
| `js/afinador.js` | Afinador: detecció de la freqüència pel micròfon (YIN) i la seva interfície |
| `js/contacte.js`, `contacte.php` | Formulari de contacte (JS al navegador, PHP al servidor) |
| `js/library.js` | Llista de cançons, cercador i enllaços directes |
| `css/print.css` | Estils d'impressió (A5 apaisat, sempre en clar); la còpia per a paper es dibuixa a `preparePrint()` de `js/main.js` |
| `partitures/` | Llibreria de partitures i catàleg `index.json` |

Llibreries (per CDN): VexFlow 4, JSZip, smplr.
