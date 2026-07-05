<?php
/**
 * Configuratie voor de binnendeuren-configurator.
 * Kopieer dit bestand naar config.php en vul je gegevens in.
 * config.php staat in .gitignore en wordt door de server uitgevoerd (niet leesbaar via browser).
 */

// E-mailadres van de verkoper dat de offerte-aanvragen ontvangt.
define('LEAD_TO_EMAIL', 'verkoop@jouwdomein.be');

// Afzenderadres. Bij Combell moet dit een adres op JOUW domein zijn,
// anders wordt de mail geweigerd of als spam gemarkeerd.
define('LEAD_FROM_EMAIL', 'noreply@jouwdomein.be');

// Optioneel: aanvragen ook doorsturen naar Teamleader (hergebruik VoiceDeal-koppeling).
// Zet op true en werk lead.php af als je dit wil activeren.
define('TEAMLEADER_FORWARD', false);
