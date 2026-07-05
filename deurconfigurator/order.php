<?php
/**
 * Bestelling verwerken (webshop).
 * Ontvangt JSON van de configurator (winkelmandje + klantgegevens),
 * kent een bestelnummer toe, mailt de bestelling en bewaart een kopie.
 *
 * TESTVERSIE: geen online betaling. Bij livegang op Combell kan hier een
 * betaalprovider (bv. Mollie/Bancontact) worden gekoppeld vóór bevestiging.
 */
header('Content-Type: application/json; charset=utf-8');

$configFile = __DIR__ . '/config.php';
if (is_file($configFile)) { require $configFile; }

$to   = defined('LEAD_TO_EMAIL')   ? LEAD_TO_EMAIL   : '';
$from = defined('LEAD_FROM_EMAIL') ? LEAD_FROM_EMAIL : '';

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data) || empty($data['klant']['email']) || empty($data['items'])) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'invalid_payload']);
  exit;
}

$ordernr = 'BD-' . date('ymd') . '-' . strtoupper(substr(md5($raw . microtime()), 0, 5));
$k = $data['klant'];

$lines = [];
$lines[] = 'NIEUWE BESTELLING  ' . $ordernr;
$lines[] = str_repeat('=', 46);
$lines[] = 'Klant   : ' . g($k, 'voornaam') . ' ' . g($k, 'naam');
$lines[] = 'E-mail  : ' . g($k, 'email');
$lines[] = 'Telefoon: ' . g($k, 'tel');
$lines[] = 'Levering: ' . g($k, 'delivery');
if (($k['delivery'] ?? '') !== 'afhalen') {
  $lines[] = 'Adres   : ' . g($k, 'straat') . ', ' . g($k, 'postcode') . ' ' . g($k, 'gemeente') . ' ' . g($k, 'land');
}
$lines[] = '';
$lines[] = 'BESTELDE DEUREN';
$lines[] = str_repeat('-', 46);
foreach ($data['items'] as $it) {
  $lines[] = '• ' . ($it['aantal'] ?? 1) . '× ' . ($it['omschrijving'] ?? '');
  $lines[] = '  Prijs (incl. btw): EUR ' . number_format(($it['prijsIncl'] ?? 0), 2, ',', '.');
  if (!empty($it['config'])) {
    $cfg = $it['config'];
    $bits = [];
    foreach (['lineId','finishId','modelId','height','customHeight','width','swing','hinge','frameOptId','lockId','lockColor','glassId','handleId'] as $f) {
      if (!empty($cfg[$f])) $bits[] = $f . '=' . (is_scalar($cfg[$f]) ? $cfg[$f] : json_encode($cfg[$f]));
    }
    $lines[] = '  Details: ' . implode(', ', $bits);
  }
}
$lines[] = '';
$lines[] = 'TOTAAL INCL. BTW: ' . ($data['totaalTekst'] ?? '');
$lines[] = '';
$lines[] = 'Opmerking: ' . g($k, 'opmerking');
$body = implode("\n", $lines);

// bewaar kopie
$dir = __DIR__ . '/data';
if (is_dir($dir) && is_writable($dir)) {
  @file_put_contents($dir . '/order-' . $ordernr . '.txt', $body . "\n\nRAW:\n" . $raw);
}

// mail naar verkoper + (optioneel) bevestiging naar klant
$sent = false;
if ($to && $from) {
  $headers = [
    'From: Bestellingen <' . $from . '>',
    'Reply-To: ' . g($k, 'email'),
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
  ];
  $sent = @mail($to, 'Nieuwe bestelling ' . $ordernr, $body, implode("\r\n", $headers));
  // bevestiging naar klant
  @mail($k['email'], 'Bevestiging bestelling ' . $ordernr,
    "Bedankt voor je bestelling!\n\nJe bestelnummer is " . $ordernr . ".\n" .
    "Totaal: " . ($data['totaalTekst'] ?? '') . " incl. btw.\n\nWe nemen snel contact met je op.\n",
    implode("\r\n", $headers));
}

echo json_encode(['ok' => true, 'ordernr' => $ordernr, 'mail' => $sent]);

function g($a, $k) { return isset($a[$k]) ? trim((string)$a[$k]) : ''; }
