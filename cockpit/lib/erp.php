<?php
// Adapter-architectuur voor de KMO Cockpit.
//
// Een Benelux-kmo heeft meestal AL een systeem (Teamleader Focus, Odoo, Exact...).
// De cockpit wil daar bovenop werken, niet vervangen. Daarom praat de app nooit
// rechtstreeks met een specifiek systeem, maar met een ErpAdapter-interface.
// Vandaag is enkel Teamleader Focus geïmplementeerd; Odoo/Exact kunnen er via
// dezelfde interface bijkomen zonder de rest van de app te wijzigen.

declare(strict_types=1);

require_once __DIR__ . '/erp/teamleader.php';

interface ErpAdapter
{
    // Menselijke naam van het systeem (bv. "Teamleader Focus").
    public function name(): string;

    // Sleutel/id van de adapter (bv. "teamleader").
    public function key(): string;

    // Is er een geldige verbinding (tokens aanwezig)?
    public function isConnected(): bool;

    // OAuth: URL om de gebruiker heen te sturen om toestemming te geven.
    public function authorizeUrl(string $redirectUri, string $state): string;

    // OAuth: wissel de teruggekregen code in voor tokens.
    public function handleCallback(string $code, string $redirectUri): void;

    // Verbinding verbreken (tokens wissen).
    public function disconnect(): void;

    // Snelle gezondheidscheck: [bool $ok, string $detail].
    public function ping(): array;

    // Voer één gestructureerde actie uit (uit de AI-motor).
    // Geeft een resultaatregel terug:
    //   ['ok'=>bool, 'type'=>string, 'label'=>string, 'id'=>?string,
    //    'detail'=>string, 'created'=>bool, 'url'=>?string]
    public function executeAction(array $action): array;

    // Geaggregeerde cijfers/lijsten voor het dashboard.
    public function dashboard(): array;
}

// Fabriek: kies de adapter op basis van config['ERP_ADAPTER'] (standaard teamleader).
function erp_make(array $config): ErpAdapter
{
    $which = strtolower(trim((string) ($config['ERP_ADAPTER'] ?? 'teamleader')));
    switch ($which) {
        case 'teamleader':
        default:
            return new TeamleaderAdapter($config);
    }
}

// Welke adapters kent de app (voor de instellingenpagina)?
function erp_available(): array
{
    return [
        'teamleader' => ['name' => 'Teamleader Focus', 'status' => 'actief'],
        'odoo'       => ['name' => 'Odoo',             'status' => 'gepland'],
        'exact'      => ['name' => 'Exact Online',     'status' => 'gepland'],
    ];
}

// --- Gedeelde hulpfuncties voor adapters -------------------------------------

// Splitst een volledige naam netjes in voor- en achternaam.
function erp_split_name(string $name): array
{
    $parts = preg_split('/\s+/', trim($name)) ?: [];
    if (count($parts) <= 1) {
        return ['', $name];
    }
    return [$parts[0], implode(' ', array_slice($parts, 1))];
}

// Formatteert een geldbedrag netjes (bv. "€ 12.000").
function erp_money(float $amount, string $currency = 'EUR'): string
{
    $sym = $currency === 'EUR' ? '€ ' : ($currency . ' ');
    return $sym . number_format($amount, 0, ',', '.');
}
