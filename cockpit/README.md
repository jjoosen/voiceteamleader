# KMO Cockpit

**Spreek je dag in — de cockpit regelt de rest.**

Een voice-first AI-cockpit die *bovenop* het ERP/CRM werkt dat een Benelux-kmo
al gebruikt. Je spreekt (of typt) vrij; **Claude** herkkent er één of meerdere
acties in en zet die meteen klaar in je systeem. Plus een **dashboard** dat je
dag in één oogopslag toont: pipeline, openstaande facturen, taken en agenda.

Draait als **gewone PHP-app** op klassieke webhosting (zoals Combell). Geen
Node.js, geen Composer — bestanden uploaden en één configuratiebestand invullen.

---

## Waarom dit, voor de kmo van vandaag

Benelux-kmo's *hebben* al een systeem (Teamleader Focus, Odoo, Exact…). Hun echte
pijn is niet "nog een tool", maar:

- **Administratie kost te veel tijd** — deals, taken, opvolging en uren registreren
  vraagt te veel klikken. → *Spreek het gewoon in.*
- **Versnippering** — CRM, agenda en cijfers staan los. → *Eén cockpit-overzicht.*
- **Je moet weten wáár iets hoort** — in welk menu? → *De AI beslist dat voor je.*

De cockpit vervangt je systeem niet; hij maakt het bedienbaar met je stem.

---

## Wat je kan inspreken (één of meerdere tegelijk)

| Je zegt… | De cockpit doet… |
|---|---|
| "Nieuwe deal voor Garage Peeters, onderhoudscontract 8000 euro" | maakt een **deal** (+ klant indien nieuw) |
| "Bel morgen bakkerij Janssens terug over de ovens" | plant een **telefoon** voor morgen |
| "Plan volgende dinsdag om 14u een afspraak bij De Wit" | zet een **agenda-afspraak** klaar |
| "Noteer 2 uur gewerkt aan de website van apotheek Somers" | boekt een **tijdsregistratie** |
| "Nieuw contact Jan Vermeulen, jan@vermeulen.be" | maakt een **contact** aan |
| "Voeg een notitie toe bij Meubelmakerij De Wit: klant wil eik" | zet een **notitie** bij de klant |

Meerdere acties in één adem? Claude splitst ze en voert ze allemaal uit.
Relatieve tijden ("morgen", "volgende dinsdag om 14u") worden correct omgerekend.

---

## Architectuur (kort)

```
Browser (spraak → tekst)
        │  transcript
        ▼
index.php ──► lib/ai.php      Claude: tekst → lijst van acties
        │                     (tool-use, altijd gestructureerd)
        ▼
lib/erp.php (ErpAdapter)      één interface voor élk systeem
        │
        ▼
lib/erp/teamleader.php        Teamleader Focus (OAuth2 + API v2)
```

De **adapter-architectuur** is bewust: `ErpAdapter` is een interface. Vandaag is
**Teamleader Focus** geïmplementeerd; **Odoo** en **Exact Online** kunnen er via
dezelfde interface bijkomen zonder de rest van de app aan te raken.

| Bestand | Rol |
|---|---|
| `index.php` | front controller / routing (`?action=…`, geen rewriting nodig) |
| `lib/ai.php` | Claude-motor: transcript → gestructureerde acties |
| `lib/erp.php` | adapter-interface + fabriek + gedeelde helpers |
| `lib/erp/teamleader.php` | Teamleader Focus-adapter (OAuth, acties, dashboard) |
| `lib/ui.php` | pagina's: login, dashboard, spraakcommando, instellingen, status |
| `lib/auth.php` | toegangsbeveiliging via `APP_PASSWORD` |

---

## Wat je nodig hebt

1. **Webhosting met PHP** (7.4+) en een domein met **HTTPS**.
2. **Anthropic API-key** — console.anthropic.com → API Keys (begint met `sk-ant-`).
3. **Teamleader-integratie** — Teamleader Marketplace → **Client ID** + **Secret**.

## Installatie

1. **Configuratie**: kopieer `config.example.php` naar `config.php` en vul
   `TL_CLIENT_ID`, `TL_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `APP_PASSWORD` in
   (en eventueel `LOCALE`/`TIMEZONE`).
2. **Uploaden via FTP** naar bv. `httpdocs/cockpit/`. Zorg dat de map `data/`
   **schrijfbaar** is (755/775) — daar staan de OAuth-tokens (afgeschermd via
   `data/.htaccess`).
3. **Redirect-URL registreren** in je Teamleader-integratie:
   `https://jouwdomein.be/cockpit/?action=oauth_callback`
4. **Eerste gebruik**: open de app, log in met je `APP_PASSWORD`, klik op
   *Verbind met Teamleader*, en spreek je eerste commando in.

> Spraak-naar-tekst gebeurt in de **browser** (Web Speech API — werkt het best
> in Chrome op desktop/Android). Werkt de spraakherkenning niet? Typen kan altijd.

---

## Veiligheid

- `config.php` is een PHP-bestand: de server voert het uit en geeft niets terug,
  dus je sleutels zijn niet via de browser leesbaar. Staat in `.gitignore`.
- OAuth-tokens staan in `data/tokens.json`, afgeschermd via `data/.htaccess`
  en `.gitignore`.
- De hele app zit achter een zelfgekozen toegangscode (`APP_PASSWORD`).

## Roadmap

- **Offertes & facturen** inspreken (Teamleader `quotations`/`invoices`), met oog
  op de **Peppol/e-facturatieverplichting (BE, sinds 2026)**.
- **Odoo-** en **Exact Online-adapters** via dezelfde `ErpAdapter`-interface.
- **Opvolging**: automatische herinneringen voor stilgevallen deals en vervallen
  facturen.
- **FR-taalversie** voor Wallonië/Brussel (`LOCALE=fr-BE`).

---

*Onderdeel van het VoiceTeamLeader-project. De losse `voicedeal/`-map is het
oorspronkelijke prototype (enkel deals); `cockpit/` is de uitgebreide opvolger.*
