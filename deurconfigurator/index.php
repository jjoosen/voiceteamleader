<?php
/**
 * Group Thys — binnendeuren configurator (particuliere markt)
 * Startpunt. Draait als gewone PHP-app op Combell of eender welke PHP-host.
 * Alle configuratie-logica draait client-side (live prijs); de offerte-aanvraag
 * wordt via lead.php verwerkt (e-mail + optioneel Teamleader).
 */
$config = __DIR__ . '/config.php';
if (is_file($config)) { require $config; }
$asset_v = @filemtime(__DIR__ . '/assets/app.js') ?: time();
?><!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Binnendeuren configurator — stel je deur samen</title>
  <meta name="description" content="Stel online je binnendeur samen op basis van je wensen en ontvang meteen een richtprijs.">
  <link rel="stylesheet" href="assets/style.css?v=<?php echo $asset_v; ?>">
</head>
<body>
  <header class="site-header">
    <div class="inner">
      <div class="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 40 48" width="34" height="40">
          <rect x="3" y="2" width="34" height="44" rx="3" fill="#ffffff" opacity=".14"/>
          <rect x="8" y="6" width="24" height="36" rx="2" fill="#ffffff" opacity=".92"/>
          <circle cx="28" cy="24" r="1.8" fill="#0e4948"/>
        </svg>
      </div>
      <div>
        <h1>Binnendeuren configurator</h1>
        <p class="sub">Stel je deur samen op basis van je wensen</p>
      </div>
      <div id="mode-switch" class="mode-switch" aria-label="Modus"></div>
    </div>
  </header>

  <div class="mainnav-bar"><nav id="mainnav" class="mainnav" aria-label="Hoofdnavigatie"></nav></div>

  <nav id="stepper" aria-label="Stappen"></nav>

  <main id="app" aria-live="polite"><!-- app rendert hier --></main>

  <div id="summary-bar" aria-hidden="true">
    <div class="inner">
      <div>
        <div id="sum-line"></div>
        <div id="sum-detail"></div>
      </div>
      <div class="price">
        <span id="sum-price"></span>
        <small id="sum-vat">richtprijs incl. btw</small>
      </div>
    </div>
  </div>

  <script src="assets/catalog.js?v=<?php echo $asset_v; ?>"></script>
  <script src="assets/app.js?v=<?php echo $asset_v; ?>"></script>
</body>
</html>
