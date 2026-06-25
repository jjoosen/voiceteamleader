<?php
// Zet een ingesproken (Nederlandse) verkoopnotitie om naar gestructureerde
// dealgegevens met de Anthropic API (claude-opus-4-8). We forceren één
// tool-call zodat we gegarandeerd geldige, gestructureerde output krijgen.

function claude_extract(array $config, string $transcript): array
{
    $tool = [
        'name'        => 'register_deal',
        'description' => 'Structureer een ingesproken verkoopnotitie tot een Teamleader-deal.',
        'input_schema' => [
            'type'       => 'object',
            'properties' => [
                'customer_name' => [
                    'type'        => 'string',
                    'description' => 'Naam van de klant: bedrijfsnaam of de naam van de persoon.',
                ],
                'customer_type' => [
                    'type'        => 'string',
                    'enum'        => ['company', 'contact'],
                    'description' => "'company' voor een bedrijf, 'contact' voor een particulier/persoon.",
                ],
                'deal_title' => [
                    'type'        => 'string',
                    'description' => 'Korte, duidelijke titel van de deal.',
                ],
                'estimated_value' => [
                    'type'        => ['number', 'null'],
                    'description' => 'Geschatte waarde in hele euro, of null als niet genoemd.',
                ],
                'currency' => [
                    'type'        => 'string',
                    'description' => "Valutacode, standaard 'EUR'.",
                ],
                'note' => [
                    'type'        => 'string',
                    'description' => 'Nette, volledige samenvatting in het Nederlands om als notitie te bewaren.',
                ],
            ],
            'required' => ['customer_name', 'customer_type', 'deal_title', 'note'],
        ],
    ];

    $system =
        "Je bent een assistent die ingesproken Nederlandse verkoopnotities omzet naar " .
        "gestructureerde Teamleader-deals. Kies customer_type 'company' tenzij het duidelijk " .
        "om een particulier/persoon gaat. Houd de deal_title kort en concreet. Zet in 'note' een " .
        "nette samenvatting van wat er is ingesproken. Verzin geen gegevens; laat estimated_value " .
        "op null als er geen bedrag is genoemd.";

    $payload = [
        'model'       => 'claude-opus-4-8',
        'max_tokens'  => 1024,
        'system'      => $system,
        'tools'       => [$tool],
        'tool_choice' => ['type' => 'tool', 'name' => 'register_deal'],
        'messages'    => [['role' => 'user', 'content' => $transcript]],
    ];

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-api-key: ' . $config['ANTHROPIC_API_KEY'],
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_TIMEOUT        => 60,
    ]);
    $resp   = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    if ($resp === false) {
        throw new Exception("Netwerkfout richting Anthropic: $err");
    }
    if ($status < 200 || $status >= 300) {
        throw new Exception("Anthropic API mislukt: $status $resp");
    }

    $data = json_decode((string) $resp, true);
    foreach (($data['content'] ?? []) as $block) {
        if (($block['type'] ?? '') === 'tool_use') {
            return $block['input'];
        }
    }
    throw new Exception('Geen gestructureerde output ontvangen van Claude.');
}
