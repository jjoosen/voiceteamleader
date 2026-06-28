# Weerradar — Regen &amp; Onweer

Een fancy, geanimeerde weer-app (buienradar-stijl) die toont **of er regen of
onweer aankomt op jouw locatie**. Wordt locatie niet toegestaan, dan valt de
app automatisch terug op **Antwerpen**.

## Wat het doet

- **Locatie** via de browser (Geolocation). Geen toestemming of mislukt →
  **Antwerpen** als standaard.
- **Duidelijke melding** bovenaan: regent het nu, of komt er regen/onweer aan,
  en *over hoeveel uur*.
- **Uurstrook** met neerslag (mm) voor de komende uren.
- **Geanimeerde regenradar** op een donkere kaart — verleden + **voorspelling
  (nowcast)** — met play/pauze en een sleepbare tijdlijn.
- **Bewegende beelden**: geanimeerde weericoontjes (zon, wolken, regen,
  bliksem) en een regen-effect over het scherm als het regent.

## Gebruikte bronnen (gratis, geen API-key nodig)

- **Open-Meteo** — weersvoorspelling (regen, onweer, temperatuur).
- **RainViewer** — geanimeerde radartegels (verleden + nowcast).
- **Leaflet** + **CARTO** dark basemap — de kaart.
- **BigDataCloud** — locatienaam (reverse geocoding).

## Draaien

Het is één enkel bestand: `index.html`. Geen build, geen server nodig.

- Lokaal: open `index.html` in een moderne browser (Chrome/Edge/Safari).
- Online: upload `index.html` naar je webhosting. **HTTPS is vereist** voor de
  Geolocation API (anders werkt locatiebepaling niet en valt de app terug op
  Antwerpen).

> Tip: werkt het best op een telefoon — vandaar de mobiele, full-screen layout.
