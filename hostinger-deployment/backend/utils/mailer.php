<?php
// Reusable mailer helper using PHPMailer with Gmail (OAuth2) or App Password
// Usage: require_once __DIR__ . '/mailer.php'; then call sendMailGmail($toEmail, $subject, $htmlBody, $altBody)

require_once __DIR__ . '/../config/env.php';

// Composer autoload from project root
$rootVendor = dirname(__DIR__, 2) . '/vendor/autoload.php';
if (is_readable($rootVendor)) {
    require_once $rootVendor;
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;
use PHPMailer\PHPMailer\OAuth as PHPMailerOAuth;
use League\OAuth2\Client\Provider\Google;

/**
 * Initialize a PHPMailer instance configured for Gmail.
 * Supports two auth modes:
 *  - OAuth2: set MAIL_AUTH=gmail_oauth and provide GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER
 *  - App Password: set MAIL_AUTH=gmail_password and provide GMAIL_USER, GMAIL_APP_PASSWORD
 */
function buildGmailMailer(): array {
    $debug = env('APP_DEBUG', '0');
    $appName = env('APP_NAME', 'SIMS');

    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = env('MAIL_HOST', 'smtp.gmail.com');
    $mail->Port = (int)env('MAIL_PORT', '587');
    $mail->SMTPSecure = env('MAIL_ENCRYPTION', 'tls'); // 'tls' or 'ssl'
    $mail->SMTPAuth = true;
    $mail->CharSet = 'UTF-8';
    $mail->isHTML(true);
    $mail->Timeout = 15;

    // Debug level
    $mail->SMTPDebug = ($debug === '1' || strtolower($debug) === 'true') ? 2 : 0; // 0 in production

    $fromEmail = env('MAIL_FROM_ADDRESS', env('GMAIL_USER', env('MAIL_USERNAME', '')));
    $fromName  = env('MAIL_FROM_NAME', $appName);
    if ($fromEmail) {
        try { $mail->setFrom($fromEmail, $fromName); } catch (Exception $e) { /* ignore */ }
    }

    // Auto-detect auth mode if not explicitly set
    $explicitAuth = env('MAIL_AUTH', '');
    $authMode = strtolower(trim($explicitAuth));
    if ($authMode === '') {
        $hasOAuth = env('GMAIL_USER', '') && env('GMAIL_CLIENT_ID', '') && env('GMAIL_CLIENT_SECRET', '') && env('GMAIL_REFRESH_TOKEN', '');
        $hasPass  = (env('GMAIL_USER', '') && env('GMAIL_APP_PASSWORD', '')) || (env('MAIL_USERNAME', '') && env('MAIL_PASSWORD', ''));
        if ($hasOAuth) {
            $authMode = 'gmail_oauth';
        } elseif ($hasPass) {
            $authMode = 'gmail_password';
        } else {
            // Default to password mode to work with existing MAIL_USERNAME/MAIL_PASSWORD values
            $authMode = 'gmail_password';
        }
    }

    if ($authMode === 'gmail_oauth') {
        $gmailUser = env('GMAIL_USER', '');
        $clientId = env('GMAIL_CLIENT_ID', '');
        $clientSecret = env('GMAIL_CLIENT_SECRET', '');
        $refreshToken = env('GMAIL_REFRESH_TOKEN', '');

        if (!$gmailUser || !$clientId || !$clientSecret || !$refreshToken) {
            return [null, 'Gmail OAuth2 is not fully configured. Missing one of: GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.'];
        }

        $mail->AuthType = 'XOAUTH2';
        $provider = new Google([
            'clientId' => $clientId,
            'clientSecret' => $clientSecret,
        ]);
        $mail->setOAuth(new PHPMailerOAuth([
            'provider' => $provider,
            'clientId' => $clientId,
            'clientSecret' => $clientSecret,
            'refreshToken' => $refreshToken,
            'userName' => $gmailUser,
        ]));
    } elseif ($authMode === 'gmail_password') {
        // Strongly recommended to use an App Password (with 2FA) not the account password
        $gmailUser = env('GMAIL_USER', env('MAIL_USERNAME', ''));
        $gmailPass = env('GMAIL_APP_PASSWORD', env('MAIL_PASSWORD', ''));
        if (!$gmailUser || !$gmailPass) {
            return [null, 'Gmail password auth not configured. Provide GMAIL_USER and GMAIL_APP_PASSWORD.'];
        }
        $mail->Username = $gmailUser;
        $mail->Password = $gmailPass;
    } else {
        return [null, 'Unsupported MAIL_AUTH mode. Use gmail_oauth or gmail_password.'];
    }

    return [$mail, null];
}

/**
 * Send an email via Gmail. Returns [bool success, string|null error]
 */
function sendMailGmail(string $toEmail, string $subject, string $htmlBody, ?string $altBody = null): array {
    // Dev fallback: allow fake send in local when creds are missing or when explicitly enabled
    $fake = env('MAIL_FAKE', '0');
    $appEnv = strtolower((string)env('APP_ENV', ''));
    $appDebug = strtolower((string)env('APP_DEBUG', '0'));
    $noCreds = (env('GMAIL_USER', '') === '' && env('MAIL_USERNAME', '') === '')
            || (env('GMAIL_APP_PASSWORD', '') === '' && env('MAIL_PASSWORD', '') === '');
    if ($fake === '1' || ($appEnv === 'local' && ($appDebug === '1' || $appDebug === 'true') && $noCreds)) {
        error_log('[MAILER] FAKE SEND enabled - would send to ' . $toEmail . ' subject=' . $subject);
        $alt = $altBody ?? strip_tags($htmlBody);
        error_log('[MAILER] FAKE CONTENT: ' . $alt);
        return [true, null];
    }

    [$mail, $err] = buildGmailMailer();
    if (!$mail) {
        error_log('[MAILER] Build failed: ' . $err);
        return [false, $err];
    }

    try {
        $mail->clearAllRecipients();
        $mail->addAddress($toEmail);
        $mail->Subject = $subject;
        $mail->Body = $htmlBody;
        $mail->AltBody = $altBody ?: strip_tags($htmlBody);
        $mail->send();
        return [true, null];
    } catch (PHPMailerException $e) {
        $msg = 'PHPMailer error: ' . $e->getMessage();
        error_log('[MAILER] ' . $msg);
        return [false, $msg];
    } catch (Throwable $t) {
        $msg = 'Mail send failed: ' . $t->getMessage();
        error_log('[MAILER] ' . $msg);
        return [false, $msg];
    }
}
