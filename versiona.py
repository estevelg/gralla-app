#!/usr/bin/env python3
"""Posa una versió a les adreces dels fitxers CSS i JS de l'index.html.

GitHub Pages deixa que el navegador guardi cada fitxer 10 minuts. Si es publica un canvi, pot passar
que el navegador tingui l'HTML nou però l'estil o els mòduls antics (la web es veu trencada). Amb una
versió que canvia cada cop que canvia el codi, els fitxers nous tenen una adreça nova i no hi ha barreja.

Executeu-lo abans de cada commit que toqui css/ o js/:   python3 versiona.py
"""
import hashlib
import pathlib
import re

arrel = pathlib.Path(__file__).resolve().parent
fitxers = sorted(list((arrel / 'css').glob('*.css')) + list((arrel / 'js').glob('*.js')))
h = hashlib.sha1()
for f in fitxers:
    h.update(f.name.encode())
    h.update(f.read_bytes())
versio = h.hexdigest()[:8]

html = (arrel / 'index.html').read_text()
html = re.sub(r'(href="css/[\w.-]+\.css)(\?v=[0-9a-f]+)?"', rf'\1?v={versio}"', html)
html = re.sub(r'(src="js/main\.js)(\?v=[0-9a-f]+)?"', rf'\1?v={versio}"', html)

# Mapa d'importacions: cada mòdul que importa main.js (i els que aquests importen) es demana amb versió.
entrades = ',\n      '.join(
    f'"./js/{f.name}": "./js/{f.name}?v={versio}"'
    for f in sorted((arrel / 'js').glob('*.js')) if f.name != 'main.js'
)
mapa = f'<script type="importmap">\n  {{\n    "imports": {{\n      {entrades}\n    }}\n  }}\n  </script>'
html, n = re.subn(r'<!-- importmap:inici -->.*?<!-- importmap:fi -->',
                  lambda _: f'<!-- importmap:inici -->\n  {mapa}\n  <!-- importmap:fi -->', html, flags=re.S)
assert n == 1, "falten les marques importmap:inici / importmap:fi a l'index.html"
(arrel / 'index.html').write_text(html)
print(f'versió {versio} aplicada a index.html ({len(fitxers)} fitxers)')
