<?php
// Toegangsbeveiliging via een zelfgekozen wachtwoord (APP_PASSWORD).
// Gewone PHP-sessies; na inloggen onthoudt de server dat in $_SESSION.

declare(strict_types=1);

function app_check_password(array $config, $attempt): bool
{
    if (!is_string($attempt) || $attempt === '') {
        return false;
    }
    return hash_equals((string) ($config['APP_PASSWORD'] ?? ''), $attempt);
}

function app_is_logged_in(): bool
{
    return !empty($_SESSION['app_authed']);
}
