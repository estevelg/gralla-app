// Taula de digitació de la gralla Bessó (www.pacobesso.net), notació de gralla.
// Ordre dels forats: polze (darrere), mà esquerra (índex, cor, anular),
// mà dreta (índex, cor, anular).  1 = tancat, 0 = obert, 0.5 = mig forat.
// Re#5 i La#5 tenen dues posicions a la taula: aquí només hi ha la normal (1).

export const HOLES = [
  { id: 'polze', label: 'Polze (darrere)', hand: 'esquerra' },
  { id: 'e-index', label: 'Índex esquerre', hand: 'esquerra' },
  { id: 'e-cor', label: 'Cor esquerre', hand: 'esquerra' },
  { id: 'e-anular', label: 'Anular esquerre', hand: 'esquerra' },
  { id: 'd-index', label: 'Índex dret', hand: 'dreta' },
  { id: 'd-cor', label: 'Cor dret', hand: 'dreta' },
  { id: 'd-anular', label: 'Anular dret', hand: 'dreta' },
];

// Clau: alçada MIDI escrita (Sol4 = 67).
const TABLE = {
  67: [1, 1, 1, 1, 1, 1, 1],   // Sol
  68: [1, 1, 1, 1, 1, 1, .5],  // Sol#
  69: [1, 1, 1, 1, 1, 1, 0],   // La
  70: [1, 1, 1, 1, 1, .5, 0],  // La#
  71: [1, 1, 1, 1, 1, 0, 0],   // Si
  72: [1, 1, 1, 1, 0, 0, 0],   // Do
  73: [1, 1, 1, 0, 1, 0, 0],   // Do#
  74: [1, 1, 1, 0, 0, 0, 0],   // Re
  75: [1, 1, 0, 1, 0, 0, 0],   // Re#  (posició normal)
  76: [1, 1, 0, 0, 0, 0, 0],   // Mi
  77: [0, 1, 0, 0, 0, 0, 0],   // Fa
  78: [1, 0, 1, 0, 0, 0, 0],   // Fa#
  79: [0, 0, 0, 0, 0, 0, 0],   // Sol
  80: [1, 1, 1, 1, 1, 1, .5],  // Sol#  ─┐
  81: [1, 1, 1, 1, 1, 1, 0],   // La     │
  82: [1, 1, 1, 1, 1, .5, 0],  // La#    │ bufar amb
  83: [1, 1, 1, 1, 1, 0, 0],   // Si     │ més pressió
  84: [1, 1, 1, 1, 0, 0, 0],   // Do     │
  85: [1, 1, 1, 0, 1, 0, 0],   // Do#    │
  86: [1, 1, 1, 0, 0, 0, 0],   // Re    ─┘
};

// A partir de Sol#5 cal bufar amb més pressió (registre agut).
const OVERBLOW_FROM = 80;

export const LOWEST = 67;
export const HIGHEST = 86;

// Diferència en semitons entre la notació de gralla i el so real.
// A la taula Bessó els dos pentagrames ("Notació de gralla" i "So real") coincideixen.
export const SO_REAL = 0;

export function getFingering(writtenMidi) {
  const holes = TABLE[writtenMidi];
  if (!holes) return null;
  return { holes, overblow: writtenMidi >= OVERBLOW_FROM };
}

export function inRange(writtenMidi) {
  return writtenMidi in TABLE;
}
