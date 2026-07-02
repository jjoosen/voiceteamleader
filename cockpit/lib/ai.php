<?php
// AI-motor van de KMO Cockpit.
//
// Kernidee: de KMO'er spreekt of typt VRIJ ("bel morgen bakkerij Janssens terug,
// en maak een offerte voor de nieuwe ovens van 12.000 euro"). Claude herkent
// daar één of MEERDERE intenties in en zet die om naar gestructureerde acties
// die de ERP/CRM-adapter kan uitvoeren. Zo hoeft de gebruiker niet te weten in
// welk menu iets thuishoort — dat regelt de assistent.
//
// We forceren één tool-call ('register_actions') zodat we altijd geldige,
// gestructureerde output krijgen.

declare(strict_types=1);

// Lichte controle of de Anthropic-key werkt (gratis count_tokens-endpoint).
// Geeft [true, ''] bij succes of [false, 'reden'].
function ai_ping(array $config): array
{
    if (empty($config['ANTHROPIC_API_KEY']) || $config['ANTHROPIC_API_KEY'] === 'VUL_IN') {
        return [false, 'API-key niet ingevuld'];
    }
    [$status, $body, $err] = ai_http(
        'https://api.anthropic.com/v1/messages/count_tokens',
        [
            'model'    => ai_model($config),
            'messages' => [['role' => 'user', 'content' => 'ping']],
        ],
        $config,
        20
    );
    if ($status === 0) {
        return [false, 'Netwerkfout: ' . $err];
    }
    if ($status === 200) {
        return [true, ''];
    }
    if ($status === 401) {
        return [false, 'Ongeldige API-key (401)'];
    }
    return [false, 'HTTP ' . $status];
}

function ai_model(array $config): string
{
    $m = trim((string) ($config['ANTHROPIC_MODEL'] ?? ''));
    return $m !== '' ? $m : 'claude-opus-4-8';
}

// Kleine cURL-helper voor de Anthropic API. Geeft [status, body, err] terug;
// status 0 betekent een transportfout (dan staat de reden in err).
function ai_http(string $url, array $payload, array $config, int $timeout = 60): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-api-key: ' . ($config['ANTHROPIC_API_KEY'] ?? ''),
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_TIMEOUT        => $timeout,
    ]);
    $resp   = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);
    if ($resp === false) {
        return [0, '', $err];
    }
    return [$status, (string) $resp, ''];
}

// De taal waarin de assistent samenvat (afgeleid van de ingestelde LOCALE).
function ai_language(array $config): string
{
    $loc = strtolower((string) ($config['LOCALE'] ?? 'nl-BE'));
    return str_starts_with($loc, 'fr') ? 'het Frans' : 'het Nederlands';
}

// Het gereedschap waarmee Claude één of meer acties teruggeeft.
function ai_actions_tool(): array
{
    return [
        'name'        => 'register_actions',
        'description' =>
            'Zet een vrij ingesproken/getypte KMO-notitie om naar één of meer ' .
            'concrete acties voor het CRM/ERP. Herken zoveel losse acties als er ' .
            'echt in de tekst zitten (bv. tegelijk een taak én een offerte).',
        'input_schema' => [
            'type'       => 'object',
            'properties' => [
                'summary' => [
                    'type'        => 'string',
                    'description' => 'Korte samenvatting in de taal van de gebruiker van wat er gebeurt.',
                ],
                'actions' => [
                    'type'  => 'array',
                    'items' => ['type' => 'object', 'properties' => ai_action_properties(), 'required' => ['type']],
                    'description' => 'De lijst van uit te voeren acties, in logische volgorde.',
                ],
            ],
            'required' => ['summary', 'actions'],
        ],
    ];
}

// Alle mogelijke velden voor een actie. Per type is telkens maar een deel
// relevant; niet-gebruikte velden laat Claude weg of op null.
function ai_action_properties(): array
{
    return [
        'type' => [
            'type' => 'string',
            'enum' => ['deal', 'contact', 'company', 'task', 'call', 'meeting', 'note', 'time'],
            'description' =>
                "Soort actie: deal (verkoopkans), contact (persoon), company (bedrijf), " .
                "task (taak/to-do), call (telefoon: gepland of afgehandeld), meeting (agenda-afspraak), " .
                "note (losse notitie bij een klant), time (tijdsregistratie/uren).",
        ],
        'customer_name' => [
            'type'        => 'string',
            'description' => 'Naam van de betrokken klant (bedrijf of persoon), indien genoemd.',
        ],
        'customer_type' => [
            'type'        => 'string',
            'enum'        => ['company', 'contact'],
            'description' => "'company' voor een bedrijf, 'contact' voor een particulier/persoon.",
        ],
        'title' => [
            'type'        => 'string',
            'description' => 'Korte, concrete titel (voor deal, task of meeting).',
        ],
        'description' => [
            'type'        => 'string',
            'description' => 'Uitgebreidere omschrijving/inhoud, netjes verwoord.',
        ],
        'estimated_value' => [
            'type'        => ['number', 'null'],
            'description' => 'Bedrag in hele euro (voor een deal), of null als niet genoemd.',
        ],
        'currency' => [
            'type'        => 'string',
            'description' => "Valutacode, standaard 'EUR'.",
        ],
        'due_date' => [
            'type'        => ['string', 'null'],
            'description' => 'Vervaldatum/streefdatum als YYYY-MM-DD (voor task of geplande call), of null.',
        ],
        'starts_at' => [
            'type'        => ['string', 'null'],
            'description' => 'Startmoment van een meeting als ISO8601 met tijdzone (bv. 2026-07-03T14:00:00+02:00), of null.',
        ],
        'duration_minutes' => [
            'type'        => ['number', 'null'],
            'description' => 'Duur in minuten (voor meeting of time), of null.',
        ],
        'first_name' => [
            'type'        => 'string',
            'description' => 'Voornaam (voor een contact).',
        ],
        'last_name' => [
            'type'        => 'string',
            'description' => 'Achternaam (voor een contact).',
        ],
        'email' => [
            'type'        => 'string',
            'description' => 'E-mailadres, indien genoemd.',
        ],
        'phone' => [
            'type'        => 'string',
            'description' => 'Telefoonnummer, indien genoemd.',
        ],
        'vat_number' => [
            'type'        => 'string',
            'description' => 'Btw-nummer (voor een company), indien genoemd, bv. BE0123456789.',
        ],
        'company_name' => [
            'type'        => 'string',
            'description' => 'Bedrijf waaraan een contact verbonden is, indien genoemd.',
        ],
        'completed' => [
            'type'        => ['boolean', 'null'],
            'description' => 'Bij een call: true als het gesprek al plaatsvond (loggen), false/null als het nog gepland moet worden.',
        ],
        'note' => [
            'type'        => 'string',
            'description' => 'Nette, volledige samenvatting om als notitie te bewaren bij de klant/actie.',
        ],
    ];
}

// De systeeminstructie voor Claude. today = YYYY-MM-DD, tz = bv. Europe/Brussels.
function ai_system(array $config, string $today, string $tz): string
{
    $lang = ai_language($config);
    return
        "Je bent de assistent van een Benelux-kmo en zet vrij ingesproken of getypte " .
        "notities om naar concrete acties voor hun CRM/ERP (zoals Teamleader Focus). " .
        "Vandaag is $today (tijdzone $tz). Reken relatieve tijden (\"morgen\", \"volgende week " .
        "dinsdag\", \"om 14u\") correct om naar absolute datums/tijden. " .
        "Herken ALLE losse acties in de tekst: één zin kan meerdere acties bevatten. " .
        "Kies customer_type 'company' tenzij het duidelijk om een particulier gaat. " .
        "Voor een telefoon die nog moet gebeuren: type 'call' met completed=false en een due_date. " .
        "Voor een reeds gevoerd gesprek: type 'call' met completed=true. " .
        "Verzin nooit gegevens; laat onbekende velden weg of op null. " .
        "Schrijf 'summary' en 'note' netjes in $lang.";
}

// Hoofdfunctie: transcript -> gestructureerde acties.
// Geeft ['summary' => ..., 'actions' => [...]] terug.
function ai_extract(array $config, string $transcript, string $today, string $tz): array
{
    $payload = [
        'model'       => ai_model($config),
        'max_tokens'  => 2048,
        'system'      => ai_system($config, $today, $tz),
        'tools'       => [ai_actions_tool()],
        'tool_choice' => ['type' => 'tool', 'name' => 'register_actions'],
        'messages'    => [['role' => 'user', 'content' => $transcript]],
    ];

    [$status, $resp, $err] = ai_http('https://api.anthropic.com/v1/messages', $payload, $config, 60);
    if ($status === 0) {
        throw new Exception("Netwerkfout richting Anthropic: $err");
    }
    if ($status < 200 || $status >= 300) {
        throw new Exception("Anthropic API mislukt: $status $resp");
    }

    $data = json_decode($resp, true);
    foreach (($data['content'] ?? []) as $block) {
        if (($block['type'] ?? '') === 'tool_use') {
            $in = $block['input'];
            $in['actions'] = is_array($in['actions'] ?? null) ? $in['actions'] : [];
            $in['summary'] = (string) ($in['summary'] ?? '');
            return $in;
        }
    }
    throw new Exception('Geen gestructureerde output ontvangen van Claude.');
}
