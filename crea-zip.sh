#!/bin/sh
# Crea un ZIP amb només els fitxers de la web, per pujar-lo a un allotjament manualment (p. ex. 100webspace).
# Ús:  ./crea-zip.sh [destí.zip]      (per defecte: ~/Downloads/gralla-app-web.zip)
set -e
cd "$(dirname "$0")"
python3 versiona.py                       # posa la versió actual a les adreces del CSS i del JS
dest="${1:-$HOME/Downloads/gralla-app-web.zip}"
rm -f "$dest"
zip -r -X -q "$dest" index.html css js partitures -x '*.DS_Store'
echo "ZIP creat: $dest"
unzip -l "$dest" | tail -1
