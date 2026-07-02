<?php
// Teamleader Focus-adapter voor de KMO Cockpit.
//
// Implementeert ErpAdapter (zie ../erp.php). Alle API-calls zijn POST naar
// https://api.focus.teamleader.eu/<actie> met een JSON-body en een
// "Authorization: Bearer <access_token>" header. Tokens bewaren we in
// data/tokens.json (afgeschermd via data/.htaccess).
//
// De veldvormen volgen de officiële Teamleader Focus API v2. Let op de
// verplichte velden per endpoint (bv. tasks.create heeft work_type_id nodig,
// events.create een activity_type_id en ends_at). Daar lossen we hieronder
// verstandige standaardwaarden voor op.

declare(strict_types=1);

final class TeamleaderAdapter implements ErpAdapter
{
    private const AUTH_URL  = 'https://focus.teamleader.eu/oauth2/authorize';
    private const TOKEN_URL = 'https://focus.teamleader.eu/oauth2/access_token';
    private const API_BASE  = 'https://api.focus.teamleader.eu';

    private array $config;
    /** @var array<string,mixed> Kleine cache binnen één request. */
    private array $cache = [];

    public function __construct(array $config)
    {
        $this->config = $config;
    }

    public function name(): string { return 'Teamleader Focus'; }
    public function key(): string  { return 'teamleader'; }

    // --- Tokenbeheer ---------------------------------------------------------

    private function tokensPath(): string
    {
        return __DIR__ . '/../../data/tokens.json';
    }

    private function getTokens(): ?array
    {
        $p = $this->tokensPath();
        if (!is_file($p)) {
            return null;
        }
        $d = json_decode((string) file_get_contents($p), true);
        return is_array($d) ? $d : null;
    }

    private function storeTokens(array $data): array
    {
        $tokens = [
            'access_token'  => $data['access_token'] ?? null,
            'refresh_token' => $data['refresh_token'] ?? null,
            'expires_at'    => time() + (int) ($data['expires_in'] ?? 3600),
        ];
        $dir = dirname($this->tokensPath());
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $ok = @file_put_contents($this->tokensPath(), json_encode($tokens), LOCK_EX);
        if ($ok === false) {
            throw new Exception('Kon de tokens niet opslaan. Geef de map "data/" schrijfrechten (755/775).');
        }
        return $tokens;
    }

    public function isConnected(): bool { return $this->getTokens() !== null; }
    public function disconnect(): void  { @unlink($this->tokensPath()); }

    public function authorizeUrl(string $redirectUri, string $state): string
    {
        return self::AUTH_URL . '?' . http_build_query([
            'client_id'     => $this->config['TL_CLIENT_ID'] ?? '',
            'response_type' => 'code',
            'redirect_uri'  => $redirectUri,
            'state'         => $state,
        ]);
    }

    public function handleCallback(string $code, string $redirectUri): void
    {
        [$status, $body] = $this->postForm(self::TOKEN_URL, [
            'client_id'     => $this->config['TL_CLIENT_ID'] ?? '',
            'client_secret' => $this->config['TL_CLIENT_SECRET'] ?? '',
            'code'          => $code,
            'grant_type'    => 'authorization_code',
            'redirect_uri'  => $redirectUri,
        ]);
        if ($status < 200 || $status >= 300) {
            throw new Exception("Teamleader token-uitwisseling mislukt: $status $body");
        }
        $this->storeTokens(json_decode($body, true) ?: []);
    }

    private function refresh(array $tokens): array
    {
        [$status, $body] = $this->postForm(self::TOKEN_URL, [
            'client_id'     => $this->config['TL_CLIENT_ID'] ?? '',
            'client_secret' => $this->config['TL_CLIENT_SECRET'] ?? '',
            'refresh_token' => $tokens['refresh_token'] ?? '',
            'grant_type'    => 'refresh_token',
        ]);
        if ($status < 200 || $status >= 300) {
            throw new Exception("Teamleader token-vernieuwing mislukt: $status $body");
        }
        return $this->storeTokens(json_decode($body, true) ?: []);
    }

    private function accessToken(): string
    {
        $tokens = $this->getTokens();
        if (!$tokens) {
            throw new Exception('NOT_CONNECTED');
        }
        if (((int) ($tokens['expires_at'] ?? 0) - 60) <= time()) {
            $tokens = $this->refresh($tokens);
        }
        return (string) $tokens['access_token'];
    }

    // --- HTTP-laag -----------------------------------------------------------

    private function postForm(string $url, array $fields): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query($fields),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_TIMEOUT        => 30,
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($body === false) {
            throw new Exception("Netwerkfout richting Teamleader: $err");
        }
        return [$status, (string) $body];
    }

    // Voert een API-call uit. $body mag leeg zijn ([]).
    private function api(string $action, array $body = [])
    {
        $token = $this->accessToken();
        $ch = curl_init(self::API_BASE . '/' . $action);
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
        $resp = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($resp === false) {
            throw new Exception("Netwerkfout bij $action: $err");
        }
        if ($status < 200 || $status >= 300) {
            throw new Exception("Teamleader $action mislukt: $status $resp");
        }
        return $resp === '' ? null : json_decode((string) $resp, true);
    }

    public function ping(): array
    {
        try {
            $me = $this->api('users.me', []);
            $name = trim((($me['data']['first_name'] ?? '') . ' ' . ($me['data']['last_name'] ?? '')));
            return [true, $name !== '' ? "verbonden als $name" : 'verbonden'];
        } catch (Exception $e) {
            $msg = $e->getMessage() === 'NOT_CONNECTED' ? 'nog niet verbonden' : $e->getMessage();
            return [false, $msg];
        }
    }

    // --- Standaardwaarden oplossen (met cache) -------------------------------

    private function currentUserId(): ?string
    {
        if (!array_key_exists('user_id', $this->cache)) {
            try {
                $me = $this->api('users.me', []);
                $this->cache['user_id'] = $me['data']['id'] ?? null;
                $this->cache['time_zone'] = $me['data']['time_zone'] ?? 'Europe/Brussels';
            } catch (Exception $e) {
                $this->cache['user_id'] = null;
            }
        }
        return $this->cache['user_id'];
    }

    // Eerste beschikbare werksoort (nodig voor taken/agenda/tijd).
    private function defaultWorkTypeId(): ?string
    {
        if (!array_key_exists('work_type_id', $this->cache)) {
            try {
                $res = $this->api('workTypes.list', ['page' => ['size' => 1, 'number' => 1]]);
                $this->cache['work_type_id'] = $res['data'][0]['id'] ?? null;
            } catch (Exception $e) {
                $this->cache['work_type_id'] = null;
            }
        }
        return $this->cache['work_type_id'];
    }

    // Eerste beschikbare activiteitstype (nodig voor agenda-afspraken).
    private function defaultActivityTypeId(): ?string
    {
        if (!array_key_exists('activity_type_id', $this->cache)) {
            try {
                $res = $this->api('activityTypes.list', ['page' => ['size' => 1, 'number' => 1]]);
                $this->cache['activity_type_id'] = $res['data'][0]['id'] ?? null;
            } catch (Exception $e) {
                $this->cache['activity_type_id'] = null;
            }
        }
        return $this->cache['activity_type_id'];
    }

    // --- Klant opzoeken of aanmaken ------------------------------------------

    private function resolveCustomer(string $type, string $name): array
    {
        $type = $type === 'contact' ? 'contact' : 'company';
        $listAction = $type === 'company' ? 'companies.list' : 'contacts.list';
        try {
            $res = $this->api($listAction, [
                'filter' => ['term' => $name],
                'page'   => ['size' => 1, 'number' => 1],
            ]);
            $id = $res['data'][0]['id'] ?? null;
            if ($id) {
                return ['type' => $type, 'id' => $id, 'created' => false];
            }
        } catch (Exception $e) {
            // Zoeken mislukte; we proberen aan te maken.
        }

        if ($type === 'company') {
            $res = $this->api('companies.add', ['name' => $name]);
        } else {
            [$first, $last] = erp_split_name($name);
            $res = $this->api('contacts.add', ['first_name' => $first, 'last_name' => $last]);
        }
        return ['type' => $type, 'id' => $res['data']['id'] ?? null, 'created' => true];
    }

    // Voegt een notitie toe aan een onderwerp (best effort).
    private function addNote(string $subjectType, string $subjectId, string $content): void
    {
        if ($content === '' || $subjectId === '') {
            return;
        }
        try {
            $this->api('notes.create', [
                'subject' => ['type' => $subjectType, 'id' => $subjectId],
                'content' => $content,
            ]);
        } catch (Exception $e) {
            // Notities zijn best effort.
        }
    }

    // --- Acties uitvoeren ----------------------------------------------------

    public function executeAction(array $a): array
    {
        $type = (string) ($a['type'] ?? '');
        try {
            switch ($type) {
                case 'deal':    return $this->doDeal($a);
                case 'contact': return $this->doContact($a);
                case 'company': return $this->doCompany($a);
                case 'task':    return $this->doTask($a);
                case 'call':    return $this->doCall($a);
                case 'meeting': return $this->doMeeting($a);
                case 'note':    return $this->doNote($a);
                case 'time':    return $this->doTime($a);
                default:
                    return $this->fail($type, 'Onbekend actietype.');
            }
        } catch (Exception $e) {
            $msg = $e->getMessage() === 'NOT_CONNECTED'
                ? 'Teamleader-verbinding verlopen — verbind opnieuw.'
                : $e->getMessage();
            return $this->fail($type, $msg);
        }
    }

    private function ok(string $type, string $label, ?string $id, bool $created = false, string $detail = ''): array
    {
        return ['ok' => true, 'type' => $type, 'label' => $label, 'id' => $id, 'created' => $created, 'detail' => $detail];
    }

    private function fail(string $type, string $detail): array
    {
        return ['ok' => false, 'type' => $type, 'label' => '', 'id' => null, 'created' => false, 'detail' => $detail];
    }

    private function customerType(array $a): string
    {
        return ($a['customer_type'] ?? 'company') === 'contact' ? 'contact' : 'company';
    }

    private function doDeal(array $a): array
    {
        $name = trim((string) ($a['customer_name'] ?? ''));
        if ($name === '') {
            return $this->fail('deal', 'Geen klantnaam voor de deal.');
        }
        $cust = $this->resolveCustomer($this->customerType($a), $name);
        $body = [
            'lead'  => ['customer' => ['type' => $cust['type'], 'id' => $cust['id']]],
            'title' => (string) ($a['title'] ?? 'Nieuwe deal'),
        ];
        $val = $a['estimated_value'] ?? null;
        if (is_numeric($val) && (float) $val > 0) {
            $body['estimated_value'] = ['amount' => (float) $val, 'currency' => (string) ($a['currency'] ?? 'EUR')];
        }
        if ($uid = $this->currentUserId()) {
            $body['responsible_user_id'] = $uid;
        }
        try {
            $res = $this->api('deals.create', $body);
        } catch (Exception $e) {
            // Sommige accounts weigeren een veld: val terug op de minimale body.
            unset($body['responsible_user_id']);
            $res = $this->api('deals.create', $body);
        }
        $id = $res['data']['id'] ?? null;
        $this->addNote('deal', (string) $id, (string) ($a['note'] ?? ''));
        $label = $body['title'] . ' — ' . $name;
        if (isset($body['estimated_value'])) {
            $label .= ' (' . erp_money((float) $val, (string) ($a['currency'] ?? 'EUR')) . ')';
        }
        return $this->ok('deal', $label, $id, $cust['created']);
    }

    private function doContact(array $a): array
    {
        $first = trim((string) ($a['first_name'] ?? ''));
        $last  = trim((string) ($a['last_name'] ?? ''));
        if ($first === '' && $last === '') {
            [$first, $last] = erp_split_name((string) ($a['customer_name'] ?? ''));
        }
        if ($first === '' && $last === '') {
            return $this->fail('contact', 'Geen naam voor het contact.');
        }
        $body = ['first_name' => $first, 'last_name' => $last !== '' ? $last : $first];
        if (!empty($a['email'])) {
            $body['emails'] = [['type' => 'primary', 'email' => (string) $a['email']]];
        }
        if (!empty($a['phone'])) {
            $body['telephones'] = [['type' => 'phone', 'number' => (string) $a['phone']]];
        }
        $res = $this->api('contacts.add', $body);
        $id = $res['data']['id'] ?? null;
        // Aan een bedrijf koppelen indien genoemd (best effort).
        if (!empty($a['company_name']) && $id) {
            try {
                $company = $this->resolveCustomer('company', (string) $a['company_name']);
                if ($company['id']) {
                    $this->api('contacts.linkToCompany', ['id' => $id, 'company_id' => $company['id']]);
                }
            } catch (Exception $e) {
                // koppeling best effort
            }
        }
        $this->addNote('contact', (string) $id, (string) ($a['note'] ?? ''));
        return $this->ok('contact', trim("$first $last"), $id, true);
    }

    private function doCompany(array $a): array
    {
        $name = trim((string) ($a['company_name'] ?? $a['customer_name'] ?? ''));
        if ($name === '') {
            return $this->fail('company', 'Geen bedrijfsnaam.');
        }
        $body = ['name' => $name];
        if (!empty($a['vat_number'])) {
            $body['vat_number'] = (string) $a['vat_number'];
        }
        if (!empty($a['email'])) {
            $body['emails'] = [['type' => 'primary', 'email' => (string) $a['email']]];
        }
        if (!empty($a['phone'])) {
            $body['telephones'] = [['type' => 'phone', 'number' => (string) $a['phone']]];
        }
        $res = $this->api('companies.add', $body);
        $id = $res['data']['id'] ?? null;
        $this->addNote('company', (string) $id, (string) ($a['note'] ?? ''));
        return $this->ok('company', $name, $id, true);
    }

    private function doTask(array $a): array
    {
        $title = trim((string) ($a['title'] ?? $a['description'] ?? 'Taak'));
        $body = [
            'title'  => $title,
            'due_on' => $this->dateOrToday($a['due_date'] ?? null),
        ];
        if (!empty($a['description'])) {
            $body['description'] = (string) $a['description'];
        }
        if ($wt = $this->defaultWorkTypeId()) {
            $body['work_type_id'] = $wt;
        }
        if ($uid = $this->currentUserId()) {
            $body['assignee'] = ['type' => 'user', 'id' => $uid];
        }
        // Aan klant koppelen indien genoemd.
        if (!empty($a['customer_name'])) {
            try {
                $cust = $this->resolveCustomer($this->customerType($a), (string) $a['customer_name']);
                if ($cust['id']) {
                    $body['customer'] = ['type' => $cust['type'], 'id' => $cust['id']];
                }
            } catch (Exception $e) {
                // koppeling best effort
            }
        }
        $res = $this->api('tasks.create', $body);
        $id = $res['data']['id'] ?? null;
        $label = $title . ' — tegen ' . $body['due_on'];
        return $this->ok('task', $label, $id, true);
    }

    private function doCall(array $a): array
    {
        $name = trim((string) ($a['customer_name'] ?? ''));
        if ($name === '') {
            return $this->fail('call', 'Geen klant voor de telefoon.');
        }
        $cust = $this->resolveCustomer($this->customerType($a), $name);
        $body = [
            'description' => (string) ($a['description'] ?? $a['title'] ?? 'Telefoongesprek'),
            'participant' => ['customer' => ['type' => $cust['type'], 'id' => $cust['id']]],
            'due_at'      => $this->datetimeFrom($a['due_date'] ?? null, $a['starts_at'] ?? null),
        ];
        if ($uid = $this->currentUserId()) {
            $body['assignee'] = ['type' => 'user', 'id' => $uid];
        }
        $res = $this->api('calls.add', $body);
        $id = $res['data']['id'] ?? null;
        // Reeds gevoerd gesprek? Meteen afronden.
        $completed = ($a['completed'] ?? false) === true;
        if ($completed && $id) {
            try {
                $this->api('calls.complete', [
                    'id' => $id,
                    'outcome_summary' => (string) ($a['note'] ?? $a['description'] ?? ''),
                ]);
            } catch (Exception $e) {
                // afronden best effort (vereist soms een outcome_id)
            }
        }
        $label = ($completed ? 'Gesprek gelogd' : 'Telefoon gepland') . ' — ' . $name;
        return $this->ok('call', $label, $id, $cust['created']);
    }

    private function doMeeting(array $a): array
    {
        $title = trim((string) ($a['title'] ?? 'Afspraak'));
        $start = $this->datetimeFrom($a['due_date'] ?? null, $a['starts_at'] ?? null);
        $mins  = (int) ($a['duration_minutes'] ?? 0);
        $mins  = $mins > 0 ? $mins : 60;
        $end   = $this->addMinutes($start, $mins);
        $body = [
            'title'      => $title,
            'starts_at'  => $start,
            'ends_at'    => $end,
        ];
        if ($at = $this->defaultActivityTypeId()) {
            $body['activity_type_id'] = $at;
        }
        if (!empty($a['description'])) {
            $body['description'] = (string) $a['description'];
        }
        if ($uid = $this->currentUserId()) {
            $body['attendees'] = [['type' => 'user', 'id' => $uid]];
        }
        if (!empty($a['customer_name'])) {
            try {
                $cust = $this->resolveCustomer($this->customerType($a), (string) $a['customer_name']);
                if ($cust['id']) {
                    $body['links'] = [['type' => $cust['type'], 'id' => $cust['id']]];
                }
            } catch (Exception $e) {
                // koppeling best effort
            }
        }
        $res = $this->api('events.create', $body);
        $id = $res['data']['id'] ?? null;
        $label = $title . ' — ' . $this->humanDatetime($start);
        return $this->ok('meeting', $label, $id, true);
    }

    private function doNote(array $a): array
    {
        $name = trim((string) ($a['customer_name'] ?? ''));
        $content = trim((string) ($a['note'] ?? $a['description'] ?? ''));
        if ($name === '' || $content === '') {
            return $this->fail('note', 'Notitie heeft een klant en inhoud nodig.');
        }
        $cust = $this->resolveCustomer($this->customerType($a), $name);
        $this->api('notes.create', [
            'subject' => ['type' => $cust['type'], 'id' => $cust['id']],
            'content' => $content,
        ]);
        return $this->ok('note', 'Notitie bij ' . $name, $cust['id'], $cust['created']);
    }

    private function doTime(array $a): array
    {
        $mins = (int) ($a['duration_minutes'] ?? 0);
        if ($mins <= 0) {
            return $this->fail('time', 'Geen duur opgegeven voor de tijdsregistratie.');
        }
        $body = [
            'started_at'  => $this->datetimeFrom($a['due_date'] ?? null, $a['starts_at'] ?? null),
            'duration'    => $mins * 60,
            'description' => (string) ($a['description'] ?? $a['note'] ?? 'Gewerkte tijd'),
        ];
        if ($wt = $this->defaultWorkTypeId()) {
            $body['work_type_id'] = $wt;
        }
        // Aan een bedrijf/contact koppelen indien genoemd.
        if (!empty($a['customer_name'])) {
            try {
                $cust = $this->resolveCustomer($this->customerType($a), (string) $a['customer_name']);
                if ($cust['id']) {
                    $body['subject'] = ['type' => $cust['type'], 'id' => $cust['id']];
                }
            } catch (Exception $e) {
                // koppeling best effort
            }
        }
        $res = $this->api('timeTracking.add', $body);
        $id = $res['data']['id'] ?? null;
        $h = intdiv($mins, 60);
        $m = $mins % 60;
        $dur = $h > 0 ? ($h . 'u' . ($m > 0 ? sprintf('%02d', $m) : '')) : ($m . 'min');
        return $this->ok('time', $dur . ' geregistreerd', $id, true);
    }

    // --- Datum/tijd-helpers --------------------------------------------------

    private function tz(): DateTimeZone
    {
        $name = (string) ($this->config['TIMEZONE'] ?? 'Europe/Brussels');
        try {
            return new DateTimeZone($name);
        } catch (Exception $e) {
            return new DateTimeZone('Europe/Brussels');
        }
    }

    private function dateOrToday(?string $date): string
    {
        $date = trim((string) $date);
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return $date;
        }
        return (new DateTime('now', $this->tz()))->format('Y-m-d');
    }

    // Geeft een ISO8601-datetime met tijdzone. Neemt starts_at als die er is,
    // anders de datum + standaarduur (9u), anders nu.
    private function datetimeFrom(?string $date, ?string $startsAt): string
    {
        $startsAt = trim((string) $startsAt);
        if ($startsAt !== '') {
            try {
                return (new DateTime($startsAt))->format('c');
            } catch (Exception $e) {
                // val door
            }
        }
        $date = trim((string) $date);
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return (new DateTime($date . 'T09:00:00', $this->tz()))->format('c');
        }
        return (new DateTime('now', $this->tz()))->format('c');
    }

    private function addMinutes(string $iso, int $minutes): string
    {
        try {
            $d = new DateTime($iso);
            $d->modify("+$minutes minutes");
            return $d->format('c');
        } catch (Exception $e) {
            return $iso;
        }
    }

    private function humanDatetime(string $iso): string
    {
        try {
            $d = new DateTime($iso);
            $d->setTimezone($this->tz());
            return $d->format('d/m H:i');
        } catch (Exception $e) {
            return $iso;
        }
    }

    // --- Dashboard -----------------------------------------------------------

    public function dashboard(): array
    {
        $tz = $this->tz();
        $today = (new DateTime('now', $tz))->format('Y-m-d');
        $out = [
            'me'            => null,
            'today'         => $today,
            'open_deals'    => ['count' => 0, 'value' => 0.0],
            'tasks_due'     => [],
            'calls_today'   => [],
            'events_today'  => [],
            'invoices_open' => ['count' => 0, 'value' => 0.0, 'overdue' => 0],
            'errors'        => [],
        ];

        try {
            $me = $this->api('users.me', []);
            $out['me'] = trim((($me['data']['first_name'] ?? '') . ' ' . ($me['data']['last_name'] ?? '')));
        } catch (Exception $e) {
            $out['errors'][] = 'gebruiker: ' . $e->getMessage();
        }

        // Openstaande deals: som van de geschatte waarde.
        try {
            $res = $this->api('deals.list', [
                'filter' => ['status' => ['open']],
                'page'   => ['size' => 100, 'number' => 1],
            ]);
            $sum = 0.0;
            foreach (($res['data'] ?? []) as $d) {
                $sum += (float) ($d['estimated_value']['amount'] ?? 0);
            }
            $out['open_deals'] = ['count' => count($res['data'] ?? []), 'value' => $sum];
        } catch (Exception $e) {
            $out['errors'][] = 'deals: ' . $e->getMessage();
        }

        // Taken die vandaag of eerder vervallen en nog niet af zijn.
        try {
            $res = $this->api('tasks.list', [
                'filter' => ['completed' => false, 'due_before' => $today],
                'page'   => ['size' => 15, 'number' => 1],
                'sort'   => [['field' => 'due_on', 'order' => 'asc']],
            ]);
            foreach (($res['data'] ?? []) as $t) {
                $out['tasks_due'][] = [
                    'title'  => (string) ($t['title'] ?? ''),
                    'due_on' => (string) ($t['due_on'] ?? ''),
                ];
            }
        } catch (Exception $e) {
            // Fallback zonder due_before-filter (sommige accounts verschillen).
            try {
                $res = $this->api('tasks.list', [
                    'filter' => ['completed' => false],
                    'page'   => ['size' => 15, 'number' => 1],
                    'sort'   => [['field' => 'due_on', 'order' => 'asc']],
                ]);
                foreach (($res['data'] ?? []) as $t) {
                    $out['tasks_due'][] = [
                        'title'  => (string) ($t['title'] ?? ''),
                        'due_on' => (string) ($t['due_on'] ?? ''),
                    ];
                }
            } catch (Exception $e2) {
                $out['errors'][] = 'taken: ' . $e2->getMessage();
            }
        }

        // Telefoons gepland voor vandaag.
        try {
            $res = $this->api('calls.list', [
                'filter' => ['scheduled_after' => $today, 'scheduled_before' => $today],
                'page'   => ['size' => 15, 'number' => 1],
            ]);
            foreach (($res['data'] ?? []) as $c) {
                $out['calls_today'][] = [
                    'description' => (string) ($c['description'] ?? 'Telefoon'),
                    'at'          => (string) ($c['scheduled_at'] ?? ''),
                ];
            }
        } catch (Exception $e) {
            $out['errors'][] = 'telefoons: ' . $e->getMessage();
        }

        // Agenda-afspraken vandaag.
        try {
            $startDay = (new DateTime($today . 'T00:00:00', $tz))->format('c');
            $endDay   = (new DateTime($today . 'T23:59:59', $tz))->format('c');
            $res = $this->api('events.list', [
                'filter' => ['starts_before' => $endDay, 'ends_after' => $startDay],
                'page'   => ['size' => 15, 'number' => 1],
                'sort'   => [['field' => 'starts_at', 'order' => 'asc']],
            ]);
            foreach (($res['data'] ?? []) as $ev) {
                $out['events_today'][] = [
                    'title' => (string) ($ev['title'] ?? ''),
                    'at'    => $this->humanDatetime((string) ($ev['starts_at'] ?? '')),
                ];
            }
        } catch (Exception $e) {
            $out['errors'][] = 'agenda: ' . $e->getMessage();
        }

        // Openstaande facturen (cashflow) + vervallen.
        try {
            $res = $this->api('invoices.list', [
                'filter' => ['status' => ['outstanding']],
                'page'   => ['size' => 100, 'number' => 1],
            ]);
            $sum = 0.0;
            $overdue = 0;
            foreach (($res['data'] ?? []) as $inv) {
                $sum += (float) ($inv['total']['due']['amount'] ?? $inv['total']['payable']['amount'] ?? 0);
                $dueOn = (string) ($inv['due_on'] ?? '');
                if ($dueOn !== '' && $dueOn < $today) {
                    $overdue++;
                }
            }
            $out['invoices_open'] = ['count' => count($res['data'] ?? []), 'value' => $sum, 'overdue' => $overdue];
        } catch (Exception $e) {
            $out['errors'][] = 'facturen: ' . $e->getMessage();
        }

        return $out;
    }
}
