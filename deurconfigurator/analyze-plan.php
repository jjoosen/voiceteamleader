<?php
/**
 * Plan-herkenning: leest een geüpload grondplan uit met Claude (vision) en
 * geeft een deurenlijst terug (ruimte, aantal, breedte, hoogte).
 *
 * Vereist ANTHROPIC_API_KEY in config.php. Zonder sleutel geeft dit een nette
 * fout terug en valt de front-end terug op een voorbeeldresultaat.
 *
 * Input  (JSON): { "image": "data:image/png;base64,...." }
 * Output (JSON): { "ok": true, "rows": [ {room,qty,width,height}, ... ] }
 */
header('Content-Type: application/json; charset=utf-8');

$configFile = __DIR__ . '/config.php';
if (is_file($configFile)) { require $configFile; }
$key = defined('ANTHROPIC_API_KEY') ? ANTHROPIC_API_KEY : '';

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
$image = isset($data['image']) ? $data['image'] : '';

if (!$key) { echo json_encode(['ok' => false, 'error' => 'no_api_key']); exit; }
if (!preg_match('#^data:(image/[a-z0-9.+-]+);base64,(.+)$#i', $image, $m)) {
  echo json_encode(['ok' => false, 'error' => 'invalid_image']); exit;
}
$mime = $m[1];
$b64  = $m[2];

$prompt =
  "Je bent een architect-assistent. Dit is een grondplan van een woning. " .
  "Bepaal de BINNENdeuren (geen buitendeuren, ramen of kruipruimtes). " .
  "Geef enkel geldige JSON terug in dit formaat, zonder extra tekst:\n" .
  '{"rows":[{"room":"naam ruimte","qty":1,"width":83,"height":211.5}]}' . "\n" .
  "width in cm uit deze reeks [63,68,73,78,83,88,93,98,103] (kies de dichtste). " .
  "height in cm uit [201.5,211.5,231.5]. Groepeer per ruimte met een aantal.";

$payload = json_encode([
  'model' => 'claude-sonnet-5',
  'max_tokens' => 1500,
  'messages' => [[
    'role' => 'user',
    'content' => [
      ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mime, 'data' => $b64]],
      ['type' => 'text', 'text' => $prompt],
    ],
  ]],
]);

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    'Content-Type: application/json',
    'x-api-key: ' . $key,
    'anthropic-version: 2023-06-01',
  ],
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_TIMEOUT => 60,
]);
$resp = curl_exec($ch);
if ($resp === false) { echo json_encode(['ok' => false, 'error' => 'request_failed', 'detail' => curl_error($ch)]); exit; }
curl_close($ch);

$j = json_decode($resp, true);
$text = isset($j['content'][0]['text']) ? $j['content'][0]['text'] : '';
// haal het JSON-blok uit het antwoord
if (preg_match('/\{.*\}/s', $text, $mm)) {
  $parsed = json_decode($mm[0], true);
  if (isset($parsed['rows']) && is_array($parsed['rows'])) {
    echo json_encode(['ok' => true, 'rows' => array_values($parsed['rows'])]);
    exit;
  }
}
echo json_encode(['ok' => false, 'error' => 'no_rows', 'raw' => $text]);
