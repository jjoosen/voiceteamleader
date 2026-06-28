<?php
// Dashboard voor kmo's: haalt kerncijfers uit Teamleader Focus en bundelt ze
// tot een eenvoudig overzicht (verkooppijplijn, facturatie, klanten).
//
// Elk onderdeel is "best-effort": faalt of ontbreekt één Teamleader-endpoint
// (bv. een account zonder facturatiemodule), dan blijft de rest gewoon werken
// en noteren we de reden onderaan het dashboard.

// Hoeveel records we maximaal ophalen per onderdeel (15 pagina's x 100 = 1500).
// Ruim voldoende voor een kmo; bij meer melden we dat de cijfers afgekapt zijn.
const DASH_PAGE_SIZE = 100;
const DASH_MAX_PAGES = 15;

// Tel het totaal aantal records van een list-endpoint via meta.matches
// (zonder alle records op te halen). Valt terug op het aantal in data.
function dash_count(array $config, string $action, array $filter = []): ?int
{
    $body = ['page' => ['size' => 1, 'number' => 1]];
    if (!empty($filter)) {
        $body['filter'] = $filter;
    }
    $res = tl_api($config, $action, $body);
    if (isset($res['meta']['matches'])) {
        return (int) $res['meta']['matches'];
    }
    return isset($res['data']) ? count($res['data']) : null;
}

// Haal (gepagineerd) records op tot het plafond. Geeft [rows, truncated] terug.
function dash_list_all(array $config, string $action, array $filter = []): array
{
    $all = [];
    $truncated = false;
    for ($page = 1; $page <= DASH_MAX_PAGES; $page++) {
        $body = ['page' => ['size' => DASH_PAGE_SIZE, 'number' => $page]];
        if (!empty($filter)) {
            $body['filter'] = $filter;
        }
        $res  = tl_api($config, $action, $body);
        $rows = $res['data'] ?? [];
        $all  = array_merge($all, $rows);
        if (count($rows) < DASH_PAGE_SIZE) {
            return [$all, false];
        }
        if ($page === DASH_MAX_PAGES) {
            $truncated = true;
        }
    }
    return [$all, $truncated];
}

// Haalt het bedrag uit een Teamleader money-object ({amount, currency}).
function dash_amount($money): float
{
    return is_array($money) ? (float) ($money['amount'] ?? 0) : 0.0;
}

// Bundelt alle dashboardcijfers tot één array voor de UI.
function dash_collect(array $config): array
{
    $out = [
        'connected' => true,
        'deals'     => null,
        'invoices'  => null,
        'customers' => null,
        'currency'  => 'EUR',
        'notes'     => [],
        'generated' => date('d/m/Y H:i'),
    ];

    // --- Verkooppijplijn: open deals --------------------------------------
    try {
        [$openDeals, $truncated] = dash_list_all($config, 'deals.list', ['status' => ['open']]);

        $openValue = 0.0;
        $weighted  = 0.0;
        $byPhase   = [];
        foreach ($openDeals as $d) {
            $val = dash_amount($d['estimated_value'] ?? null);
            $openValue += $val;
            $weighted  += dash_amount($d['weighted_value'] ?? null);
            if (!empty($d['estimated_value']['currency'])) {
                $out['currency'] = $d['estimated_value']['currency'];
            }
            // current_phase kan {type,id} of een losse id zijn.
            $phase = $d['current_phase'] ?? null;
            $pid   = is_array($phase) ? ($phase['id'] ?? 'onbekend') : ($phase ?: 'onbekend');
            if (!isset($byPhase[$pid])) {
                $byPhase[$pid] = ['count' => 0, 'value' => 0.0];
            }
            $byPhase[$pid]['count']++;
            $byPhase[$pid]['value'] += $val;
        }

        // Fase-namen ophalen en koppelen (optioneel; lukt het niet, dan id).
        $phaseNames = [];
        try {
            [$phaseRows] = dash_list_all($config, 'dealPhases.list');
            foreach ($phaseRows as $p) {
                $phaseNames[$p['id']] = $p['name'] ?? $p['id'];
            }
        } catch (Exception $e) {
            // namen zijn optioneel
        }

        $phases = [];
        foreach ($byPhase as $pid => $agg) {
            $phases[] = [
                'name'  => $phaseNames[$pid] ?? 'Onbekende fase',
                'count' => $agg['count'],
                'value' => $agg['value'],
            ];
        }
        usort($phases, fn($a, $b) => $b['value'] <=> $a['value']);

        $out['deals'] = [
            'open_count' => count($openDeals),
            'open_value' => $openValue,
            'weighted'   => $weighted,
            'phases'     => $phases,
        ];
        if ($truncated) {
            $out['notes'][] = 'Er zijn meer dan ' . (DASH_PAGE_SIZE * DASH_MAX_PAGES)
                . ' open deals; de dealcijfers zijn afgekapt.';
        }
    } catch (Exception $e) {
        $out['notes'][] = 'Deals konden niet geladen worden: ' . $e->getMessage();
    }

    // --- Facturatie: openstaande facturen ---------------------------------
    try {
        [$outstanding, $truncated] = dash_list_all($config, 'invoices.list', ['status' => ['outstanding']]);

        $today        = date('Y-m-d');
        $outValue     = 0.0;
        $overdueCount = 0;
        $overdueValue = 0.0;
        foreach ($outstanding as $inv) {
            // Voorkeur: nog te betalen bedrag (total.due); anders het totaal.
            $amount = dash_amount($inv['total']['due'] ?? null);
            if ($amount <= 0) {
                $amount = dash_amount($inv['total']['tax_inclusive'] ?? null);
            }
            $outValue += $amount;
            if (!empty($inv['total']['tax_inclusive']['currency'])) {
                $out['currency'] = $inv['total']['tax_inclusive']['currency'];
            }
            $dueOn = $inv['due_on'] ?? null;
            if ($dueOn && $dueOn < $today) {
                $overdueCount++;
                $overdueValue += $amount;
            }
        }

        $out['invoices'] = [
            'outstanding_count' => count($outstanding),
            'outstanding_value' => $outValue,
            'overdue_count'     => $overdueCount,
            'overdue_value'     => $overdueValue,
        ];
        if ($truncated) {
            $out['notes'][] = 'Er zijn erg veel openstaande facturen; de factuurcijfers zijn afgekapt.';
        }
    } catch (Exception $e) {
        $out['notes'][] = 'Facturen konden niet geladen worden (heeft dit account facturatie?): '
            . $e->getMessage();
    }

    // --- Klanten: aantal bedrijven en contacten ---------------------------
    try {
        $out['customers'] = [
            'companies' => dash_count($config, 'companies.list'),
            'contacts'  => dash_count($config, 'contacts.list'),
        ];
    } catch (Exception $e) {
        $out['notes'][] = 'Klanten konden niet geladen worden: ' . $e->getMessage();
    }

    return $out;
}
