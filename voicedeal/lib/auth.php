<?php
// Toegangsbeveiliging via een zelfgekozen wachtwoord (APP_PASSWORD).
// We gebruiken gewone PHP-sessies; na het inloggen onthoudt de server dat
// in $_SESSION.

function vd_check_password(array $config, $attempt): bool
{
    if (!is_string($attempt) || $attempt === '') {
        return false;
    }
    return hash_equals((string) ($config['APP_PASSWORD'] ?? ''), $attempt);
}

function vd_is_logged_in(): bool
{
    return !empty($_SESSION['vd_authed']);
}
