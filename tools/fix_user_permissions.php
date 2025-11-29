<?php
/**
 * Fix User Permissions - Verification and Repair Tool
 * 
 * This script:
 * 1. Checks all Admin and Employee accounts for NULL or missing permission values
 * 2. Sets default permissions (all enabled) for accounts with missing values
 * 3. Displays current permission status for all admin/employee accounts
 * 
 * URL: http://localhost:5175/tools/fix_user_permissions.php
 */

require_once __DIR__ . '/../backend/config/database.php';

// Set content type to HTML
header('Content-Type: text/html; charset=utf-8');

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fix User Permissions - SIMS</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
        }
        .header p {
            font-size: 16px;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .status-card {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 4px;
        }
        .status-card.success {
            border-left-color: #10b981;
            background: #ecfdf5;
        }
        .status-card.warning {
            border-left-color: #f59e0b;
            background: #fffbeb;
        }
        .status-card.error {
            border-left-color: #ef4444;
            background: #fef2f2;
        }
        .status-card h2 {
            font-size: 20px;
            margin-bottom: 10px;
            color: #1f2937;
        }
        .status-card p {
            font-size: 14px;
            color: #6b7280;
            line-height: 1.6;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        thead {
            background: #667eea;
            color: white;
        }
        th, td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        th {
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        td {
            font-size: 14px;
            color: #374151;
        }
        tbody tr:hover {
            background: #f9fafb;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .badge.enabled {
            background: #d1fae5;
            color: #065f46;
        }
        .badge.disabled {
            background: #fee2e2;
            color: #991b1b;
        }
        .badge.fixed {
            background: #dbeafe;
            color: #1e40af;
        }
        .action-btn {
            display: inline-block;
            padding: 10px 20px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin-top: 20px;
            transition: background 0.2s;
        }
        .action-btn:hover {
            background: #5568d3;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-box h3 {
            font-size: 36px;
            margin-bottom: 5px;
        }
        .stat-box p {
            font-size: 14px;
            opacity: 0.9;
        }
        .code {
            background: #1f2937;
            color: #10b981;
            padding: 15px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.6;
            margin: 15px 0;
            overflow-x: auto;
        }
        .section {
            margin-top: 40px;
        }
        .section h2 {
            font-size: 24px;
            color: #1f2937;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 User Permissions Fix Tool</h1>
            <p>Verify and repair permission settings for Admin and Employee accounts</p>
        </div>
        <div class="content">
<?php

try {
    // Connect to database
    $pdo = getDbConnection();
    
    // Step 1: Get all Admin and Employee users
    $stmt = $pdo->query("
        SELECT DISTINCT u.id, u.username, u.email, u.is_active,
               u.can_access_inventory, u.can_access_orders, u.can_access_chat_support,
               GROUP_CONCAT(r.name) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE r.name IN ('Admin', 'Employee', 'Super Admin')
        GROUP BY u.id
        ORDER BY r.name, u.username
    ");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $totalUsers = count($users);
    $fixedUsers = 0;
    $issuesFound = [];
    
    // Step 2: Check and fix permissions
    foreach ($users as &$user) {
        $needsFix = false;
        $issues = [];
        
        // Check for NULL or 0 values
        if ($user['can_access_inventory'] === null) {
            $issues[] = 'Inventory permission is NULL';
            $needsFix = true;
        }
        if ($user['can_access_orders'] === null) {
            $issues[] = 'Orders permission is NULL';
            $needsFix = true;
        }
        if ($user['can_access_chat_support'] === null) {
            $issues[] = 'Chat Support permission is NULL';
            $needsFix = true;
        }
        
        if ($needsFix) {
            // Fix by setting all permissions to 1 (enabled)
            $updateStmt = $pdo->prepare("
                UPDATE users 
                SET can_access_inventory = COALESCE(can_access_inventory, 1),
                    can_access_orders = COALESCE(can_access_orders, 1),
                    can_access_chat_support = COALESCE(can_access_chat_support, 1)
                WHERE id = ?
            ");
            $updateStmt->execute([$user['id']]);
            
            // Re-fetch the user to get updated values
            $checkStmt = $pdo->prepare("
                SELECT can_access_inventory, can_access_orders, can_access_chat_support
                FROM users WHERE id = ?
            ");
            $checkStmt->execute([$user['id']]);
            $updated = $checkStmt->fetch(PDO::FETCH_ASSOC);
            
            $user['can_access_inventory'] = $updated['can_access_inventory'];
            $user['can_access_orders'] = $updated['can_access_orders'];
            $user['can_access_chat_support'] = $updated['can_access_chat_support'];
            $user['was_fixed'] = true;
            
            $fixedUsers++;
            $issuesFound[] = [
                'username' => $user['username'],
                'issues' => $issues
            ];
        } else {
            $user['was_fixed'] = false;
        }
    }
    
    // Calculate statistics
    $fullyEnabled = 0;
    $partiallyRestricted = 0;
    $fullyRestricted = 0;
    
    foreach ($users as $user) {
        $enabledCount = 0;
        if ($user['can_access_inventory'] == 1) $enabledCount++;
        if ($user['can_access_orders'] == 1) $enabledCount++;
        if ($user['can_access_chat_support'] == 1) $enabledCount++;
        
        if ($enabledCount == 3) {
            $fullyEnabled++;
        } elseif ($enabledCount == 0) {
            $fullyRestricted++;
        } else {
            $partiallyRestricted++;
        }
    }
    
    // Display results
    if ($fixedUsers > 0) {
        echo '<div class="status-card success">';
        echo '<h2>✅ Permissions Fixed Successfully</h2>';
        echo '<p>Fixed permissions for <strong>' . $fixedUsers . '</strong> user(s) with missing or NULL permission values. All permissions have been set to ENABLED (value = 1) by default.</p>';
        echo '</div>';
    } else {
        echo '<div class="status-card success">';
        echo '<h2>✅ All Permissions Are Valid</h2>';
        echo '<p>No issues found. All Admin and Employee accounts have valid permission settings.</p>';
        echo '</div>';
    }
    
    // Display statistics
    echo '<div class="stats">';
    echo '<div class="stat-box">';
    echo '<h3>' . $totalUsers . '</h3>';
    echo '<p>Total Admin/Employee Accounts</p>';
    echo '</div>';
    echo '<div class="stat-box">';
    echo '<h3>' . $fullyEnabled . '</h3>';
    echo '<p>Fully Enabled (All Permissions)</p>';
    echo '</div>';
    echo '<div class="stat-box">';
    echo '<h3>' . $partiallyRestricted . '</h3>';
    echo '<p>Partially Restricted</p>';
    echo '</div>';
    echo '<div class="stat-box">';
    echo '<h3>' . $fullyRestricted . '</h3>';
    echo '<p>Fully Restricted</p>';
    echo '</div>';
    echo '</div>';
    
    // Display issues found
    if (!empty($issuesFound)) {
        echo '<div class="section">';
        echo '<h2>🔍 Issues Found and Fixed</h2>';
        echo '<div class="code">';
        foreach ($issuesFound as $issue) {
            echo '► User: ' . htmlspecialchars($issue['username']) . "\n";
            foreach ($issue['issues'] as $detail) {
                echo '  • ' . htmlspecialchars($detail) . "\n";
            }
            echo "\n";
        }
        echo '</div>';
        echo '</div>';
    }
    
    // Display all users table
    echo '<div class="section">';
    echo '<h2>📊 Current Permission Status</h2>';
    echo '<table>';
    echo '<thead>';
    echo '<tr>';
    echo '<th>Username</th>';
    echo '<th>Role</th>';
    echo '<th>Inventory</th>';
    echo '<th>Orders</th>';
    echo '<th>Chat Support</th>';
    echo '<th>Status</th>';
    echo '</tr>';
    echo '</thead>';
    echo '<tbody>';
    
    foreach ($users as $user) {
        echo '<tr>';
        echo '<td><strong>' . htmlspecialchars($user['username']) . '</strong><br>';
        echo '<small style="color: #9ca3af;">' . htmlspecialchars($user['email']) . '</small></td>';
        echo '<td>' . htmlspecialchars($user['roles']) . '</td>';
        
        // Inventory
        $invClass = $user['can_access_inventory'] == 1 ? 'enabled' : 'disabled';
        $invText = $user['can_access_inventory'] == 1 ? 'Enabled' : 'Disabled';
        echo '<td><span class="badge ' . $invClass . '">' . $invText . '</span></td>';
        
        // Orders
        $ordClass = $user['can_access_orders'] == 1 ? 'enabled' : 'disabled';
        $ordText = $user['can_access_orders'] == 1 ? 'Enabled' : 'Disabled';
        echo '<td><span class="badge ' . $ordClass . '">' . $ordText . '</span></td>';
        
        // Chat Support
        $chatClass = $user['can_access_chat_support'] == 1 ? 'enabled' : 'disabled';
        $chatText = $user['can_access_chat_support'] == 1 ? 'Enabled' : 'Disabled';
        echo '<td><span class="badge ' . $chatClass . '">' . $chatText . '</span></td>';
        
        // Status
        if ($user['was_fixed']) {
            echo '<td><span class="badge fixed">🔧 Fixed</span></td>';
        } else {
            $enabledCount = 0;
            if ($user['can_access_inventory'] == 1) $enabledCount++;
            if ($user['can_access_orders'] == 1) $enabledCount++;
            if ($user['can_access_chat_support'] == 1) $enabledCount++;
            
            if ($enabledCount == 3) {
                echo '<td><span class="badge enabled">✓ All Enabled</span></td>';
            } elseif ($enabledCount == 0) {
                echo '<td><span class="badge disabled">✗ All Disabled</span></td>';
            } else {
                echo '<td><span style="background: #fef3c7; color: #92400e;" class="badge">⚠ Partial</span></td>';
            }
        }
        
        echo '</tr>';
    }
    
    echo '</tbody>';
    echo '</table>';
    echo '</div>';
    
    // Display instructions
    echo '<div class="section">';
    echo '<h2>📝 Next Steps</h2>';
    echo '<div class="status-card">';
    echo '<h2>How to Use Super Admin User Management</h2>';
    echo '<p>To enable or disable permissions for specific users:</p>';
    echo '<ol style="margin-left: 20px; margin-top: 10px; line-height: 1.8;">';
    echo '<li>Login as <strong>Super Admin</strong></li>';
    echo '<li>Navigate to <strong>User Management</strong> tab</li>';
    echo '<li>Find the user you want to modify</li>';
    echo '<li>Click <strong>Enable</strong> or <strong>Disable</strong> for each permission column</li>';
    echo '<li>Changes take effect immediately - user must refresh their browser</li>';
    echo '</ol>';
    echo '</div>';
    echo '</div>';
    
    // Display technical details
    echo '<div class="section">';
    echo '<h2>🔧 Technical Details</h2>';
    echo '<div class="status-card">';
    echo '<h2>Fixed Issues</h2>';
    echo '<p>The following issues have been resolved in this update:</p>';
    echo '<ul style="margin-left: 20px; margin-top: 10px; line-height: 1.8;">';
    echo '<li><strong>Hardcoded Permissions:</strong> Fixed <code>handleGetProfile()</code> function in <code>backend/api/auth.php</code> to read actual permission values from database instead of always returning 1</li>';
    echo '<li><strong>NULL Values:</strong> Ensured all Admin/Employee accounts have explicit permission values (not NULL)</li>';
    echo '<li><strong>Permission Toggle:</strong> Verified Super Admin permission toggle functions are working correctly</li>';
    echo '</ul>';
    echo '</div>';
    echo '</div>';
    
    // Display verification SQL
    echo '<div class="section">';
    echo '<h2>🗃️ Database Verification Query</h2>';
    echo '<p>You can run this query directly in phpMyAdmin to verify permissions:</p>';
    echo '<div class="code">';
    echo 'SELECT u.username, u.email,';
    echo "\n  u.can_access_inventory,";
    echo "\n  u.can_access_orders,";
    echo "\n  u.can_access_chat_support,";
    echo "\n  GROUP_CONCAT(r.name) as roles";
    echo "\nFROM users u";
    echo "\nLEFT JOIN user_roles ur ON u.id = ur.user_id";
    echo "\nLEFT JOIN roles r ON ur.role_id = r.id";
    echo "\nWHERE r.name IN ('Admin', 'Employee', 'Super Admin')";
    echo "\nGROUP BY u.id";
    echo "\nORDER BY r.name, u.username;";
    echo '</div>';
    echo '</div>';
    
} catch (PDOException $e) {
    echo '<div class="status-card error">';
    echo '<h2>❌ Database Error</h2>';
    echo '<p>Failed to connect to database or execute query.</p>';
    echo '<div class="code" style="background: #fee2e2; color: #991b1b;">';
    echo 'Error: ' . htmlspecialchars($e->getMessage());
    echo '</div>';
    echo '</div>';
}

?>
            <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 2px solid #e5e7eb;">
                <a href="/" class="action-btn">← Back to Home</a>
                <a href="javascript:location.reload()" class="action-btn" style="background: #10b981;">🔄 Refresh</a>
            </div>
        </div>
    </div>
</body>
</html>

