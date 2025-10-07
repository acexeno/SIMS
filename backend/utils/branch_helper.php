<?php
// backend/utils/branch_helper.php

function get_branch_id_by_code(PDO $pdo, $code) {
    if (!$code) return null;
    try {
        $stmt = $pdo->prepare('SELECT id FROM branches WHERE UPPER(code) = UPPER(?) AND is_active = 1');
        $stmt->execute([$code]);
        $id = $stmt->fetchColumn();
        return $id ? (int)$id : null;
    } catch (Throwable $t) {
        // branches table may not exist yet; fallback to null
        return null;
    }
}

function ensure_branch_exists(PDO $pdo, $code, $name = null) {
    try {
        $stmt = $pdo->prepare('SELECT id FROM branches WHERE UPPER(code) = UPPER(?)');
        $stmt->execute([$code]);
        $id = $stmt->fetchColumn();
        if ($id) return (int)$id;
        $ins = $pdo->prepare('INSERT INTO branches (code, name) VALUES (?, ?)');
        $ins->execute([$code, $name ?: $code]);
        return (int)$pdo->lastInsertId();
    } catch (Throwable $t) {
        return null;
    }
}

function upsert_branch_stock(PDO $pdo, $componentId, $branchId, $qty) {
    try {
        $sel = $pdo->prepare('SELECT stock_quantity FROM component_branch_stock WHERE component_id = ? AND branch_id = ?');
        $sel->execute([$componentId, $branchId]);
        $exists = $sel->fetchColumn();
        if ($exists === false) {
            $ins = $pdo->prepare('INSERT INTO component_branch_stock (component_id, branch_id, stock_quantity) VALUES (?, ?, ?)');
            $ins->execute([$componentId, $branchId, (int)$qty]);
        } else {
            $upd = $pdo->prepare('UPDATE component_branch_stock SET stock_quantity = ? WHERE component_id = ? AND branch_id = ?');
            $upd->execute([(int)$qty, $componentId, $branchId]);
        }
    } catch (Throwable $t) {
        // ignore if table missing
    }
}

function recalc_total_stock(PDO $pdo, $componentId) {
    try {
        $sumStmt = $pdo->prepare('SELECT COALESCE(SUM(stock_quantity),0) FROM component_branch_stock WHERE component_id = ?');
        $sumStmt->execute([$componentId]);
        $sum = (int)$sumStmt->fetchColumn();
        $updTotal = $pdo->prepare('UPDATE components SET stock_quantity = ? WHERE id = ?');
        $updTotal->execute([$sum, $componentId]);
        return $sum;
    } catch (Throwable $t) {
        return null;
    }
}

function fetch_components_with_branch_stock(PDO $pdo, $branchId) {
    if (!$branchId) {
        // Fallback: original behavior (active components only)
        $stmt = $pdo->query('SELECT * FROM components WHERE is_active = 1');
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    try {
        // Join to override stock_quantity with branch-specific amount (alias as stock_quantity for UI compatibility)
        $sql = "SELECT c.id, c.name, c.brand, c.category_id, c.price, c.image_url, c.specs, c.is_active,
                       COALESCE(s.stock_quantity, 0) AS stock_quantity
                FROM components c
                LEFT JOIN component_branch_stock s
                  ON s.component_id = c.id AND s.branch_id = :branch
                WHERE c.is_active = 1";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':branch' => $branchId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return $rows;
    } catch (Throwable $t) {
        // If table doesn't exist, fallback
        $stmt = $pdo->query('SELECT * FROM components WHERE is_active = 1');
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
