<?php
// KMO Cockpit — front controller (PHP, geschikt voor Combell/shared hosting).
// Routing via ?action=... zodat er geen URL-rewriting (.htaccess) nodig is.
//
// De cockpit is voice-first: je spreekt vrij, Claude (lib/ai.php) herkent de
// intenties en de ERP/CRM-adapter (lib/erp.php) voert ze uit in het systeem dat
// de kmo al gebruikt (vandaag: Teamleader Focus).
declare(strict_types=1);

require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/ai.php';
require __DIR__ . '/lib/erp.php';
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
    'lifetime' => 0, 'path' => '/', 'httponly' => true,
    'secure' => $secure, 'samesite' => 'Lax',
]);
session_start();

// --- Hulpfuncties ------------------------------------------------------------
function app_base_url(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $scheme = $https ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $path = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
    return $scheme . '://' . $host . $path;
}
function app_redirect_uri(): string { return app_base_url() . '?action=oauth_callback'; }
function app_go(string $to): void { header('Location: ' . $to); exit; }
function app_json($obj, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($obj);
    exit;
}

function app_missing_config(array $config): array
{
    $missing = [];
    foreach (['TL_CLIENT_ID', 'TL_CLIENT_SECRET', 'ANTHROPIC_API_KEY', 'APP_PASSWORD'] as $k) {
        if (empty($config[$k]) || $config[$k] === 'VUL_IN') {
            $missing[] = $k;
        }
    }
    return $missing;
}

function app_diagnostics(array $config, ErpAdapter $adapter): array
{
    $checks = [];
    $checks[] = ['PHP-versie', PHP_VERSION_ID >= 70400, PHP_VERSION];
    $checks[] = ['cURL beschikbaar', function_exists('curl_init'),
        function_exists('curl_init') ? 'ja' : 'ontbreekt — vraag je host de cURL-extensie'];

    $missing = app_missing_config($config);
    $checks[] = ['Instellingen (config.php) volledig', empty($missing),
        empty($missing) ? 'alles ingevuld' : 'nog invullen: ' . implode(', ', $missing)];

    $dataDir = __DIR__ . '/data';
    $writable = is_dir($dataDir) && is_writable($dataDir);
    $checks[] = ['Map data/ schrijfbaar', $writable, $writable ? 'ok' : 'geef data/ schrijfrechten (755/775)'];

    if (!in_array('ANTHROPIC_API_KEY', $missing, true)) {
        [$ok, $why] = ai_ping($config);
        $checks[] = ['Anthropic-key werkt', $ok, $ok ? 'ok' : $why];
    } else {
        $checks[] = ['Anthropic-key werkt', false, 'eerst API-key invullen'];
    }

    [$cok, $cmsg] = $adapter->isConnected() ? $adapter->ping() : [false, 'nog op "Verbind" klikken'];
    $checks[] = ['Verbonden met ' . $adapter->name(), $cok, $cmsg];

    return $checks;
}

// De vandaag-datum en tijdzone (voor het omrekenen van "morgen" enz.).
function app_today(array $config): array
{
    $tzName = (string) ($config['TIMEZONE'] ?? 'Europe/Brussels');
    try {
        $tz = new DateTimeZone($tzName);
    } catch (Exception $e) {
        $tz = new DateTimeZone('Europe/Brussels');
        $tzName = 'Europe/Brussels';
    }
    return [(new DateTime('now', $tz))->format('Y-m-d'), $tzName];
}

$adapter = erp_make($config);
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// --- Login / logout ----------------------------------------------------------
if ($action === 'login' && $method === 'POST') {
    if (app_check_password($config, $_POST['password'] ?? '')) {
        $_SESSION['app_authed'] = true;
        app_go(app_base_url());
    }
    echo ui_login_page('Onjuiste toegangscode.');
    exit;
}
if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    app_go(app_base_url());
}

// --- Inlogcheck voor alles hieronder ----------------------------------------
if (!app_is_logged_in()) {
    if ($action === 'process') {
        app_json(['error' => 'Niet ingelogd.'], 401);
    }
    echo ui_login_page('');
    exit;
}

// --- OAuth met het ERP/CRM ---------------------------------------------------
if ($action === 'oauth_start') {
    if (empty($config['TL_CLIENT_ID']) || $config['TL_CLIENT_ID'] === 'VUL_IN') {
        echo '<p>Configuratie onvolledig: <code>TL_CLIENT_ID</code> staat nog niet in config.php.</p>';
        exit;
    }
    $state = bin2hex(random_bytes(16));
    $_SESSION['oauth_state'] = $state;
    app_go($adapter->authorizeUrl(app_redirect_uri(), $state));
}
if ($action === 'oauth_callback') {
    $code = $_GET['code'] ?? '';
    $state = $_GET['state'] ?? '';
    if ($code === '') {
        echo '<p>Geen autorisatiecode ontvangen. <a href="' . htmlspecialchars(app_base_url()) . '">Terug</a></p>';
        exit;
    }
    if ($state === '' || $state !== ($_SESSION['oauth_state'] ?? '')) {
        echo '<p>Ongeldige state (mogelijk verlopen). <a href="?action=oauth_start">Opnieuw</a></p>';
        exit;
    }
    try {
        $adapter->handleCallback($code, app_redirect_uri());
    } catch (Exception $e) {
        echo '<p>Verbinden mislukt:</p><pre>' . htmlspecialchars($e->getMessage()) . '</pre>'
            . '<p><a href="' . htmlspecialchars(app_base_url()) . '">Terug</a></p>';
        exit;
    }
    app_go(app_base_url());
}
if ($action === 'disconnect' && $method === 'POST') {
    $adapter->disconnect();
    app_go('?action=settings');
}

// --- Verwerken: transcript -> AI -> acties uitvoeren ------------------------
if ($action === 'process' && $method === 'POST') {
    if (empty($config['ANTHROPIC_API_KEY']) || $config['ANTHROPIC_API_KEY'] === 'VUL_IN') {
        app_json(['error' => 'ANTHROPIC_API_KEY ontbreekt in config.php.'], 500);
    }
    if (!$adapter->isConnected()) {
        app_json(['error' => 'Nog niet verbonden met ' . $adapter->name() . '.'], 400);
    }
    $body = json_decode((string) file_get_contents('php://input'), true);
    $transcript = trim((string) ($body['transcript'] ?? ''));
    if ($transcript === '') {
        app_json(['error' => 'Leeg transcript.'], 400);
    }
    try {
        [$today, $tz] = app_today($config);
        $parsed = ai_extract($config, $transcript, $today, $tz);
        $results = [];
        foreach ($parsed['actions'] as $act) {
            if (is_array($act)) {
                $results[] = $adapter->executeAction($act);
            }
        }
        app_json(['summary' => $parsed['summary'], 'results' => $results]);
    } catch (Exception $e) {
        $msg = $e->getMessage() === 'NOT_CONNECTED'
            ? $adapter->name() . '-verbinding verlopen. Verbind opnieuw.'
            : $e->getMessage();
        app_json(['error' => $msg], 500);
    }
}

// --- Pagina's ----------------------------------------------------------------
if ($action === 'status') {
    echo ui_status_page(app_diagnostics($config, $adapter), $adapter->name());
    exit;
}
if ($action === 'settings') {
    echo ui_settings_page($config, $adapter, app_redirect_uri());
    exit;
}
if ($action === 'command') {
    echo ui_command_page($adapter->isConnected(), app_redirect_uri(), $adapter->name(), (string) ($config['LOCALE'] ?? 'nl-BE'));
    exit;
}

// --- Dashboard (startpagina) -------------------------------------------------
$dashboard = $adapter->isConnected() ? $adapter->dashboard() : [];
echo ui_dashboard_page($dashboard, $adapter->isConnected(), app_redirect_uri(), $adapter->name());
