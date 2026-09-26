// Dibuix vertical d'una digitació: polze (darrere) a dalt a l'esquerra,
// tres forats de la mà esquerra, separació, tres forats de la mà dreta.

import { HOLES } from './fingerings.js';

const W = 32;
const H = 132;
const CX = 18;
const R = 6;
const POS = [
  [7, 11],          // polze
  [CX, 34], [CX, 49], [CX, 64],
  [CX, 87], [CX, 102], [CX, 117],
];
const BODY = `<rect class="f-cos" x="${CX - 10}" y="22" width="20" height="106" rx="10"/>`;

function hole([x, y], value, label) {
  const title = `<title>${label}: ${value === 1 ? 'tancat' : value === 0 ? 'obert' : 'mig forat'}</title>`;
  if (value === 1) {
    return `<circle class="f-tancat" cx="${x}" cy="${y}" r="${R}">${title}</circle>`;
  }
  const ring = `<circle class="f-obert" cx="${x}" cy="${y}" r="${R}"/>`;
  if (value === 0) return `<g>${title}${ring}</g>`;
  // Mig forat: meitat esquerra tapada, com a la taula Bessó.
  const half = `<path class="f-tancat" d="M${x},${y - R} A${R},${R} 0 0 0 ${x},${y + R} Z"/>`;
  return `<g>${title}${ring}${half}</g>`;
}

export function fingeringSVG(fingering, { size = 1 } = {}) {
  const w = W * size;
  const h = H * size;
  if (!fingering) {
    return `<svg class="digitacio buida" viewBox="0 0 ${W} ${H}" width="${w}" height="${h}" aria-label="Sense digitació">
      ${BODY}
      <text class="f-interrogant" x="${CX}" y="82" text-anchor="middle">?</text>
    </svg>`;
  }
  const holes = fingering.holes.map((v, i) => hole(POS[i], v, HOLES[i].label)).join('');
  return `<svg class="digitacio" viewBox="0 0 ${W} ${H}" width="${w}" height="${h}" role="img" aria-label="Digitació">
    ${BODY}
    <line class="f-separa" x1="${CX - 10}" x2="${CX + 10}" y1="75.5" y2="75.5"/>
    ${holes}
  </svg>`;
}
