<?php
// Rep el formulari de contacte (js/contacte.js) i l'envia per correu.
// L'adreça de destí NO és aquí (el repositori és públic): és a contacte-config.php, que només existeix al servidor
// i en local (està a .gitignore). Format:  <?php return ['destinatari' => 'tu@exemple.com', 'remitent' => 'no-reply@exemple.com'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
mb_internal_encoding('UTF-8');

function respon(int $codi, array $dades): void {
    http_response_code($codi);
    echo json_encode($dades, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respon(405, ['ok' => false, 'error' => 'Mètode no permès.']);
}

$config = @include __DIR__ . '/contacte-config.php';
if (!is_array($config) || empty($config['destinatari']) || empty($config['remitent'])) {
    error_log('contacte.php: falta contacte-config.php');
    respon(500, ['ok' => false, 'error' => 'El formulari no està configurat. Torna-ho a provar més tard.']);
}

// Anti-spam 1: camp parany (els humans no el veuen) i temps mínim/màxim d'omplir el formulari.
if (trim((string)($_POST['web'] ?? '')) !== '') {
    respon(200, ['ok' => true]); // fem veure que ha anat bé perquè el robot no ho torni a provar
}
$t = (int)(($_POST['t'] ?? 0) / 1000);
$ara = time();
if ($t <= 0 || $ara - $t < 3 || $ara - $t > 6 * 3600) {
    respon(400, ['ok' => false, 'error' => 'Espera un moment i torna a enviar el missatge.']);
}

// Neteja: res de salts de línia als camps que van a les capçaleres del correu (injecció de capçaleres).
$una_linia = static fn(string $s): string => trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s));
$nom = mb_substr($una_linia((string)($_POST['nom'] ?? '')), 0, 100);
$email = mb_substr($una_linia((string)($_POST['email'] ?? '')), 0, 150);
$missatge = trim(str_replace("\0", '', (string)($_POST['missatge'] ?? '')));

if ($nom === '') respon(400, ['ok' => false, 'error' => 'Escriu el teu nom.']);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respon(400, ['ok' => false, 'error' => 'El correu no sembla correcte.']);
if (mb_strlen($missatge) < 10) respon(400, ['ok' => false, 'error' => 'El missatge és massa curt.']);
if (mb_strlen($missatge) > 3000) respon(400, ['ok' => false, 'error' => 'El missatge és massa llarg (màxim 3000 caràcters).']);
// Anti-spam 2: massa enllaços.
if (preg_match_all('~https?://~i', $missatge) > 2) respon(400, ['ok' => false, 'error' => 'El missatge té massa enllaços.']);

// Anti-spam 3: com a màxim 3 missatges per hora des de la mateixa IP.
$fitxer = sys_get_temp_dir() . '/gralla-contacte-' . sha1($_SERVER['REMOTE_ADDR'] ?? 'x') . '.json';
$historial = [];
if (is_file($fitxer)) {
    $historial = json_decode((string)@file_get_contents($fitxer), true);
    $historial = is_array($historial) ? array_values(array_filter($historial, static fn($x) => is_int($x) && $x > $ara - 3600)) : [];
}
if (count($historial) >= 3) {
    respon(429, ['ok' => false, 'error' => 'Has enviat massa missatges. Torna-ho a provar d\'aquí a una hora.']);
}

$assumpte = mb_encode_mimeheader('[Gralla app] Missatge de ' . $nom, 'UTF-8', 'B', "\r\n");
$cos = "Nom: $nom\nCorreu: $email\n\n$missatge\n";
$capcaleres = [
    'From: ' . mb_encode_mimeheader('Que sonin les gralles', 'UTF-8', 'B', "\r\n") . ' <' . $config['remitent'] . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];

if (!mail($config['destinatari'], $assumpte, $cos, implode("\r\n", $capcaleres))) {
    error_log('contacte.php: mail() ha fallat');
    respon(500, ['ok' => false, 'error' => "No s'ha pogut enviar el missatge. Torna-ho a provar d'aquí a una estona."]);
}

$historial[] = $ara;
@file_put_contents($fitxer, json_encode($historial), LOCK_EX);
respon(200, ['ok' => true]);
