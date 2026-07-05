# Binnendeuren configurator

Een online verkooppunt / configurator voor binnendeuren, gericht op de
**particuliere markt (gezinnen)** én **aannemers/vakmannen**. De bezoeker
beantwoordt enkele vragen over zijn wensen, krijgt meteen de **beste deur
aanbevolen**, en verfijnt daarna afwerking, model, maat en beslag — met een
**live richtprijs** en een grote **live deur-preview** die meebeweegt.

De productdata (afwerkingen, modellen, maten, prijzen) is gebaseerd op de
aangeleverde folders & prijslijsten. De app is **white-label**: er staat geen
fabrikantsnaam in de interface.

## Wat het doet

1. **Modus-keuze** — Particulier (prijzen incl. btw) of Aannemer (prijzen excl.
   btw + btw-lijn en incl.-totaal).
2. **Adviesmotor** — 6 eenvoudige vragen (ruimte, look, budget, hoogte, glas,
   geluid) → scoort alle productlijnen en beveelt de beste aan.
3. **Configuratie in stappen** — lijn → afwerking → model → maat & draairichting
   → deurkast/slot/kruk → toebehoren.
4. **Live preview + live prijs** — een SVG-deur toont afwerking, model, glas,
   krukzijde en kastkleur; de prijs herberekent bij elke keuze.
5. **Offerte-aanvraag** — klant vult zijn gegevens in; de volledige configuratie
   + richtprijs wordt per e-mail verstuurd (met mailto-fallback) en lokaal
   bewaard. Optionele hook om door te sturen naar Teamleader.

## Productlijnen (data-gedreven)

| Lijn | Kenmerk | Hoogte |
| --- | --- | --- |
| Te verven — Serie 10 | Budget, schilderklaar | tot 211,5 cm |
| Invisible Flat | Vlaggenschip, gelijkliggende lijsten | tot 211,5 cm |
| Steel Look Feeling | Staal + veiligheidsglas | tot 211,5 cm |
| Invisible Loft / Loft Plus | Hoge deuren, verdoken | tot 231,5 cm |
| Endless Loft / Loft Plus | Op maat, zonder lijsten | tot 300 cm |

Nieuwe afwerkingen, modellen of prijzen voeg je toe in `assets/catalog.js`
zonder de logica aan te passen.

## Bestanden

| Bestand | Doel |
| --- | --- |
| `index.php` | Startpagina (PHP-wrapper voor Combell) |
| `assets/catalog.js` | Productcatalogus / datamodel (prijzen incl. btw) |
| `assets/app.js` | Adviesmotor, prijsberekening, live preview, wizard |
| `assets/style.css` | Styling |
| `lead.php` | Verwerkt offerte-aanvraag (e-mail + optioneel Teamleader) |
| `config.example.php` | Kopieer naar `config.php` en vul je e-mail in |
| `standalone.html` | **Zelfstandige één-bestand-versie** (voor snelle test / iframe) |
| `data/` | Afgeschermde opslag van offerte-aanvragen |

## Installeren op Combell (zoals VoiceDeal)

1. Kopieer `config.example.php` → `config.php` en vul `LEAD_TO_EMAIL` en
   `LEAD_FROM_EMAIL` in (afzender moet een adres op je eigen domein zijn).
2. Upload de map `deurconfigurator/` via FTP naar je webruimte.
3. Zorg dat `data/` schrijfbaar is (rechten 755/775).
4. Open `https://jouwdomein.be/deurconfigurator/`.

## Snel testen zonder server

Open `standalone.html` rechtstreeks in je browser, of embed het als `<iframe>`
in je bestaande website. In die modus wordt de offerte via de e-mailclient van
de bezoeker verstuurd (mailto-fallback).

## Lokaal draaien

```sh
cd deurconfigurator
cp config.example.php config.php   # optioneel, voor e-mailtest
php -S localhost:8000
```

Open `http://localhost:8000/`.

## Let op

Prijzen zijn **richtprijzen** op basis van de aangeleverde prijslijsten en
dienen als indicatie; de definitieve prijs volgt op offerte. Pas ze aan in
`assets/catalog.js` wanneer nieuwe tarieven gelden.
