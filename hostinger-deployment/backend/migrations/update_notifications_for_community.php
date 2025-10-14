<?php
require_once __DIR__ . '/../config/database.php';

$pdo = get_db_connection();

try {
    // Ensure notifications types can store community_* by relaxing ENUM if present
    // Since altering ENUM safely can be tricky across environments, we won't alter types here.
    // Our current notifications insert uses 'type' with values like 'community_submission', 'community_approved', 'community_rejected'.
    // If your notifications.type is ENUM without these values, consider changing it to VARCHAR(50) manually or extend the ENUM.

    // Try to add related_id column if missing (optional link to submission/build)
    $colCheck = $pdo->query("SHOW COLUMNS FROM notifications LIKE 'related_id'");
    if ($colCheck->rowCount() === 0) {
        $pdo->exec("ALTER TABLE notifications ADD COLUMN related_id INT NULL AFTER message");
        echo "Added related_id column to notifications.\n";
    } else {
        echo "related_id column already exists on notifications.\n";
    }
    echo "Migration completed.\n";
} catch (Exception $e) {
    echo "Migration error: " . $e->getMessage() . "\n";
}
?>


