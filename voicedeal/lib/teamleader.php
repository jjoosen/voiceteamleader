<?php
// Teamleader Focus: OAuth2 + API-aanroepen via cURL.
//
// Alle API-calls zijn POST naar https://api.focus.teamleader.eu/<actie> met een
// JSON-body en een "Authorization: Bearer <access_token>" header.
// De tokens bewaren we in data/tokens.json (afgeschermd via data/.htaccess).

const TL_AUTH_URL  = 'https://focus.teamleader.eu/oauth2/authorize';
const TL_TOKEN_URL = 'https://focus.teamleader.eu/oauth2/access_token';
const TL_API_BASE  = 'https://api.focus.teamleader.eu';

function tl_tokens_path(): string
{
    return __DIR__ . '/../data/tokens.json';
}

function tl_get_tokens(): ?array
{
    $p = tl_tokens_path();
    if (!is_file($p)) {
        return null;
    }
    $d = json_decode((string) file_get_contents($p), true);
    return is_array($d) ? $d : null;
}

function tl_store_tokens(array $data): array
{
    $tokens = [
        'access_token'  => $data['access_token'] ?? null,
        'refresh_token' => $data['refresh_token'] ?? null,
        'expires_at'    => time() + (int) ($data['expires_in'] ?? 3600),
    ];
    $dir = dirname(tl_tokens_path());
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $ok = @file_put_contents(tl_tokens_path(), json_encode($tokens), LOCK_EX);
    if ($ok === false) {
        throw new Exception(
            'Kon de tokens niet opslaan. Geef de map "data/" schrijfrechten (bv. 755/775).'
        );
    }
    return $tokens;
}

function tl_is_connected(): bool
{
    return tl_get_tokens() !== null;
}

function tl_disconnect(): void
{
    @unlink(tl_tokens_path());
}

function tl_authorize_url(array $config, string $redirectUri, string $state): string
{
    return TL_AUTH_URL . '?' . http_build_query([
        'client_id'     => $config['TL_CLIENT_ID'],
        'response_type' => 'code',
        'redirect_uri'  => $redirectUri,
        'state'         => $state,
    ]);
}

// --- HTTP-helpers ------------------------------------------------------------

function tl_post_form(string $url, array $fields): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($fields),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT        => 30,
    ]);
    $body   = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);
    if ($body === false) {
        throw new Exception("Netwerkfout richting Teamleader: $err");
    }
    return [$status, (string) $body];
}

function tl_exchange_code(array $config, string $code, string $redirectUri): array
{
    [$status, $body] = tl_post_form(TL_TOKEN_URL, [
        'client_id'     => $config['TL_CLIENT_ID'],
        'client_secret' => $config['TL_CLIENT_SECRET'],
        'code'          => $code,
        'grant_type'    => 'authorization_code',
        'redirect_uri'  => $redirectUri,
    ]);
    if ($status < 200 || $status >= 300) {
        throw new Exception("Teamleader token-uitwisseling mislukt: $status $body");
    }
    return tl_store_tokens(json_decode($body, true) ?: []);
}

function tl_refresh(array $config, array $tokens): array
{
    [$status, $body] = tl_post_form(TL_TOKEN_URL, [
        'client_id'     => $config['TL_CLIENT_ID'],
        'client_secret' => $config['TL_CLIENT_SECRET'],
        'refresh_token' => $tokens['refresh_token'],
        'grant_type'    => 'refresh_token',
    ]);
    if ($status < 200 || $status >= 300) {
        throw new Exception("Teamleader token-vernieuwing mislukt: $status $body");
    }
    return tl_store_tokens(json_decode($body, true) ?: []);
}

function tl_access_token(array $config): string
{
    $tokens = tl_get_tokens();
    if (!$tokens) {
        throw new Exception('NOT_CONNECTED');
    }
    if (($tokens['expires_at'] - 60) <= time()) {
        $tokens = tl_refresh($config, $tokens);
    }
    return (string) $tokens['access_token'];
}

function tl_api(array $config, string $action, array $body)
{
    $token = tl_access_token($config);
    $ch = curl_init(TL_API_BASE . '/' . $action);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($body ?: new stdClass()),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT        => 30,
    ]);
    $resp   = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);
    if ($resp === false) {
        throw new Exception("Netwerkfout bij $action: $err");
    }
    if ($status < 200 || $status >= 300) {
        throw new Exception("Teamleader $action mislukt: $status $resp");
    }
    return $resp === '' ? null : json_decode((string) $resp, true);
}

// --- Klanten & deals ---------------------------------------------------------

function tl_find_customer(array $config, string $type, string $name): ?string
{
    $action = $type === 'company' ? 'companies.list' : 'contacts.list';
    $res = tl_api($config, $action, [
        'filter' => ['term' => $name],
        'page'   => ['size' => 1, 'number' => 1],
    ]);
    return $res['data'][0]['id'] ?? null;
}

function tl_create_customer(array $config, string $type, string $name): ?string
{
    if ($type === 'company') {
        $res = tl_api($config, 'companies.add', ['name' => $name]);
        return $res['data']['id'] ?? null;
    }
    // Een contact heeft een voor- en achternaam nodig; splits eenvoudig.
    $parts = preg_split('/\s+/', trim($name));
    $first = count($parts) > 1 ? $parts[0] : '';
    $last  = count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : $parts[0];
    $res = tl_api($config, 'contacts.add', ['first_name' => $first, 'last_name' => $last]);
    return $res['data']['id'] ?? null;
}

// Maakt op basis van de door Claude gestructureerde gegevens een deal aan.
function tl_create_deal(array $config, array $ex): array
{
    $type = ($ex['customer_type'] ?? 'company') === 'contact' ? 'contact' : 'company';

    $customerId = tl_find_customer($config, $type, $ex['customer_name']);
    $created = false;
    if (!$customerId) {
        $customerId = tl_create_customer($config, $type, $ex['customer_name']);
        $created = true;
    }

    // deals.create vereist minimaal lead.customer + title.
    $deal = [
        'lead'  => ['customer' => ['type' => $type, 'id' => $customerId]],
        'title' => $ex['deal_title'],
    ];
    if (!empty($ex['estimated_value']) && is_numeric($ex['estimated_value']) && $ex['estimated_value'] > 0) {
        $deal['estimated_value'] = [
            'amount'   => (float) $ex['estimated_value'],
            'currency' => $ex['currency'] ?? 'EUR',
        ];
    }
    $res = tl_api($config, 'deals.create', $deal);
    $dealId = $res['data']['id'] ?? null;

    // De ingesproken samenvatting bewaren we als notitie op de deal.
    if (!empty($ex['note']) && $dealId) {
        try {
            tl_api($config, 'notes.create', [
                'subject' => ['type' => 'deal', 'id' => $dealId],
                'content' => $ex['note'],
            ]);
        } catch (Exception $e) {
            // Notitie is best-effort; laat de deal niet falen.
        }
    }

    return ['dealId' => $dealId, 'customerCreated' => $created, 'customerType' => $type];
}
