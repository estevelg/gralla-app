<?php
// Formulari de contacte (js/contacte.js): GET ?token=1 dona un testimoni signat; POST envia el missatge per correu.
// L'adreça de destí i la clau secreta NO són aquí (el repositori és públic): són a contacte-config.php, que només
// existeix al servidor i en local (està a .gitignore). Format:
//   <?php return ['destinatari' => 'tu@exemple.com', 'remitent' => 'no-reply@exemple.com', 'secret' => '<text aleatori de 32+ caràcters>'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
mb_internal_encoding('UTF-8');

const MAX_PER_IP_HORA = 3;
const MAX_TOTAL_DIA = 30;
const TEMPS_MIN = 4;           // segons que ha de trigar a omplir-se el formulari
const TEMPS_MAX = 6 * 3600;    // el testimoni caduca

function respon(int $codi, array $dades): void {
    http_response_code($codi);
    echo json_encode($dades, JSON_UNESCAPED_UNICODE);
    exit;
}

$config = @include __DIR__ . '/contacte-config.php';
if (!is_array($config) || empty($config['destinatari']) || empty($config['remitent']) || strlen((string)($config['secret'] ?? '')) < 32) {
    error_log('contacte.php: falta o és incomplet contacte-config.php');
    respon(500, ['ok' => false, 'error' => 'El formulari no està configurat. Torna-ho a provar més tard.']);
}
$signa = static fn(string $ts): string => hash_hmac('sha256', $ts, $config['secret']);

$metode = $_SERVER['REQUEST_METHOD'] ?? '';
if ($metode === 'GET' && isset($_GET['token'])) {
    $ts = (string)time();
    respon(200, ['ok' => true, 'token' => $ts . '.' . $signa($ts)]);
}
if ($metode !== 'POST') {
    respon(405, ['ok' => false, 'error' => 'Mètode no permès.']);
}

// Anti-spam 1: camp parany (els humans no el veuen). Es respon "ok" perquè el robot no ho torni a provar.
if (trim((string)($_POST['web'] ?? '')) !== '') {
    respon(200, ['ok' => true]);
}

// Anti-spam 2: testimoni signat pel servidor, de temps mínim i màxim. No es pot inventar ni reutilitzar.
$ara = time();
$part = explode('.', (string)($_POST['t'] ?? ''), 2);
$ts = $part[0] ?? '';
$sig = $part[1] ?? '';
if (!ctype_digit($ts) || $sig === '' || !hash_equals($signa($ts), $sig)) {
    respon(400, ['ok' => false, 'error' => 'La sessió del formulari no és vàlida. Recarrega la pàgina i torna-ho a provar.']);
}
$edat = $ara - (int)$ts;
if ($edat < TEMPS_MIN) respon(400, ['ok' => false, 'error' => 'Espera un moment i torna a enviar el missatge.']);
if ($edat > TEMPS_MAX) respon(400, ['ok' => false, 'error' => 'El formulari ha caducat. Recarrega la pàgina i torna-ho a provar.']);

// Neteja: res de salts de línia als camps que van a les capçaleres del correu (injecció de capçaleres).
$una_linia = static fn(string $s): string => trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s));
$nom = mb_substr($una_linia((string)($_POST['nom'] ?? '')), 0, 100);
$email = mb_substr($una_linia((string)($_POST['email'] ?? '')), 0, 150);
$missatge = trim(str_replace("\0", '', (string)($_POST['missatge'] ?? '')));

if ($nom === '') respon(400, ['ok' => false, 'error' => 'Escriu el teu nom.']);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respon(400, ['ok' => false, 'error' => 'El correu no sembla correcte.']);
if (mb_strlen($missatge) < 10) respon(400, ['ok' => false, 'error' => 'El missatge és massa curt.']);
if (mb_strlen($missatge) > 3000) respon(400, ['ok' => false, 'error' => 'El missatge és massa llarg (màxim 3000 caràcters).']);
// Anti-spam 3: el spam sol dur enllaços; un missatge normal de contacte rarament en necessita més d'un.
if (preg_match_all('~https?://|www\.~i', $missatge . ' ' . $nom) > 1) {
    respon(400, ['ok' => false, 'error' => 'El missatge té massa enllaços.']);
}

// Anti-spam 4: límits compartits (per IP i total diari), testimoni d'un sol ús i missatges repetits.
// L'estat es desa a la carpeta temporal del servidor, amb bloqueig per evitar curses.
function amb_estat(callable $f) {
    $fh = fopen(sys_get_temp_dir() . '/gralla-contacte-estat.json', 'c+');
    if (!$fh) { $buit = ['enviats' => [], 'tokens' => [], 'ip' => [], 'missatges' => []]; return $f($buit); }
    flock($fh, LOCK_EX);
    $estat = json_decode((string)stream_get_contents($fh), true);
    $estat = is_array($estat) ? $estat : [];
    $estat += ['enviats' => [], 'tokens' => [], 'ip' => [], 'missatges' => []];
    $res = $f($estat);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($estat));
    flock($fh, LOCK_UN);
    fclose($fh);
    return $res;
}

$ip = sha1($_SERVER['REMOTE_ADDR'] ?? 'x');
$empremta = sha1(mb_strtolower($email . '|' . preg_replace('/\s+/u', ' ', $missatge)));
$resultat = amb_estat(function (array &$e) use ($ara, $ip, $sig, $empremta) {
    $dia = $ara - 86400;
    $hora = $ara - 3600;
    $e['enviats'] = array_values(array_filter($e['enviats'], static fn($x) => $x > $dia));
    $e['tokens'] = array_filter($e['tokens'], static fn($x) => $x > $dia);
    $e['missatges'] = array_filter($e['missatges'], static fn($x) => $x > $dia);
    $e['ip'] = array_filter(array_map(static fn($l) => array_values(array_filter($l, static fn($x) => $x > $hora)), $e['ip']));

    if (isset($e['tokens'][$sig])) return 'reutilitzat';
    if (isset($e['missatges'][$empremta])) return 'repetit';
    if (count($e['ip'][$ip] ?? []) >= MAX_PER_IP_HORA) return 'ip';
    if (count($e['enviats']) >= MAX_TOTAL_DIA) return 'dia';

    $e['tokens'][$sig] = $ara;
    $e['missatges'][$empremta] = $ara;
    $e['ip'][$ip][] = $ara;
    $e['enviats'][] = $ara;
    return 'ok';
});
if ($resultat === 'repetit') respon(200, ['ok' => true]); // ja rebut: no es reenvia
if ($resultat === 'reutilitzat') respon(400, ['ok' => false, 'error' => 'Recarrega la pàgina per enviar un altre missatge.']);
if ($resultat === 'ip') respon(429, ['ok' => false, 'error' => "Has enviat massa missatges. Torna-ho a provar d'aquí a una hora."]);
if ($resultat === 'dia') respon(429, ['ok' => false, 'error' => "El formulari ha arribat al límit d'avui. Torna-ho a provar demà."]);

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
respon(200, ['ok' => true]);
