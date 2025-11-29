<?php
// backend/migrations/add_branch_inventory.php
// Idempotent migration to add branches and component_branch_stock tables and seed Bulacan/Marikina

require_once __DIR__ . '/../config/database.php';

$pdo = get_db_connection();

function tableExists(PDO $pdo, $table) {
    $stmt = $pdo->prepare("SHOW TABLES LIKE :table");
    $stmt->bindValue(':table', $table);
    $stmt->execute();
    return (bool)$stmt->fetch();
}

try {
    $pdo->beginTransaction();

    // Create branches table if not exists
    if (!tableExists($pdo, 'branches')) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS branches (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(64) NOT NULL UNIQUE,
            name VARCHAR(128) NOT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    // Create component_branch_stock if not exists
    if (!tableExists($pdo, 'component_branch_stock')) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS component_branch_stock (
            component_id INT NOT NULL,
            branch_id INT NOT NULL,
            stock_quantity INT NOT NULL DEFAULT 0,
            min_stock_level INT NULL,
            last_updated TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (component_id, branch_id),
            CONSTRAINT fk_cbs_component FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE,
            CONSTRAINT fk_cbs_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    // Seed branches BULACAN and MARIKINA if not present
    $getBranchId = function($code, $name) use ($pdo) {
        $sel = $pdo->prepare('SELECT id FROM branches WHERE code = ?');
        $sel->execute([$code]);
        $id = $sel->fetchColumn();
        if ($id) return (int)$id;
        $ins = $pdo->prepare('INSERT INTO branches (code, name) VALUES (?, ?)');
        $ins->execute([$code, $name]);
        return (int)$pdo->lastInsertId();
    };

    $bulacanId = $getBranchId('BULACAN', 'Bulacan');
    $marikinaId = $getBranchId('MARIKINA', 'Marikina');

    // Initialize component_branch_stock rows for all components if missing
    // Strategy: assign existing components.stock_quantity entirely to BULACAN if neither branch has entries.
    // Leave MARIKINA as 0 by default; admins can redistribute later.
    $components = $pdo->query('SELECT id, stock_quantity FROM components')->fetchAll(PDO::FETCH_ASSOC);

    $checkRow = $pdo->prepare('SELECT 1 FROM component_branch_stock WHERE component_id = ? AND branch_id = ?');
    $insertRow = $pdo->prepare('INSERT INTO component_branch_stock (component_id, branch_id, stock_quantity) VALUES (?, ?, ?)');

    foreach ($components as $c) {
        $cid = (int)$c['id'];
        $total = (int)($c['stock_quantity'] ?? 0);
        $checkRow->execute([$cid, $bulacanId]);
        $hasBulacan = (bool)$checkRow->fetchColumn();
        $checkRow->execute([$cid, $marikinaId]);
        $hasMarikina = (bool)$checkRow->fetchColumn();
        if (!$hasBulacan && !$hasMarikina) {
            // First-time initialization
            if ($total > 0) {
                $insertRow->execute([$cid, $bulacanId, $total]);
            } else {
                $insertRow->execute([$cid, $bulacanId, 0]);
            }
            $insertRow->execute([$cid, $marikinaId, 0]);
        } else {
            // Ensure both branches exist
            if (!$hasBulacan) $insertRow->execute([$cid, $bulacanId, 0]);
            if (!$hasMarikina) $insertRow->execute([$cid, $marikinaId, 0]);
        }
        // Optional: keep components.stock_quantity as total sum to maintain backward compatibility
        $sumStmt = $pdo->prepare('SELECT SUM(stock_quantity) FROM component_branch_stock WHERE component_id = ?');
        $sumStmt->execute([$cid]);
        $sum = (int)$sumStmt->fetchColumn();
        $updTotal = $pdo->prepare('UPDATE components SET stock_quantity = ? WHERE id = ?');
        $updTotal->execute([$sum, $cid]);
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'message' => 'Branch inventory migration completed', 'branches' => ['BULACAN' => $bulacanId, 'MARIKINA' => $marikinaId]]);
} catch (Throwable $t) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $t->getMessage()]);
}
