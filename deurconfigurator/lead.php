<?php
/**
 * Offerte-aanvraag verwerken.
 * Ontvangt JSON van de configurator, mailt de aanvraag naar de verkoper en
 * bewaart een kopie. Optioneel: doorsturen naar Teamleader (zie onder).
 *
 * Configuratie via config.php (kopieer config.example.php):
 *   LEAD_TO_EMAIL   → adres van de verkoper
 *   LEAD_FROM_EMAIL → afzender (moet op je domein staan bij Combell)
 */
header('Content-Type: application/json; charset=utf-8');

$configFile = __DIR__ . '/config.php';
if (is_file($configFile)) { require $configFile; }

$to   = defined('LEAD_TO_EMAIL')   ? LEAD_TO_EMAIL   : '';
$from = defined('LEAD_FROM_EMAIL') ? LEAD_FROM_EMAIL : '';

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data) || empty($data['klant']['email'])) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'invalid_payload']);
  exit;
}

$klant = $data['klant'];
$cfg   = isset($data['configuratie']) ? $data['configuratie'] : [];
$totaal = isset($data['totaalTekst']) ? $data['totaalTekst'] : '';

// -- bouw een leesbare tekst -------------------------------------------------
$lines = [];
$lines[] = 'NIEUWE OFFERTE-AANVRAAG — binnendeur (Group Thys)';
$lines[] = str_repeat('=', 46);
$lines[] = 'Klant   : ' . s($klant, 'naam');
$lines[] = 'E-mail  : ' . s($klant, 'email');
$lines[] = 'Telefoon: ' . s($klant, 'tel');
$lines[] = 'Postcode: ' . s($klant, 'postcode');
$lines[] = '';
$lines[] = 'CONFIGURATIE';
$lines[] = str_repeat('-', 46);
foreach ($cfg as $k => $v) {
  $lines[] = str_pad($k, 16) . ': ' . (is_scalar($v) ? $v : json_encode($v));
}
$lines[] = '';
$lines[] = 'TOTAAL RICHTPRIJS: ' . $totaal . ' (incl. btw)';
$lines[] = '';
$lines[] = 'Bericht klant:';
$lines[] = s($klant, 'bericht');
$body = implode("\n", $lines);

// -- bewaar een kopie (data/ afgeschermd via .htaccess) ----------------------
$dir = __DIR__ . '/data';
if (is_dir($dir) && is_writable($dir)) {
  @file_put_contents(
    $dir . '/lead-' . date('Ymd-His') . '-' . substr(md5($klant['email'] . microtime()), 0, 6) . '.txt',
    $body . "\n\nRAW:\n" . $raw
  );
}

// -- verstuur e-mail ---------------------------------------------------------
$sent = false;
if ($to && $from) {
  $subject = 'Offerte binnendeur — ' . s($klant, 'naam');
  $headers = [];
  $headers[] = 'From: Deurconfigurator <' . $from . '>';
  $headers[] = 'Reply-To: ' . s($klant, 'naam') . ' <' . s($klant, 'email') . '>';
  $headers[] = 'Content-Type: text/plain; charset=utf-8';
  $headers[] = 'MIME-Version: 1.0';
  $sent = @mail($to, $subject, $body, implode("\r\n", $headers));
}

// -- OPTIONEEL: doorsturen naar Teamleader -----------------------------------
// Hergebruik van je bestaande VoiceDeal-koppeling (../voicedeal/lib/teamleader.php).
// Standaard uit; zet TEAMLEADER_FORWARD = true in config.php om te activeren.
if (defined('TEAMLEADER_FORWARD') && TEAMLEADER_FORWARD) {
  // Hier kan je een deal/lead in Teamleader aanmaken met de gegevens hierboven.
  // Bewust als hook gelaten zodat de configurator ook zonder API-sleutels werkt.
}

echo json_encode(['ok' => ($sent || (is_dir($dir) && is_writable($dir))), 'mail' => $sent]);

function s($arr, $key) { return isset($arr[$key]) ? trim((string)$arr[$key]) : ''; }
