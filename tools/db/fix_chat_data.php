<?php
$projectRoot = dirname(__DIR__, 2);
require_once $projectRoot . '/backend/config/database.php';

echo "Normalizing chat data\n";
echo "======================\n";

try {
    $pdo = get_db_connection();

    // 1) Fix invalid sender values
    $updated = $pdo->exec("UPDATE chat_messages SET sender='user' WHERE sender NOT IN ('user','admin','system') OR sender IS NULL OR sender='' ");
    echo "Fixed sender values: " . ((int)$updated) . " rows\n";

    // 2) Fix invalid read_status values
    $updated2 = $pdo->exec("UPDATE chat_messages SET read_status='unread' WHERE read_status NOT IN ('read','unread') OR read_status IS NULL OR read_status='' ");
    echo "Fixed read_status values: " . ((int)$updated2) . " rows\n";

    echo "Done.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}

?>

