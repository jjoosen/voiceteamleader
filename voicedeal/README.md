# VoiceDeal

Spreek een deal in je browser in → **Claude** structureert wat je zei →
de deal verschijnt in **Teamleader Focus** (met klant + notitie).

- Draait als **Cloudflare Worker** (geen aparte server nodig).
- Spraak-naar-tekst gebeurt in de **browser** (Web Speech API — werkt het best in
  Chrome op desktop/Android). Claude doet de **structurering** van tekst → deal.
- Beveiligd met een zelfgekozen toegangscode (`APP_PASSWORD`).

## Hoe het werkt

```
Browser (spraak → tekst)  ──►  Worker  ──►  Claude (structureert)  ──►  Teamleader (deal + notitie)
                                  └── Teamleader-tokens in KV (TOKENS) ──┘
```

1. Je tikt op de microfoon en spreekt je deal in (NL).
2. Het transcript gaat naar de Worker → `/api/process`.
3. Claude (`claude-opus-4-8`) zet het om naar: klantnaam, type, deal-titel,
   geschatte waarde en een nette notitie.
4. De Worker zoekt/maakt de klant in Teamleader, maakt de deal aan en hangt de
   notitie eraan.

---

## Setup runbook

> Pak deze map (`voicedeal/`) uit en ga erin staan.

```sh
cd voicedeal

# 1. Wrangler + login (sla over als al gebeurd)
npm install -g wrangler
wrangler login

# 2. KV-namespace voor de Teamleader-tokens
wrangler kv namespace create TOKENS
#  -> kopieer de "id" uit de output naar wrangler.toml bij [[kv_namespaces]]

# 3. Client ID invullen
#  -> zet je Teamleader client id in wrangler.toml bij [vars] TL_CLIENT_ID

# 4. Secrets zetten (je wordt per stuk om de waarde gevraagd)
wrangler secret put TL_CLIENT_SECRET      # client secret van de VoiceDeal-integratie
wrangler secret put ANTHROPIC_API_KEY     # je Anthropic API-key
wrangler secret put APP_PASSWORD          # zelfgekozen toegangscode voor de app

# 5. Deployen
wrangler deploy
#  -> noteer de URL: https://voicedeal.<SUBDOMEIN>.workers.dev
```

### Teamleader-integratie (redirect-URL)

Maak in de Teamleader Marketplace een integratie aan (of gebruik je bestaande
"VoiceDeal"-integratie) en zet de **redirect-URL** op:

```
https://voicedeal.<SUBDOMEIN>.workers.dev/oauth/callback
```

De app toont deze exacte URL ook in het scherm zolang je nog niet verbonden bent.
Gebruik de **Client ID** (in `wrangler.toml`) en het **Client Secret**
(`wrangler secret put TL_CLIENT_SECRET`).

### Eerste gebruik

1. Open de Worker-URL en log in met je `APP_PASSWORD`.
2. Klik op **"Verbind met Teamleader"** en geef toestemming.
3. Tik op de microfoon, spreek je deal in, controleer het transcript en klik op
   **"Verstuur naar Teamleader"**.

---

## Lokaal draaien

```sh
cp .dev.vars.example .dev.vars   # vul je secrets in (zie hieronder)
wrangler dev
```

Maak een bestand `.dev.vars` met:

```
TL_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...
APP_PASSWORD=...
```

(De redirect-URL is dan `http://localhost:8787/oauth/callback`; registreer die
tijdelijk in je Teamleader-integratie om lokaal te testen.)

---

## Aanpassen aan jouw Teamleader-account

Sommige Teamleader-accounts vragen extra velden bij het aanmaken van een deal
(bv. `source_id`, `department_id` of `responsible_user_id`). De API-laag staat
in [`src/teamleader.js`](src/teamleader.js) — pas de body in
`createDealFromExtraction` aan als `deals.create` een veld vereist. De
gestructureerde velden die Claude teruggeeft, pas je aan in
[`src/claude.js`](src/claude.js).

## Bestanden

| Bestand | Doel |
| --- | --- |
| `src/index.js` | Router / Worker-entry |
| `src/auth.js` | Toegangscode + ondertekende sessiecookie |
| `src/teamleader.js` | Teamleader OAuth2 + API (deals, klanten, notities) |
| `src/claude.js` | Anthropic API: transcript → gestructureerde deal |
| `src/ui.js` | Login- en app-pagina (incl. spraakopname) |
