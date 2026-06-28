<?php
// VoiceDeal — front controller (PHP, geschikt voor Combell/shared hosting).
// Routing via ?action=... zodat er geen URL-rewriting (.htaccess) nodig is.
declare(strict_types=1);

require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/teamleader.php';
require __DIR__ . '/lib/claude.php';
require __DIR__ . '/lib/dashboard.php';
require __DIR__ . '/lib/ui.php';

// --- Configuratie laden ------------------------------------------------------
$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    echo '<p>Configuratie ontbreekt: kopieer <code>config.example.php</code> naar '
        . '<code>config.php</code> en vul je gegevens in.</p>';
    exit;
}
$config = require $configFile;

// --- Sessie ------------------------------------------------------------------
$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'secure'   => $secure,
    'samesite' => 'Lax',
]);
session_start();

// --- Hulpfuncties ------------------------------------------------------------
function vd_base_url(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $scheme = $https ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $path = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
    return $scheme . '://' . $host . $path;
}
function vd_redirect_uri(): string
{
    return vd_base_url() . '?action=oauth_callback';
}
function vd_go(string $to): void
{
    header('Location: ' . $to);
    exit;
}
function vd_json($obj, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($obj);
    exit;
}

// Welke verplichte instellingen ontbreken nog?
function vd_missing_config(array $config): array
{
    $missing = [];
    foreach (['TL_CLIENT_ID', 'TL_CLIENT_SECRET', 'ANTHROPIC_API_KEY', 'APP_PASSWORD'] as $k) {
        if (empty($config[$k]) || $config[$k] === 'VUL_IN') {
            $missing[] = $k;
        }
    }
    return $missing;
}

// Bouwt een lijst van zelfdiagnose-checks voor de statuspagina.
function vd_diagnostics(array $config): array
{
    $checks = [];
    $checks[] = ['PHP-versie', true, PHP_VERSION];
    $checks[] = ['cURL beschikbaar', function_exists('curl_init'), function_exists('curl_init') ? 'ja' : 'ontbreekt — vraag Combell om de cURL-extensie'];

    $missing = vd_missing_config($config);
    $checks[] = ['Instellingen (config.php) volledig', empty($missing), empty($missing) ? 'alles ingevuld' : 'nog invullen: ' . implode(', ', $missing)];

    $dataDir = __DIR__ . '/data';
    $writable = is_dir($dataDir) && is_writable($dataDir);
    $checks[] = ['Map data/ schrijfbaar', $writable, $writable ? 'ok' : 'geef de map data/ schrijfrechten (755/775)'];

    if (!in_array('ANTHROPIC_API_KEY', $missing, true)) {
        [$ok, $why] = claude_ping($config);
        $checks[] = ['Anthropic-key werkt', $ok, $ok ? 'ok' : $why];
    } else {
        $checks[] = ['Anthropic-key werkt', false, 'eerst API-key invullen'];
    }

    $connected = tl_is_connected();
    $checks[] = ['Verbonden met Teamleader', $connected, $connected ? 'ja' : 'nog op "Verbind met Teamleader" klikken'];

    return $checks;
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// --- Login / logout ----------------------------------------------------------
if ($action === 'login' && $method === 'POST') {
    if (vd_check_password($config, $_POST['password'] ?? '')) {
        $_SESSION['vd_authed'] = true;
        vd_go(vd_base_url());
    }
    echo vd_login_page('Onjuiste toegangscode.');
    exit;
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    vd_go(vd_base_url());
}

// --- Inlogcheck voor alles hieronder ----------------------------------------
if (!vd_is_logged_in()) {
    if ($action === 'process') {
        vd_json(['error' => 'Niet ingelogd.'], 401);
    }
    echo vd_login_page('');
    exit;
}

// --- Statuspagina (zelfdiagnose) --------------------------------------------
if ($action === 'status') {
    echo vd_status_page(vd_diagnostics($config), vd_base_url());
    exit;
}

// --- Dashboard (kmo-cijfers uit Teamleader) ---------------------------------
if ($action === 'dashboard') {
    if (!tl_is_connected()) {
        echo vd_dashboard_page(['connected' => false], vd_base_url());
        exit;
    }
    try {
        $data = dash_collect($config);
    } catch (Exception $e) {
        $msg = $e->getMessage() === 'NOT_CONNECTED'
            ? 'Teamleader-verbinding verlopen. Verbind opnieuw.'
            : $e->getMessage();
        $data = ['connected' => true, 'notes' => ['Dashboard kon niet laden: ' . $msg]];
    }
    echo vd_dashboard_page($data, vd_base_url());
    exit;
}

// --- Teamleader OAuth --------------------------------------------------------
if ($action === 'oauth_start') {
    if (empty($config['TL_CLIENT_ID']) || $config['TL_CLIENT_ID'] === 'VUL_IN') {
        echo '<p>Configuratie onvolledig: <code>TL_CLIENT_ID</code> staat nog niet in config.php.</p>';
        exit;
    }
    $state = bin2hex(random_bytes(16));
    $_SESSION['oauth_state'] = $state;
    vd_go(tl_authorize_url($config, vd_redirect_uri(), $state));
}

if ($action === 'oauth_callback') {
    $code  = $_GET['code'] ?? '';
    $state = $_GET['state'] ?? '';
    if ($code === '') {
        echo '<p>Teamleader gaf geen autorisatiecode terug. <a href="' . htmlspecialchars(vd_base_url()) . '">Terug</a></p>';
        exit;
    }
    if ($state === '' || $state !== ($_SESSION['oauth_state'] ?? '')) {
        echo '<p>Ongeldige state bij OAuth-callback (mogelijk verlopen). <a href="?action=oauth_start">Opnieuw proberen</a></p>';
        exit;
    }
    try {
        tl_exchange_code($config, $code, vd_redirect_uri());
    } catch (Exception $e) {
        echo '<p>Verbinden met Teamleader mislukt:</p><pre>' . htmlspecialchars($e->getMessage()) . '</pre>'
            . '<p><a href="' . htmlspecialchars(vd_base_url()) . '">Terug</a></p>';
        exit;
    }
    vd_go(vd_base_url());
}

// --- Verwerken: transcript -> Claude -> Teamleader --------------------------
if ($action === 'process' && $method === 'POST') {
    if (empty($config['ANTHROPIC_API_KEY']) || $config['ANTHROPIC_API_KEY'] === 'VUL_IN') {
        vd_json(['error' => 'ANTHROPIC_API_KEY ontbreekt in config.php.'], 500);
    }
    if (!tl_is_connected()) {
        vd_json(['error' => 'Nog niet verbonden met Teamleader.'], 400);
    }
    $body = json_decode((string) file_get_contents('php://input'), true);
    $transcript = trim((string) ($body['transcript'] ?? ''));
    if ($transcript === '') {
        vd_json(['error' => 'Leeg transcript.'], 400);
    }
    try {
        $deal = claude_extract($config, $transcript);
        $result = tl_create_deal($config, $deal);
        vd_json([
            'deal'            => $deal,
            'dealId'          => $result['dealId'],
            'customerCreated' => $result['customerCreated'],
        ]);
    } catch (Exception $e) {
        $msg = $e->getMessage() === 'NOT_CONNECTED'
            ? 'Teamleader-verbinding verlopen. Verbind opnieuw.'
            : $e->getMessage();
        vd_json(['error' => $msg], 500);
    }
}

// --- Startpagina (app) -------------------------------------------------------
echo vd_app_page(tl_is_connected(), vd_redirect_uri());
