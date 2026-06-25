<?php
// HTML-pagina's voor VoiceDeal (login + app). De app gebruikt de Web Speech API
// van de browser voor spraak-naar-tekst (werkt het best in Chrome op
// desktop/Android).

function vd_style(): string
{
    return <<<'CSS'
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0; background: #f4f1ea; color: #1f2421; min-height: 100vh;
  display: flex; align-items: center; justify-content: center; padding: 1.25rem;
}
.card {
  background: #fffdf8; width: 100%; max-width: 520px; border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0,0,0,.08); padding: 1.75rem; border: 1px solid #e7e1d4;
}
h1 { margin: 0 0 .25rem; font-size: 1.5rem; }
.sub { margin: 0 0 1.25rem; color: #6b6457; font-size: .95rem; }
label { display: block; font-size: .85rem; color: #6b6457; margin-bottom: .35rem; }
input[type=password], textarea {
  width: 100%; padding: .7rem .8rem; border: 1px solid #d9d2c4; border-radius: 10px;
  font-size: 1rem; background: #fff; color: inherit; font-family: inherit;
}
textarea { min-height: 130px; resize: vertical; line-height: 1.45; }
button { font: inherit; cursor: pointer; border: none; border-radius: 10px; padding: .75rem 1.1rem; font-weight: 600; }
.primary { background: #c0623c; color: #fff; }
.primary:hover { background: #a8512f; }
.ghost { background: #efe9dd; color: #1f2421; }
.ghost:hover { background: #e5dccb; }
.row { display: flex; gap: .6rem; flex-wrap: wrap; align-items: center; }
.mic { width: 84px; height: 84px; border-radius: 50%; font-size: 2rem; }
.mic.recording { background: #d23b2e; color: #fff; animation: pulse 1.2s infinite; }
@keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(210,59,46,.5)} 70%{box-shadow:0 0 0 16px rgba(210,59,46,0)} 100%{box-shadow:0 0 0 0 rgba(210,59,46,0)} }
.center { text-align: center; }
.muted { color: #6b6457; font-size: .85rem; }
.error { background: #fdecea; color: #8a2017; padding: .6rem .8rem; border-radius: 10px; margin-bottom: 1rem; font-size: .9rem; }
.ok { background: #e9f6ee; color: #1c6b3a; padding: .8rem 1rem; border-radius: 10px; font-size: .95rem; }
.banner { background: #fff6e6; border: 1px solid #f0dca8; padding: .8rem 1rem; border-radius: 10px; margin-bottom: 1rem; font-size: .9rem; }
code { background: #efe9dd; padding: .1rem .35rem; border-radius: 6px; font-size: .85em; word-break: break-all; }
.spacer { height: 1rem; }
.topbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; }
.topbar form { margin: 0; }
CSS;
}

function vd_page(string $title, string $body): string
{
    $style = vd_style();
    $t = htmlspecialchars($title);
    return "<!doctype html>\n<html lang=\"nl\"><head><meta charset=\"utf-8\">"
        . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        . "<title>$t</title><style>$style</style></head><body>$body</body></html>";
}

function vd_login_page(string $error): string
{
    $err = $error !== '' ? '<div class="error">' . htmlspecialchars($error) . '</div>' : '';
    $body = <<<HTML
<div class="card">
  <h1>VoiceDeal</h1>
  <p class="sub">Spreek een deal in, Claude zet hem in Teamleader.</p>
  $err
  <form method="POST" action="?action=login">
    <label for="password">Toegangscode</label>
    <input id="password" name="password" type="password" autocomplete="current-password" autofocus />
    <div class="spacer"></div>
    <button class="primary" type="submit" style="width:100%">Inloggen</button>
  </form>
</div>
HTML;
    return vd_page('VoiceDeal — inloggen', $body);
}

function vd_app_script(): string
{
    return <<<'JS'
const micBtn = document.getElementById("mic");
const statusEl = document.getElementById("status");
const transcriptEl = document.getElementById("transcript");
const sendBtn = document.getElementById("send");
const clearBtn = document.getElementById("clear");
const resultEl = document.getElementById("result");
const connected = __CONNECTED__;

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let recording = false;
let baseText = "";

if (!SR) {
  statusEl.textContent = "Spraakherkenning wordt niet ondersteund in deze browser. Typ je deal hieronder.";
  micBtn.disabled = true;
} else {
  recognition = new SR();
  recognition.lang = "nl-BE";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    let interim = "";
    let finalAdd = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) finalAdd += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (finalAdd) baseText = (baseText + " " + finalAdd).trim();
    transcriptEl.value = (baseText + " " + interim).trim();
  };
  recognition.onerror = (e) => { statusEl.textContent = "Fout bij spraakherkenning: " + e.error; stopRecording(); };
  recognition.onend = () => { if (recording) { try { recognition.start(); } catch (_) {} } };
}

function startRecording() {
  if (!recognition) return;
  baseText = transcriptEl.value.trim();
  recording = true;
  micBtn.classList.add("recording");
  statusEl.textContent = "Aan het luisteren... tik opnieuw om te stoppen.";
  try { recognition.start(); } catch (_) {}
}
function stopRecording() {
  recording = false;
  micBtn.classList.remove("recording");
  statusEl.textContent = "Opname gestopt. Controleer het transcript en verstuur.";
  if (recognition) { try { recognition.stop(); } catch (_) {} }
}

micBtn.addEventListener("click", () => recording ? stopRecording() : startRecording());
clearBtn.addEventListener("click", () => { baseText = ""; transcriptEl.value = ""; resultEl.innerHTML = ""; });

sendBtn.addEventListener("click", async () => {
  const text = transcriptEl.value.trim();
  if (!text) { resultEl.innerHTML = '<div class="error">Geen transcript om te versturen.</div>'; return; }
  if (recording) stopRecording();
  sendBtn.disabled = true;
  sendBtn.textContent = "Bezig...";
  resultEl.innerHTML = '<p class="muted">Claude structureert je deal en zet hem in Teamleader...</p>';
  try {
    const res = await fetch("?action=process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Onbekende fout");
    const d = data.deal;
    resultEl.innerHTML =
      '<div class="ok"><strong>Deal aangemaakt in Teamleader.</strong><br/>' +
      'Titel: ' + escapeHtml(d.deal_title) + '<br/>' +
      'Klant: ' + escapeHtml(d.customer_name) + (data.customerCreated ? ' (nieuw aangemaakt)' : '') + '<br/>' +
      (d.estimated_value ? 'Waarde: ' + escapeHtml(String(d.estimated_value)) + ' ' + escapeHtml(d.currency || 'EUR') + '<br/>' : '') +
      'Deal-id: <code>' + escapeHtml(data.dealId || '-') + '</code></div>';
    baseText = "";
    transcriptEl.value = "";
  } catch (err) {
    resultEl.innerHTML = '<div class="error">' + escapeHtml(err.message) + '</div>';
  } finally {
    sendBtn.disabled = !connected;
    sendBtn.textContent = "Verstuur naar Teamleader";
  }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
JS;
}

function vd_app_page(bool $connected, string $redirectUri): string
{
    $banner = '';
    if (!$connected) {
        $uri = htmlspecialchars($redirectUri);
        $banner = '<div class="banner"><strong>Nog niet verbonden met Teamleader.</strong><br/>'
            . 'Registreer in je Teamleader-integratie deze redirect-URL:<br/><code>' . $uri . '</code>'
            . '<div class="spacer"></div>'
            . '<a class="primary" href="?action=oauth_start" style="display:inline-block;text-decoration:none;padding:.6rem 1rem;border-radius:10px;">Verbind met Teamleader</a></div>';
    }
    $sendDisabled = $connected ? '' : 'disabled';
    $script = str_replace('__CONNECTED__', $connected ? 'true' : 'false', vd_app_script());

    $body = <<<HTML
<div class="card">
  <div class="topbar">
    <h1>VoiceDeal</h1>
    <form method="POST" action="?action=logout"><button class="ghost" type="submit">Uitloggen</button></form>
  </div>
  $banner
  <div class="center">
    <button id="mic" class="primary mic" type="button" title="Start/stop opname">&#127908;</button>
    <p class="muted" id="status">Tik op de microfoon en spreek je deal in.</p>
  </div>
  <div class="spacer"></div>
  <label for="transcript">Transcript (je mag dit aanpassen)</label>
  <textarea id="transcript" placeholder="Bijv: Nieuwe deal voor bakkerij Janssens, nieuwe ovens, geschatte waarde 12000 euro..."></textarea>
  <div class="spacer"></div>
  <div class="row">
    <button id="send" class="primary" type="button" $sendDisabled>Verstuur naar Teamleader</button>
    <button id="clear" class="ghost" type="button">Wissen</button>
  </div>
  <div class="spacer"></div>
  <div id="result"></div>
  <div class="spacer"></div>
  <p class="muted"><a href="?action=status">Status / diagnose</a></p>
</div>
<script>$script</script>
HTML;
    return vd_page('VoiceDeal', $body);
}

function vd_status_page(array $checks, string $baseUrl): string
{
    $rows = '';
    foreach ($checks as [$label, $ok, $detail]) {
        $icon = $ok ? '&#9989;' : '&#10060;';
        $rows .= '<tr><td style="padding:.4rem .6rem;font-size:1.1rem">' . $icon . '</td>'
            . '<td style="padding:.4rem .6rem"><strong>' . htmlspecialchars($label) . '</strong></td>'
            . '<td style="padding:.4rem .6rem;color:#6b6457">' . htmlspecialchars((string) $detail) . '</td></tr>';
    }
    $back = htmlspecialchars($baseUrl);
    $body = <<<HTML
<div class="card">
  <div class="topbar"><h1>Status</h1>
    <a class="ghost" href="$back" style="text-decoration:none;padding:.55rem .9rem;border-radius:10px;">Terug</a>
  </div>
  <p class="sub">Controle of alles klaarstaat om te werken.</p>
  <table style="width:100%;border-collapse:collapse">$rows</table>
</div>
HTML;
    return vd_page('VoiceDeal — status', $body);
}
