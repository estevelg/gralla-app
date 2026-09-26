// Escriptura d'un fitxer MIDI estàndard (format 0, una pista).

const PPQ = 480;
const PROGRAMS = { shanai: 111, oboe: 68, recorder: 74 }; // General MIDI (0-based)

function varLen(n) {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}

export function buildMidi(events, tempoBpm, instrument = 'shanai', title = '') {
  const msgs = []; // [tick, bytes]
  const usPerQ = Math.round(60000000 / tempoBpm);
  const name = [...new TextEncoder().encode(title.slice(0, 100))];
  msgs.push([0, [0xff, 0x03, ...varLen(name.length), ...name]]);
  msgs.push([0, [0xff, 0x51, 0x03, (usPerQ >> 16) & 0xff, (usPerQ >> 8) & 0xff, usPerQ & 0xff]]);
  msgs.push([0, [0xc0, PROGRAMS[instrument] ?? 111]]);
  for (const s of events.sounds) {
    const on = Math.round(s.start * PPQ);
    const off = Math.max(on + 1, Math.round((s.start + s.dur) * PPQ) - 12);
    msgs.push([on, [0x90, s.midi, 100]]);
    msgs.push([off, [0x80, s.midi, 0]]);
  }
  // Els note-off abans dels note-on quan coincideixen en el temps.
  msgs.sort((a, b) => a[0] - b[0] || (a[1][0] === 0x80 ? -1 : 0) - (b[1][0] === 0x80 ? -1 : 0));

  const track = [];
  let last = 0;
  for (const [tick, bytes] of msgs) {
    track.push(...varLen(tick - last), ...bytes);
    last = tick;
  }
  track.push(0, 0xff, 0x2f, 0x00);

  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (PPQ >> 8) & 0xff, PPQ & 0xff];
  const len = track.length;
  const trackHeader = [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff];
  return new Uint8Array([...header, ...trackHeader, ...track]);
}

export function downloadMidi(bytes, filename) {
  const blob = new Blob([bytes], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
