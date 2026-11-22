// Formulari de contacte. Envia el missatge a contacte.php (PHP, només a l'allotjament propi).
// A GitHub Pages no hi ha PHP: allà es mostra un enllaç a la web que sí en té.

const HOST_AMB_PHP = /(^|\.)estevelopez\.com$/;
const ENDPOINT = 'contacte.php';

export function iniciaContacte() {
  const seccio = document.getElementById('contacte');
  const form = document.getElementById('contacte-form');
  const estat = document.getElementById('contacte-estat');
  const boto = document.getElementById('contacte-envia');
  if (!seccio || !form) return;

  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!HOST_AMB_PHP.test(location.hostname) && !local) {
    document.getElementById('contacte-enllac')?.removeAttribute('hidden');
    return;
  }
  seccio.hidden = false;
  if (location.hash === '#contacte') seccio.open = true;

  const diu = (text, tipus = '') => { estat.textContent = text; estat.className = `contacte-estat ${tipus}`.trim(); };
  // Moment en què s'ha obert el formulari: el PHP rebutja enviaments sospitosament ràpids (robots).
  const marca = () => { form.elements.t.value = String(Date.now()); };
  marca();
  seccio.addEventListener('toggle', () => { if (seccio.open) marca(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nom = form.elements.nom.value.trim();
    const email = form.elements.email.value.trim();
    const missatge = form.elements.missatge.value.trim();
    if (!nom) return diu('Escriu el teu nom.', 'ko');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return diu('El correu no sembla correcte.', 'ko');
    if (missatge.length < 10) return diu('El missatge és massa curt.', 'ko');

    boto.disabled = true;
    diu('Enviant…');
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', body: new FormData(form) });
      const dades = await res.json().catch(() => ({}));
      if (res.ok && dades.ok) {
        form.reset();
        marca();
        diu('Gràcies! He rebut el missatge i et respondré tan aviat com pugui.', 'ok');
      } else {
        diu(dades.error || "No s'ha pogut enviar el missatge. Torna-ho a provar d'aquí a una estona.", 'ko');
      }
    } catch {
      diu("No s'ha pogut enviar el missatge. Comprova la connexió i torna-ho a provar.", 'ko');
    } finally {
      boto.disabled = false;
    }
  });
}
