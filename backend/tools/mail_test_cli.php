<?php
// Simple CLI mail test using existing mailer config
// Usage (from project root): php backend/tools/mail_test_cli.php your@email.com "Subject" "Message"

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../utils/mailer.php';

if (php_sapi_name() !== 'cli') {
    fwrite(STDERR, "This script must be run from the command line." . PHP_EOL);
    exit(1);
}

$to = $argv[1] ?? '';
$subject = $argv[2] ?? ('[' . env('APP_NAME','SIMS') . '] CLI mail test');
$message = $argv[3] ?? 'If you received this, SMTP is working.';

if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Usage: php backend/tools/mail_test_cli.php recipient@example.com [subject] [message]" . PHP_EOL);
    exit(1);
}

[$ok, $err] = sendMailGmail($to, $subject, nl2br(htmlspecialchars($message)), $message);
if (!$ok) {
    fwrite(STDERR, "Failed: $err" . PHP_EOL);
    exit(2);
}

fwrite(STDOUT, "Success: sent to $to" . PHP_EOL);

