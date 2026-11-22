#!/bin/sh
# Crea un ZIP amb només els fitxers de la web, per pujar-lo a un allotjament manualment (p. ex. 100webspace).
# Ús:  ./crea-zip.sh [destí.zip]      (per defecte: ~/Downloads/gralla-app-web.zip)
set -e
cd "$(dirname "$0")"
python3 versiona.py                       # posa la versió actual a les adreces del CSS i del JS
dest="${1:-$HOME/Downloads/gralla-app-web.zip}"
rm -f "$dest"
extra=""
[ -f contacte.php ] && extra="contacte.php"
[ -f contacte-config.php ] && extra="$extra contacte-config.php"   # l'adreça de destí del formulari (no és a GitHub)
# shellcheck disable=SC2086
zip -r -X -q "$dest" index.html css js partitures $extra -x '*.DS_Store'
echo "ZIP creat: $dest"
unzip -l "$dest" | tail -1
