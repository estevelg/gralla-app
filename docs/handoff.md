# Handoff: estat de la web i coses pendents

Resum per continuar en una conversa nova. Actualitza'l quan canviï l'estat.

**Estat a 23-11-2026** (darrer commit a `main`: `685f94d`, també publicat a estevelopez.com/gralla-app i
verificat byte a byte).

**Publicació**
- GitHub Pages (`main`): https://estevelg.github.io/gralla-app/
- 100webspace: https://www.estevelopez.com/gralla-app/ (amb el formulari de contacte en PHP).
- Sense el Mac, Claude genera el ZIP (`./crea-zip.sh <destí>`), l'envia i l'Esteve el puja i l'extreu
  sobreescrivint. El ZIP no porta `contacte-config.php`, i el del servidor es manté.
- L'entorn al núvol «Esteve» permet `estevelopez.com`, per comprovar la web publicada amb `curl` i `cmp`
  contra els fitxers del repositori.
- Claude **no** té accés al Chrome de l'Esteve des del núvol.

**Repertori (14 cançons)**
- Amb 2 veus: Polca d'ours, Ball de gegants de l'Empordà, El Gegant del Pi, Roseta de Gironella, Cercavila: El
  circ, Cercavila: Vermut Barcelona, Gener, L'Ailalà (Mi-la-la).
- D'una veu: La presó del rei de França, L'hereu Riera, Febrer, No volem ser, Passi-ho bé, Bella ciao.
- **Pendents de revisar per l'Esteve:**
  - Gener: la 2a veu, sobretot els compassos 20-22, perquè l'escaneig era de baixa resolució.
  - L'Ailalà: la 2a veu, compassos 11-14.
  - La presó del rei de França: el començament de les caselles 1a i 2a.
  - `tipus` només a 7 cançons; el fa servir el cercador.

**Darrers canvis d'interfície (fase 1 del pla, feta)**
- Ordinador:
  - barra lateral amb la llista i el cercador;
  - el requadre de benvinguda, alineat amb la primera cançó;
  - l'etiqueta BETA, que reposa sobre la línia de base del títol.
- Mòbil vertical:
  - la llista i la cançó són dues vistes («← Cançons»);
  - la partitura té zoom amb A−/A+;
  - la barra del reproductor es plega quan toca dalt de la pantalla i «Opcions» la torna a obrir;
  - ♩ = 120 va al costat de la velocitat.
- Mòbil apaisat (alçada ≤ 500 px): sense capçalera, barra d'una fila i les opcions en un panell flotant.
- Opcions avançades (transposar): només amb una cançó oberta.
- Tret expressament: exercicis, nivell de dificultat, carregar un MusicXML propi, filtres per tipus i
  l'atribució a la gralla Bessó.

**Idees pendents (no demanades encara)**
- Fase 2 del pla (`docs/pla-ampliacio.md`) quan arribin colles: `colles.json`, versions per colla, pàgina
  `#/colla/<id>` i `valida.py`.
- Comentaris del codi que encara citen la gralla Bessó (`js/fingerings.js`, `js/fingering-svg.js`): l'Esteve
  no ha dit si els vol treure.
- El formulari de contacte no s'ha provat enviant un missatge real (`contacte-estat.php` encara no existeix al
  servidor; es crea amb el primer missatge).
