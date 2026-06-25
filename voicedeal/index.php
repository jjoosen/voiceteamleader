<?php
// VoiceDeal — front controller (PHP, geschikt voor Combell/shared hosting).
// Routing via ?action=... zodat er geen URL-rewriting (.htaccess) nodig is.
declare(strict_types=1);

require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/teamleader.php';
require __DIR__ . '/lib/claude.php';
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
