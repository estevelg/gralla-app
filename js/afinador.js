// Afinador de gralla: capta el so pel micròfon, en calcula la freqüència (algorisme YIN) i la
// compara amb la de la nota triada, en cents. La interfície és el <dialog id="afinador"> de l'index.html.

const NOM_NOTES = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
export const TOLERANCIA_CENTS = 10;   // dins d'aquest marge la nota es dona per afinada (barra verda)
export const RANG_BARRA_CENTS = 100;  // la barra va de −100 a +100 cents
const SEMITONS_RANG = 6;              // només es busca a ±6 semitons de la nota triada (evita errors d'octava)
const MIN_RMS = 0.008;                // per sota d'aquest volum es considera silenci

export const nomNota = (midi) => `${NOM_NOTES[midi % 12]}${Math.floor(midi / 12) - 1}`;
export const midiAHz = (midi, la = 440) => la * 2 ** ((midi - 69) / 12);
export const cents = (hz, referencia) => 1200 * Math.log2(hz / referencia);

/**
 * Freqüència d'un tros de so (algorisme YIN) buscant només al voltant de `objectiuHz`.
 * Retorna { hz, claredat, rms, satura }; `hz` és null si no hi ha un to net (silenci o soroll).
 */
export function detectaTo(buf, sampleRate, objectiuHz) {
  const n = buf.length;
  let suma = 0;
  let pic = 0;
  for (let i = 0; i < n; i++) {
    suma += buf[i] * buf[i];
    const a = Math.abs(buf[i]);
    if (a > pic) pic = a;
  }
  const rms = Math.sqrt(suma / n);
  const resultat = { hz: null, claredat: 0, rms, satura: pic >= 0.98 };
  if (rms < MIN_RMS) return resultat;

  const fMax = objectiuHz * 2 ** (SEMITONS_RANG / 12);
  const fMin = objectiuHz / 2 ** (SEMITONS_RANG / 12);
  const finestra = Math.floor(n / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / fMax));
  const tauMax = Math.min(Math.ceil(sampleRate / fMin) + 1, n - finestra - 1);
  if (tauMax <= tauMin + 2) return resultat;

  // Funció de diferència i diferència mitjana normalitzada acumulada (CMND).
  const cmnd = new Float32Array(tauMax + 2);
  cmnd[0] = 1;
  let acumulat = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let d = 0;
    for (let i = 0; i < finestra; i++) {
      const x = buf[i] - buf[i + tau];
      d += x * x;
    }
    acumulat += d;
    cmnd[tau] = acumulat > 0 ? (d * tau) / acumulat : 1;
  }

  // Primer mínim per sota del llindar; si no n'hi ha, el mínim absolut si és prou net.
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < 0.15) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau === -1) {
    let millor = tauMin;
    for (let t = tauMin; t <= tauMax; t++) if (cmnd[t] < cmnd[millor]) millor = t;
    if (cmnd[millor] > 0.3) return resultat;
    tau = millor;
  }

  // Interpolació parabòlica al voltant del mínim.
  const a = cmnd[tau - 1];
  const b = cmnd[tau];
  const c = cmnd[tau + 1];
  const denom = a - 2 * b + c;
  const tauFi = denom !== 0 ? tau + (a - c) / (2 * denom) : tau;

  resultat.hz = sampleRate / tauFi;
  resultat.claredat = 1 - b;
  return resultat;
}

// Color de l'agulla: verd dins la tolerància, i cap al vermell a mesura que s'allunya.
export function colorAgulla(c) {
  const t = Math.min(1, Math.max(0, (Math.abs(c) - TOLERANCIA_CENTS) / 35)); // vermell a partir de ~45 cents
  return `hsl(${Math.round(125 * (1 - t))} 70% 40%)`;
}

const mediana = (llista) => {
  const o = [...llista].sort((x, y) => x - y);
  return o[Math.floor(o.length / 2)];
};

/** Capta el micròfon i crida `alLlegir({ hz, cents, claredat, rms, satura })` uns 30 cops per segon. */
export class Afinador {
  constructor({ alLlegir }) {
    this.alLlegir = alLlegir;
    this.actiu = false;
  }

  async inicia(obteObjectiu) {
    if (this.actiu) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error('insegur'), { codi: 'insegur' });
    }
    this.flux = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const font = this.ctx.createMediaStreamSource(this.flux);
    this.analitzador = this.ctx.createAnalyser();
    this.analitzador.fftSize = 4096; // ~85 ms: finestra prou llarga per a una precisió de pocs cents
    font.connect(this.analitzador);
    this.buf = new Float32Array(this.analitzador.fftSize);
    this.recents = [];
    this.ultimaLectura = 0;
    this.actiu = true;
    const bucle = () => {
      if (!this.actiu) return;
      this.analitzador.getFloatTimeDomainData(this.buf);
      const objectiu = obteObjectiu();
      const r = detectaTo(this.buf, this.ctx.sampleRate, objectiu);
      const ara = performance.now();
      if (r.hz && r.claredat > 0.7) {
        this.recents.push(r.hz);
        if (this.recents.length > 5) this.recents.shift();
        this.ultimaLectura = ara;
        const hz = mediana(this.recents);
        this.alLlegir({ ...r, hz, cents: cents(hz, objectiu) });
      } else if (ara - this.ultimaLectura > 400) { // silenci o soroll: s'oblida la lectura anterior
        this.recents = [];
        this.alLlegir({ ...r, hz: null, cents: null });
      }
      this.rAF = requestAnimationFrame(bucle);
    };
    this.rAF = requestAnimationFrame(bucle);
  }

  atura() {
    this.actiu = false;
    cancelAnimationFrame(this.rAF);
    this.flux?.getTracks().forEach((t) => t.stop()); // apaga l'indicador de micròfon del navegador
    this.ctx?.close();
    this.flux = null;
    this.ctx = null;
  }
}

// ---------- Interfície ----------

const CLAU = 'gralla-afinador';
const SOL_GREU = 67;
const NOTES_RAPIDES = [67, 72, 79]; // Sol4, Do5, Sol5
const NOTES_SELECT = Array.from({ length: 20 }, (_, i) => 67 + i); // Sol4 … Re6

const fmtHz = (hz) => hz.toFixed(1).replace('.', ',');

export function iniciaAfinador({ alObrir } = {}) {
  const $ = (id) => document.getElementById(id);
  const dialeg = $('afinador');
  if (!dialeg || typeof dialeg.showModal !== 'function') {
    $('obre-afinador')?.remove(); // navegador sense <dialog>
    return;
  }
  const el = {
    obre: $('obre-afinador'),
    tanca: $('afinador-tanca'),
    xips: [...dialeg.querySelectorAll('[data-midi]')],
    altra: $('afinador-altra'),
    la: $('afinador-la'),
    cents: $('afinador-cents'),
    hz: $('afinador-hz'),
    estat: $('afinador-estat'),
    barra: $('afinador-barra'),
    agulla: $('afinador-agulla'),
    centre: $('afinador-centre'),
    mic: $('afinador-mic'),
  };

  const estat = { midi: SOL_GREU, la: 440 };
  try {
    const desat = JSON.parse(localStorage.getItem(CLAU) || '{}');
    if (NOTES_SELECT.includes(desat.midi)) estat.midi = desat.midi;
    if (desat.la >= 430 && desat.la <= 450) estat.la = desat.la;
  } catch { /* sense emmagatzematge: valors per defecte */ }
  const desa = () => { try { localStorage.setItem(CLAU, JSON.stringify(estat)); } catch { /* no es pot desar */ } };

  const objectiu = () => midiAHz(estat.midi, estat.la);

  el.altra.innerHTML = NOTES_SELECT.map((m) => `<option value="${m}">${nomNota(m)}</option>`).join('');

  const dibuixaObjectiu = () => {
    el.xips.forEach((x) => x.setAttribute('aria-checked', String(Number(x.dataset.midi) === estat.midi)));
    el.altra.value = String(estat.midi);
    el.la.value = String(estat.la);
    el.centre.textContent = `${nomNota(estat.midi)} · ${fmtHz(objectiu())} Hz`;
  };

  const diuEstat = (text, classe = '') => {
    el.estat.textContent = text;
    el.estat.className = `afinador-estat ${classe}`.trim();
  };

  const reposa = () => {
    el.agulla.hidden = true;
    el.cents.textContent = '—';
    el.cents.style.color = '';
    el.hz.textContent = '';
    el.barra.classList.remove('afinada');
  };

  const alLlegir = (r) => {
    if (r.hz === null) {
      reposa();
      diuEstat(r.satura ? 'El so satura: allunya una mica el micròfon.' : 'Toca la nota…');
      return;
    }
    const c = r.cents;
    const pos = Math.max(-RANG_BARRA_CENTS, Math.min(RANG_BARRA_CENTS, c));
    const color = colorAgulla(c);
    el.agulla.hidden = false;
    el.agulla.style.left = `${50 + (pos / (2 * RANG_BARRA_CENTS)) * 100}%`;
    el.agulla.style.background = color;
    el.cents.textContent = `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(Math.round(c))} cents`;
    el.cents.style.color = color;
    el.hz.textContent = `${fmtHz(r.hz)} Hz · objectiu ${fmtHz(objectiu())} Hz`;
    const afinada = Math.abs(c) <= TOLERANCIA_CENTS;
    el.barra.classList.toggle('afinada', afinada);
    if (afinada) diuEstat('Afinada ✔', 'ok');
    else if (c > 0) diuEstat('Massa aguda: baixa el to.', 'desafinada');
    else diuEstat('Massa greu: puja el to.', 'desafinada');
  };

  const afinador = new Afinador({ alLlegir });

  const aturaMic = () => {
    afinador.atura();
    el.mic.textContent = 'Activa el micròfon';
    el.mic.classList.remove('sonant');
    reposa();
  };

  el.mic.addEventListener('click', async () => {
    if (afinador.actiu) {
      aturaMic();
      diuEstat('Micròfon aturat.');
      return;
    }
    try {
      diuEstat('Esperant el permís del micròfon…');
      await afinador.inicia(objectiu);
      el.mic.textContent = 'Atura el micròfon';
      el.mic.classList.add('sonant');
      diuEstat('Toca la nota…');
    } catch (err) {
      const missatge = {
        insegur: "Aquest navegador no permet usar el micròfon en aquesta pàgina (cal una connexió segura, https).",
        NotAllowedError: "No tinc permís per al micròfon. Permet-lo a la barra d'adreces del navegador i torna-ho a provar.",
        NotFoundError: "No s'ha trobat cap micròfon.",
      }[err.codi || err.name] || "No s'ha pogut activar el micròfon.";
      diuEstat(missatge, 'error');
    }
  });

  el.xips.forEach((x) => x.addEventListener('click', () => {
    estat.midi = Number(x.dataset.midi);
    desa();
    dibuixaObjectiu();
  }));
  el.altra.addEventListener('change', () => {
    estat.midi = Number(el.altra.value);
    desa();
    dibuixaObjectiu();
  });
  el.la.addEventListener('change', () => {
    const la = Math.round(Number(el.la.value));
    estat.la = Math.min(450, Math.max(430, Number.isFinite(la) ? la : 440));
    desa();
    dibuixaObjectiu();
  });

  el.obre.addEventListener('click', () => {
    alObrir?.();
    dibuixaObjectiu();
    reposa();
    diuEstat('Tria la nota, activa el micròfon i bufa-la.');
    dialeg.showModal();
  });
  const tanca = () => { dialeg.close(); aturaMic(); }; // s'apaga el micròfon sense esperar l'esdeveniment «close»
  el.tanca.addEventListener('click', tanca);
  dialeg.addEventListener('close', aturaMic);          // tancar amb Esc també apaga el micròfon
  dialeg.addEventListener('click', (e) => { if (e.target === dialeg) tanca(); }); // clic fora del quadre
}
