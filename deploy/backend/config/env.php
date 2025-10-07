<?php
// Lightweight .env loader and helper for production and local
// Usage: require_once __DIR__ . '/env.php'; then env('KEY','default')

if (!defined('ENV_LOADED')) {
    define('ENV_LOADED', true);

    // Polyfills for PHP < 8
    if (!function_exists('str_starts_with')) {
        function str_starts_with($haystack, $needle) {
            if ($needle === '') return true;
            return strncmp($haystack, $needle, strlen($needle)) === 0;
        }
    }
    if (!function_exists('str_ends_with')) {
        function str_ends_with($haystack, $needle) {
            if ($needle === '') return true;
            return substr($haystack, -strlen($needle)) === $needle;
        }
    }

    if (!function_exists('env')) {
        function env($key, $default = null) {
            // Priority: $_ENV -> getenv -> $_SERVER -> default
            if (isset($_ENV[$key])) return $_ENV[$key];
            $val = getenv($key);
            if ($val !== false) return $val;
            if (isset($_SERVER[$key])) return $_SERVER[$key];
            return $default;
        }
    }

    // Helper to load env file
    $load_env_file = function($path, $override = false) {
        if (!is_readable($path)) return;
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') continue;
            $pos = strpos($line, '=');
            if ($pos === false) continue;
            $name = trim(substr($line, 0, $pos));
            $value = trim(substr($line, $pos + 1));
            if ((str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
                $value = substr($value, 1, -1);
            }
            if ($override) {
                $_ENV[$name] = $value;
                @putenv($name . '=' . $value);
            } else {
                if (!isset($_ENV[$name]) && getenv($name) === false) {
                    $_ENV[$name] = $value;
                    @putenv($name . '=' . $value);
                }
            }
        }
    };

    // Load .env then .env.local to override for local development
    $root = dirname(__DIR__, 2);
    $envPath = $root . DIRECTORY_SEPARATOR . '.env';
    $envLocalPath = $root . DIRECTORY_SEPARATOR . '.env.local';
    $load_env_file($envPath, false);
    $load_env_file($envLocalPath, true);
}

