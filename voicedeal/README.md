# VoiceDeal (PHP / Combell)

Spreek in je browser een deal in → **Claude** structureert wat je zei →
de deal verschijnt in **Teamleader Focus** (met klant + notitie).

Deze versie draait als **gewone PHP-app** op klassieke webhosting zoals
**Combell** (PHP + Apache). Geen Node.js, geen Composer, geen installaties —
je uploadt de bestanden via FTP en vult één configuratiebestand in.

- Spraak-naar-tekst gebeurt in de **browser** (werkt het best in Chrome op
  desktop/Android). Claude doet de **structurering** tekst → deal.
- Beveiligd met een zelfgekozen toegangscode (`APP_PASSWORD`).

---

## Wat je nodig hebt

1. **Combell-hosting** met PHP (een standaard webhostingpakket volstaat) en een
   domein met **HTTPS**.
2. **Anthropic API-key** — console.anthropic.com → API Keys (begint met `sk-ant-`).
3. **Teamleader-integratie** — in de Teamleader Marketplace; geeft je een
   **Client ID** + **Client Secret**.

---

## Installatie op Combell (stap voor stap)

1. **Configuratie invullen**
   - Kopieer `config.example.php` naar `config.php`.
   - Vul in `config.php` je `TL_CLIENT_ID`, `TL_CLIENT_SECRET`,
     `ANTHROPIC_API_KEY` en een zelfgekozen `APP_PASSWORD` in.

2. **Uploaden via FTP**
   - Upload de hele map (`index.php`, `lib/`, `data/`, `config.php`) naar je
     webruimte, bijvoorbeeld naar een submap `voicedeal/` in je webroot
     (bij Combell vaak `httpdocs/` of `www/`).
   - Zorg dat de map `data/` **schrijfbaar** is (rechten 755 of 775). Daar
     bewaart de app de Teamleader-tokens (afgeschermd via `data/.htaccess`).

3. **Redirect-URL registreren in Teamleader**
   - Je app-URL wordt bijvoorbeeld: `https://jouwdomein.be/voicedeal/`
   - De redirect-URL is dan: `https://jouwdomein.be/voicedeal/?action=oauth_callback`
   - Zet die exacte URL als **redirect URI** in je Teamleader-integratie.
   - (De app toont deze URL ook op het scherm zolang je nog niet verbonden bent.)

4. **Eerste gebruik**
   - Open `https://jouwdomein.be/voicedeal/` en log in met je `APP_PASSWORD`.
   - Klik op **"Verbind met Teamleader"** en geef toestemming.
   - Tik op de microfoon, spreek je deal in, controleer het transcript en klik
     op **"Verstuur naar Teamleader"**.

---

## Veiligheid

- `config.php` is een PHP-bestand: de server voert het uit en geeft niets terug,
  dus je sleutels zijn niet via de browser leesbaar. Het staat in `.gitignore`.
- De Teamleader-tokens staan in `data/tokens.json`, afgeschermd door
  `data/.htaccess` (niet bereikbaar via de browser) en in `.gitignore`.

## Aanpassen aan jouw Teamleader-account

Sommige accounts vragen extra velden bij `deals.create` (bv. `source_id` of
`responsible_user_id`). Pas dat aan in `lib/teamleader.php` bij
`tl_create_deal`. De gestructureerde velden die Claude teruggeeft, pas je aan in
`lib/claude.php`.

## Bestanden

| Bestand | Doel |
| --- | --- |
| `index.php` | Router / startpunt |
| `config.example.php` | Voorbeeldconfig → kopieer naar `config.php` |
| `lib/auth.php` | Toegangscode + sessie |
| `lib/teamleader.php` | Teamleader OAuth2 + API (deals, klanten, notities) |
| `lib/claude.php` | Anthropic API: transcript → gestructureerde deal |
| `lib/ui.php` | Login- en app-pagina (incl. spraakopname) |
| `data/` | Tokenopslag (afgeschermd) |

## Lokaal testen (optioneel)

Met PHP op je eigen computer:

```sh
cd voicedeal
cp config.example.php config.php   # vul je gegevens in
php -S localhost:8000
```

Open `http://localhost:8000/`. Registreer dan tijdelijk
`http://localhost:8000/?action=oauth_callback` als redirect-URL in Teamleader.
