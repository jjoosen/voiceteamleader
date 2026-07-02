<?php
// Kopieer dit bestand naar config.php en vul je gegevens in.
// config.php blijft op de server staan en wordt NIET op GitHub gezet.
//
// Een .php-bestand wordt door de server uitgevoerd en geeft niets terug,
// dus je sleutels zijn niet via de browser leesbaar.

return [
    // Welk ERP/CRM gebruikt de kmo? Vandaag: 'teamleader'.
    // (Adapters voor 'odoo' en 'exact' zijn gepland.)
    'ERP_ADAPTER'       => 'teamleader',

    // Teamleader-integratie (Marketplace > jouw integratie):
    'TL_CLIENT_ID'      => 'VUL_IN',
    'TL_CLIENT_SECRET'  => 'VUL_IN',

    // Anthropic API-key (console.anthropic.com > API Keys), begint met sk-ant-
    'ANTHROPIC_API_KEY' => 'VUL_IN',
    // Optioneel: een ander Claude-model kiezen (standaard claude-opus-4-8).
    'ANTHROPIC_MODEL'   => 'claude-opus-4-8',

    // Zelfgekozen toegangscode om de cockpit te openen:
    'APP_PASSWORD'      => 'VUL_IN',

    // Taal/spraak (nl-BE, nl-NL of fr-BE) en tijdzone voor "morgen", "om 14u", ...
    'LOCALE'            => 'nl-BE',
    'TIMEZONE'          => 'Europe/Brussels',
];
