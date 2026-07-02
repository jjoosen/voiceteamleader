<?php
// HTML-weergave voor de KMO Cockpit: login, dashboard, spraakcommando,
// instellingen en status. Spraak-naar-tekst gebeurt in de browser via de
// Web Speech API (werkt het best in Chrome op desktop/Android).

declare(strict_types=1);

function ui_esc(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function ui_style(): string
{
    return <<<'CSS'
:root{
  color-scheme: light dark;
  --bg:#f4f1ea; --card:#fffdf8; --ink:#1f2421; --muted:#6b6457;
  --line:#e7e1d4; --brand:#c0623c; --brand-dark:#a8512f;
  --ok:#1c6b3a; --ok-bg:#e9f6ee; --warn-bg:#fff6e6; --warn-line:#f0dca8;
  --err:#8a2017; --err-bg:#fdecea; --chip:#efe9dd;
}
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  margin:0;background:var(--bg);color:var(--ink);min-height:100vh;line-height:1.5}
a{color:var(--brand)}
.wrap{max-width:1080px;margin:0 auto;padding:1.25rem}
.center-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.25rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;
  box-shadow:0 10px 40px rgba(0,0,0,.06);padding:1.5rem}
.card+.card{margin-top:1rem}
h1{margin:0;font-size:1.4rem}
h2{margin:0 0 .75rem;font-size:1.05rem}
.sub{margin:.15rem 0 0;color:var(--muted);font-size:.9rem}
label{display:block;font-size:.85rem;color:var(--muted);margin-bottom:.35rem}
input[type=password],input[type=text],textarea,select{width:100%;padding:.7rem .8rem;
  border:1px solid #d9d2c4;border-radius:10px;font-size:1rem;background:#fff;color:inherit;font-family:inherit}
textarea{min-height:120px;resize:vertical}
button{font:inherit;cursor:pointer;border:none;border-radius:10px;padding:.7rem 1.05rem;font-weight:600}
.primary{background:var(--brand);color:#fff}.primary:hover{background:var(--brand-dark)}
.ghost{background:var(--chip);color:var(--ink)}.ghost:hover{filter:brightness(.97)}
.row{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center}
.spacer{height:1rem}
.muted{color:var(--muted);font-size:.85rem}
code{background:var(--chip);padding:.1rem .35rem;border-radius:6px;font-size:.85em;word-break:break-all}
/* Topbar */
.topbar{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1rem;flex-wrap:wrap}
.brandmark{display:flex;align-items:center;gap:.6rem}
.logo{width:38px;height:38px;border-radius:10px;background:var(--brand);color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700}
nav.tabs{display:flex;gap:.35rem;flex-wrap:wrap}
nav.tabs a{text-decoration:none;color:var(--muted);padding:.45rem .8rem;border-radius:999px;font-size:.9rem;font-weight:600}
nav.tabs a.active{background:var(--brand);color:#fff}
nav.tabs a:hover:not(.active){background:var(--chip)}
/* KPI grid */
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.1rem}
.kpi .big{font-size:1.8rem;font-weight:700;margin:.1rem 0}
.kpi .lbl{color:var(--muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.03em}
.kpi.alert{border-color:var(--warn-line);background:var(--warn-bg)}
/* lists */
.list{list-style:none;margin:0;padding:0}
.list li{display:flex;justify-content:space-between;gap:.75rem;padding:.55rem 0;border-bottom:1px solid var(--line)}
.list li:last-child{border-bottom:none}
.list .when{color:var(--muted);font-size:.85rem;white-space:nowrap}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}
.empty{color:var(--muted);font-size:.9rem;padding:.4rem 0}
/* messages */
.error{background:var(--err-bg);color:var(--err);padding:.6rem .8rem;border-radius:10px;margin-bottom:1rem;font-size:.9rem}
.ok{background:var(--ok-bg);color:var(--ok);padding:.8rem 1rem;border-radius:10px}
.banner{background:var(--warn-bg);border:1px solid var(--warn-line);padding:.8rem 1rem;border-radius:10px;margin-bottom:1rem;font-size:.9rem}
/* mic */
.mic-wrap{text-align:center}
.mic{width:92px;height:92px;border-radius:50%;font-size:2.1rem;background:var(--brand);color:#fff}
.mic.recording{background:#d23b2e;animation:pulse 1.2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(210,59,46,.5)}70%{box-shadow:0 0 0 18px rgba(210,59,46,0)}100%{box-shadow:0 0 0 0 rgba(210,59,46,0)}}
.chips{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.6rem}
.chip{background:var(--chip);border:none;color:var(--ink);padding:.35rem .7rem;border-radius:999px;font-size:.82rem;cursor:pointer}
.chip:hover{filter:brightness(.97)}
.result-item{display:flex;gap:.6rem;align-items:flex-start;padding:.5rem 0;border-bottom:1px solid var(--line)}
.result-item:last-child{border-bottom:none}
.tag{font-size:.7rem;text-transform:uppercase;letter-spacing:.03em;padding:.15rem .5rem;border-radius:999px;background:var(--chip);color:var(--muted);white-space:nowrap;margin-top:.15rem}
table.diag{width:100%;border-collapse:collapse}
table.diag td{padding:.4rem .6rem;vertical-align:top}
CSS;
}

function ui_page(string $title, string $body): string
{
    $style = ui_style();
    $t = ui_esc($title);
    return "<!doctype html>\n<html lang=\"nl\"><head><meta charset=\"utf-8\">"
        . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        . "<title>$t</title><style>$style</style></head><body>$body</body></html>";
}

// Gemeenschappelijke schil met topbar + tabbladen.
function ui_shell(string $active, string $inner, string $adapterName): string
{
    $tab = function (string $key, string $href, string $label) use ($active): string {
        $cls = $key === $active ? 'active' : '';
        return "<a class=\"$cls\" href=\"$href\">" . ui_esc($label) . "</a>";
    };
    $an = ui_esc($adapterName);
    return <<<HTML
<div class="wrap">
  <div class="topbar">
    <div class="brandmark">
      <div class="logo">◆</div>
      <div><h1>KMO Cockpit</h1><p class="sub">op $an</p></div>
    </div>
    <nav class="tabs">
      {$tab('dashboard', '?', 'Dashboard')}
      {$tab('command', '?action=command', 'Spraakcommando')}
      {$tab('settings', '?action=settings', 'Instellingen')}
      {$tab('status', '?action=status', 'Status')}
      <a href="?action=logout">Uitloggen</a>
    </nav>
  </div>
  $inner
</div>
HTML;
}

function ui_login_page(string $error): string
{
    $err = $error !== '' ? '<div class="error">' . ui_esc($error) . '</div>' : '';
    $body = <<<HTML
<div class="center-page"><div class="card" style="max-width:440px;width:100%">
  <div class="brandmark" style="margin-bottom:1rem">
    <div class="logo">◆</div><div><h1>KMO Cockpit</h1><p class="sub">Spreek. De cockpit doet de rest.</p></div>
  </div>
  $err
  <form method="POST" action="?action=login">
    <label for="password">Toegangscode</label>
    <input id="password" name="password" type="password" autocomplete="current-password" autofocus>
    <div class="spacer"></div>
    <button class="primary" type="submit" style="width:100%">Inloggen</button>
  </form>
</div></div>
HTML;
    return ui_page('KMO Cockpit — inloggen', $body);
}

// --- Dashboard ---------------------------------------------------------------

function ui_dashboard_page(array $d, bool $connected, string $redirectUri, string $adapterName): string
{
    if (!$connected) {
        return ui_page('KMO Cockpit', ui_shell('dashboard', ui_connect_banner($redirectUri, $adapterName), $adapterName));
    }

    $hi = $d['me'] ? 'Dag ' . ui_esc((string) $d['me']) : 'Overzicht';
    $dealVal = erp_money((float) ($d['open_deals']['value'] ?? 0));
    $dealCnt = (int) ($d['open_deals']['count'] ?? 0);
    $invVal  = erp_money((float) ($d['invoices_open']['value'] ?? 0));
    $invCnt  = (int) ($d['invoices_open']['count'] ?? 0);
    $overdue = (int) ($d['invoices_open']['overdue'] ?? 0);
    $taskCnt = count($d['tasks_due'] ?? []);
    $agendaCnt = count($d['events_today'] ?? []) + count($d['calls_today'] ?? []);

    $invAlert = $overdue > 0 ? ' alert' : '';
    $overdueTxt = $overdue > 0 ? "<div class=\"muted\">$overdue vervallen</div>" : '';

    // Taken vandaag/te laat
    $tasks = ui_list_or_empty(array_map(function ($t) {
        return ['left' => ui_esc($t['title']), 'right' => ui_esc($t['due_on'])];
    }, $d['tasks_due'] ?? []), 'Geen openstaande taken. 🎉');

    // Agenda vandaag (afspraken + telefoons)
    $agendaItems = [];
    foreach (($d['events_today'] ?? []) as $ev) {
        $agendaItems[] = ['left' => '📅 ' . ui_esc($ev['title']), 'right' => ui_esc($ev['at'])];
    }
    foreach (($d['calls_today'] ?? []) as $c) {
        $agendaItems[] = ['left' => '📞 ' . ui_esc($c['description']), 'right' => ui_esc($c['at'])];
    }
    $agenda = ui_list_or_empty($agendaItems, 'Niets in de agenda vandaag.');

    $errNote = '';
    if (!empty($d['errors'])) {
        $errNote = '<p class="muted" style="margin-top:1rem">Sommige onderdelen konden niet laden. '
            . 'Kijk bij <a href="?action=status">Status</a> voor details.</p>';
    }

    $inner = <<<HTML
<div class="card">
  <h1 style="font-size:1.2rem">$hi</h1>
  <p class="sub">Je dag in één oogopslag — live uit $adapterName.</p>
</div>
<div class="spacer"></div>
<div class="kpis">
  <div class="kpi"><div class="lbl">Pipeline (open)</div><div class="big">$dealVal</div><div class="muted">$dealCnt deals</div></div>
  <div class="kpi$invAlert"><div class="lbl">Openstaande facturen</div><div class="big">$invVal</div>$overdueTxt<div class="muted">$invCnt facturen</div></div>
  <div class="kpi"><div class="lbl">Taken te doen</div><div class="big">$taskCnt</div><div class="muted">vandaag of te laat</div></div>
  <div class="kpi"><div class="lbl">Agenda vandaag</div><div class="big">$agendaCnt</div><div class="muted">afspraken + telefoons</div></div>
</div>
<div class="spacer"></div>
<div class="cols">
  <div class="card"><h2>Taken</h2>$tasks</div>
  <div class="card"><h2>Vandaag</h2>$agenda</div>
</div>
<div class="card" style="margin-top:1rem;text-align:center">
  <p class="sub" style="margin-bottom:.6rem">Iets toe te voegen? Spreek het gewoon in.</p>
  <a class="primary" href="?action=command" style="display:inline-block;text-decoration:none;padding:.75rem 1.3rem;border-radius:10px">🎙️ Nieuw spraakcommando</a>
  $errNote
</div>
HTML;
    return ui_page('KMO Cockpit — dashboard', ui_shell('dashboard', $inner, $adapterName));
}

function ui_list_or_empty(array $items, string $emptyText): string
{
    if (!$items) {
        return '<div class="empty">' . ui_esc($emptyText) . '</div>';
    }
    $rows = '';
    foreach ($items as $it) {
        $rows .= '<li><span>' . $it['left'] . '</span><span class="when">' . $it['right'] . '</span></li>';
    }
    return '<ul class="list">' . $rows . '</ul>';
}

function ui_connect_banner(string $redirectUri, string $adapterName): string
{
    $uri = ui_esc($redirectUri);
    $an = ui_esc($adapterName);
    return <<<HTML
<div class="card">
  <div class="banner"><strong>Nog niet verbonden met $an.</strong><br>
    Registreer in je $an-integratie deze redirect-URL:<br><code>$uri</code></div>
  <a class="primary" href="?action=oauth_start" style="display:inline-block;text-decoration:none;padding:.7rem 1.1rem;border-radius:10px">Verbind met $an</a>
</div>
HTML;
}

// --- Spraakcommando ----------------------------------------------------------

function ui_command_page(bool $connected, string $redirectUri, string $adapterName, string $locale): string
{
    if (!$connected) {
        return ui_page('KMO Cockpit', ui_shell('command', ui_connect_banner($redirectUri, $adapterName), $adapterName));
    }
    $lang = ui_esc($locale !== '' ? $locale : 'nl-BE');
    $script = str_replace('__LANG__', $lang, ui_command_script());
    $examples = [
        'Bel morgen bakkerij Janssens terug over de nieuwe ovens',
        'Nieuwe deal voor Garage Peeters, onderhoudscontract 8000 euro',
        'Plan volgende dinsdag om 14u een afspraak bij Meubelmakerij De Wit',
        'Noteer 2 uur gewerkt aan de website van apotheek Somers',
        'Nieuw contact Jan Vermeulen, jan@vermeulen.be, van bouwbedrijf Vermeulen',
    ];
    $chips = '';
    foreach ($examples as $ex) {
        $chips .= '<button class="chip" type="button" data-ex="' . ui_esc($ex) . '">' . ui_esc($ex) . '</button>';
    }

    $inner = <<<HTML
<div class="card">
  <h2>Spreek je dag in — de cockpit regelt de rest</h2>
  <p class="sub">Eén of meerdere acties tegelijk: deal, taak, telefoon, afspraak, contact, notitie of uren. Claude herkent wat je bedoelt en zet het klaar in $adapterName.</p>
  <div class="spacer"></div>
  <div class="mic-wrap">
    <button id="mic" class="mic" type="button" title="Start/stop opname">🎙️</button>
    <p class="muted" id="status">Tik op de microfoon en spreek.</p>
  </div>
  <div class="spacer"></div>
  <label for="transcript">Wat je zei (aanpasbaar)</label>
  <textarea id="transcript" placeholder="Bijv: Bel morgen bakkerij Janssens terug én maak een offerte voor de nieuwe ovens van 12000 euro..."></textarea>
  <div class="chips">$chips</div>
  <div class="spacer"></div>
  <div class="row">
    <button id="send" class="primary" type="button">Uitvoeren</button>
    <button id="clear" class="ghost" type="button">Wissen</button>
  </div>
  <div class="spacer"></div>
  <div id="result"></div>
</div>
<script>$script</script>
HTML;
    return ui_page('KMO Cockpit — spraakcommando', ui_shell('command', $inner, $adapterName));
}

function ui_command_script(): string
{
    return <<<'JS'
const micBtn=document.getElementById("mic"),statusEl=document.getElementById("status"),
  transcriptEl=document.getElementById("transcript"),sendBtn=document.getElementById("send"),
  clearBtn=document.getElementById("clear"),resultEl=document.getElementById("result");
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let recognition=null,recording=false,baseText="";
if(!SR){statusEl.textContent="Spraakherkenning wordt niet ondersteund in deze browser. Typ hieronder.";micBtn.disabled=true;}
else{
  recognition=new SR();recognition.lang="__LANG__";recognition.continuous=true;recognition.interimResults=true;
  recognition.onresult=(e)=>{let interim="",fin="";for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];if(r.isFinal)fin+=r[0].transcript;else interim+=r[0].transcript;}if(fin)baseText=(baseText+" "+fin).trim();transcriptEl.value=(baseText+" "+interim).trim();};
  recognition.onerror=(e)=>{statusEl.textContent="Fout bij spraakherkenning: "+e.error;stop();};
  recognition.onend=()=>{if(recording){try{recognition.start();}catch(_){}}};
}
function start(){if(!recognition)return;baseText=transcriptEl.value.trim();recording=true;micBtn.classList.add("recording");statusEl.textContent="Aan het luisteren… tik opnieuw om te stoppen.";try{recognition.start();}catch(_){}}
function stop(){recording=false;micBtn.classList.remove("recording");statusEl.textContent="Gestopt. Controleer en voer uit.";if(recognition){try{recognition.stop();}catch(_){}}}
micBtn.addEventListener("click",()=>recording?stop():start());
clearBtn.addEventListener("click",()=>{baseText="";transcriptEl.value="";resultEl.innerHTML="";});
document.querySelectorAll(".chip").forEach(c=>c.addEventListener("click",()=>{transcriptEl.value=c.dataset.ex;baseText=c.dataset.ex;}));
const ICON={deal:"🤝",contact:"👤",company:"🏢",task:"✅",call:"📞",meeting:"📅",note:"📝",time:"⏱️"};
sendBtn.addEventListener("click",async()=>{
  const text=transcriptEl.value.trim();
  if(!text){resultEl.innerHTML='<div class="error">Niets om uit te voeren.</div>';return;}
  if(recording)stop();
  sendBtn.disabled=true;sendBtn.textContent="Bezig…";
  resultEl.innerHTML='<p class="muted">Claude analyseert en voert uit…</p>';
  try{
    const res=await fetch("?action=process",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({transcript:text})});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Onbekende fout");
    let html='<div class="ok"><strong>'+esc(data.summary||"Klaar.")+'</strong></div><div class="spacer"></div>';
    (data.results||[]).forEach(r=>{
      const ic=ICON[r.type]||"•";
      const ok=r.ok?"✅":"⚠️";
      const line=r.ok?esc(r.label||r.type)+(r.created?' <span class="muted">(nieuw aangemaakt)</span>':''):esc(r.detail);
      html+='<div class="result-item"><span class="tag">'+ic+' '+esc(r.type)+'</span><div>'+ok+' '+line+'</div></div>';
    });
    resultEl.innerHTML=html;
    baseText="";transcriptEl.value="";
  }catch(err){resultEl.innerHTML='<div class="error">'+esc(err.message)+'</div>';}
  finally{sendBtn.disabled=false;sendBtn.textContent="Uitvoeren";}
});
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
JS;
}

// --- Instellingen ------------------------------------------------------------

function ui_settings_page(array $config, ErpAdapter $adapter, string $redirectUri): string
{
    $connected = $adapter->isConnected();
    [$pingOk, $pingMsg] = $connected ? $adapter->ping() : [false, 'niet verbonden'];
    $statusLine = $connected
        ? ($pingOk ? '<span style="color:var(--ok)">● ' . ui_esc($pingMsg) . '</span>'
                   : '<span style="color:var(--err)">● ' . ui_esc($pingMsg) . '</span>')
        : '<span class="muted">● niet verbonden</span>';

    $rows = '';
    foreach (erp_available() as $key => $info) {
        $active = $key === $adapter->key();
        $badge = $info['status'] === 'actief'
            ? '<span class="tag" style="color:var(--ok)">actief</span>'
            : '<span class="tag">' . ui_esc($info['status']) . '</span>';
        $mark = $active ? ' — <strong>in gebruik</strong>' : '';
        $rows .= '<li><span>' . ui_esc($info['name']) . $mark . '</span>' . $badge . '</li>';
    }

    $connectBtn = $connected
        ? '<form method="POST" action="?action=disconnect"><button class="ghost" type="submit">Verbinding verbreken</button></form>'
        : '<a class="primary" href="?action=oauth_start" style="display:inline-block;text-decoration:none;padding:.7rem 1.1rem;border-radius:10px">Verbind met ' . ui_esc($adapter->name()) . '</a>';

    $uri = ui_esc($redirectUri);
    $an = ui_esc($adapter->name());
    $locale = ui_esc((string) ($config['LOCALE'] ?? 'nl-BE'));

    $inner = <<<HTML
<div class="card">
  <h2>Verbinding</h2>
  <p class="sub">Actief systeem: <strong>$an</strong> — $statusLine</p>
  <div class="spacer"></div>
  <p class="muted">Redirect-URL voor je $an-integratie:</p>
  <code>$uri</code>
  <div class="spacer"></div>
  $connectBtn
</div>
<div class="card">
  <h2>Systemen</h2>
  <p class="sub">De cockpit werkt bovenop het systeem dat je al gebruikt. Meer adapters volgen.</p>
  <div class="spacer"></div>
  <ul class="list">$rows</ul>
</div>
<div class="card">
  <h2>Voorkeuren</h2>
  <ul class="list">
    <li><span>Taal / spraak</span><span class="when">$locale</span></li>
    <li><span>AI-model</span><span class="when">Claude</span></li>
  </ul>
  <p class="muted" style="margin-top:.6rem">Deze voorkeuren pas je aan in <code>config.php</code>.</p>
</div>
HTML;
    return ui_page('KMO Cockpit — instellingen', ui_shell('settings', $inner, $adapter->name()));
}

// --- Status / diagnose -------------------------------------------------------

function ui_status_page(array $checks, string $adapterName): string
{
    $rows = '';
    foreach ($checks as [$label, $ok, $detail]) {
        $icon = $ok ? '✅' : '❌';
        $rows .= '<tr><td style="font-size:1.1rem">' . $icon . '</td>'
            . '<td><strong>' . ui_esc($label) . '</strong></td>'
            . '<td class="muted">' . ui_esc((string) $detail) . '</td></tr>';
    }
    $inner = <<<HTML
<div class="card">
  <h2>Status &amp; diagnose</h2>
  <p class="sub">Staat alles klaar om te werken?</p>
  <div class="spacer"></div>
  <table class="diag">$rows</table>
</div>
HTML;
    return ui_page('KMO Cockpit — status', ui_shell('status', $inner, $adapterName));
}
