<?php
/**
 * Employee Account Verification Script
 * 
 * This script verifies that Employee accounts are properly configured
 * with all necessary permissions and roles.
 * 
 * Usage: Run from browser: http://localhost/capstone2/tools/verify_employee_account.php
 */

// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Load database configuration
require_once __DIR__ . '/../backend/config/database.php';

// HTML Header
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Employee Account Verification</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        h1 {
            color: #2d3748;
            margin-bottom: 10px;
            font-size: 32px;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .subtitle {
            color: #718096;
            margin-bottom: 30px;
            font-size: 16px;
        }
        .section {
            margin-bottom: 30px;
            padding: 25px;
            background: #f7fafc;
            border-radius: 12px;
            border-left: 4px solid #667eea;
        }
        .section h2 {
            color: #2d3748;
            margin-bottom: 15px;
            font-size: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        th {
            background: #667eea;
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 12px 15px;
            border-bottom: 1px solid #e2e8f0;
        }
        tr:last-child td {
            border-bottom: none;
        }
        tr:hover {
            background: #f7fafc;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-success {
            background: #c6f6d5;
            color: #22543d;
        }
        .badge-danger {
            background: #fed7d7;
            color: #742a2a;
        }
        .badge-warning {
            background: #feebc8;
            color: #7c2d12;
        }
        .badge-info {
            background: #bee3f8;
            color: #2c5282;
        }
        .status-enabled {
            color: #22c55e;
            font-weight: bold;
        }
        .status-disabled {
            color: #ef4444;
            font-weight: bold;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-top: 4px solid #667eea;
        }
        .summary-card h3 {
            color: #718096;
            font-size: 14px;
            margin-bottom: 8px;
        }
        .summary-card .value {
            font-size: 32px;
            font-weight: bold;
            color: #2d3748;
        }
        .icon {
            font-size: 24px;
            margin-right: 5px;
        }
        .test-result {
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
        }
        .test-pass {
            background: #d1fae5;
            border-left: 4px solid #10b981;
            color: #064e3b;
        }
        .test-fail {
            background: #fee2e2;
            border-left: 4px solid #ef4444;
            color: #7f1d1d;
        }
        .timestamp {
            color: #718096;
            font-size: 14px;
            margin-top: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>
            <span class="icon">👥</span>
            Employee Account Verification
        </h1>
        <p class="subtitle">Verify Employee accounts are properly configured with all necessary permissions</p>

<?php

try {
    // Connect to database
    $pdo = getDBConnection();
    
    // Get all Employee users
    $stmt = $pdo->prepare("
        SELECT 
            u.id,
            u.username,
            u.email,
            u.first_name,
            u.last_name,
            u.is_active,
            u.can_access_inventory,
            u.can_access_orders,
            u.can_access_chat_support,
            u.created_at,
            u.last_login,
            GROUP_CONCAT(r.name) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE r.name = 'Employee'
        GROUP BY u.id
        ORDER BY u.created_at DESC
    ");
    $stmt->execute();
    $employees = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Count statistics
    $totalEmployees = count($employees);
    $activeEmployees = 0;
    $fullAccessEmployees = 0;
    $restrictedEmployees = 0;
    
    foreach ($employees as $emp) {
        if ($emp['is_active']) $activeEmployees++;
        if ($emp['can_access_inventory'] && $emp['can_access_orders'] && $emp['can_access_chat_support']) {
            $fullAccessEmployees++;
        } else {
            $restrictedEmployees++;
        }
    }
    
    ?>
    
    <!-- Summary Cards -->
    <div class="summary">
        <div class="summary-card">
            <h3>Total Employees</h3>
            <div class="value"><?php echo $totalEmployees; ?></div>
        </div>
        <div class="summary-card">
            <h3>Active Accounts</h3>
            <div class="value" style="color: #10b981;"><?php echo $activeEmployees; ?></div>
        </div>
        <div class="summary-card">
            <h3>Full Access</h3>
            <div class="value" style="color: #3b82f6;"><?php echo $fullAccessEmployees; ?></div>
        </div>
        <div class="summary-card">
            <h3>Restricted Access</h3>
            <div class="value" style="color: #f59e0b;"><?php echo $restrictedEmployees; ?></div>
        </div>
    </div>
    
    <!-- Employee Accounts Table -->
    <div class="section">
        <h2>
            <span class="icon">📋</span>
            Employee Accounts
        </h2>
        
        <?php if (empty($employees)): ?>
            <div class="test-result test-fail">
                <strong>⚠️ No Employee Accounts Found</strong><br>
                No Employee accounts exist in the system. Create one using the Super Admin dashboard.
            </div>
        <?php else: ?>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Inventory</th>
                        <th>Orders</th>
                        <th>Chat</th>
                        <th>Created</th>
                        <th>Last Login</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($employees as $emp): ?>
                    <tr>
                        <td><strong>#<?php echo $emp['id']; ?></strong></td>
                        <td><?php echo htmlspecialchars($emp['first_name'] . ' ' . $emp['last_name']); ?></td>
                        <td><strong><?php echo htmlspecialchars($emp['username']); ?></strong></td>
                        <td><?php echo htmlspecialchars($emp['email']); ?></td>
                        <td>
                            <?php if ($emp['is_active']): ?>
                                <span class="badge badge-success">✓ Active</span>
                            <?php else: ?>
                                <span class="badge badge-danger">✗ Inactive</span>
                            <?php endif; ?>
                        </td>
                        <td class="<?php echo $emp['can_access_inventory'] ? 'status-enabled' : 'status-disabled'; ?>">
                            <?php echo $emp['can_access_inventory'] ? '✓ Enabled' : '✗ Disabled'; ?>
                        </td>
                        <td class="<?php echo $emp['can_access_orders'] ? 'status-enabled' : 'status-disabled'; ?>">
                            <?php echo $emp['can_access_orders'] ? '✓ Enabled' : '✗ Disabled'; ?>
                        </td>
                        <td class="<?php echo $emp['can_access_chat_support'] ? 'status-enabled' : 'status-disabled'; ?>">
                            <?php echo $emp['can_access_chat_support'] ? '✓ Enabled' : '✗ Disabled'; ?>
                        </td>
                        <td><?php echo date('M j, Y', strtotime($emp['created_at'])); ?></td>
                        <td><?php echo $emp['last_login'] ? date('M j, Y H:i', strtotime($emp['last_login'])) : 'Never'; ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>
    
    <!-- Verification Tests -->
    <div class="section">
        <h2>
            <span class="icon">✅</span>
            Verification Tests
        </h2>
        
        <?php
        $allPassed = true;
        
        // Test 1: Check if Employee role exists
        $stmt = $pdo->prepare("SELECT id FROM roles WHERE name = 'Employee'");
        $stmt->execute();
        $employeeRole = $stmt->fetch();
        ?>
        
        <div class="test-result <?php echo $employeeRole ? 'test-pass' : 'test-fail'; ?>">
            <strong><?php echo $employeeRole ? '✓' : '✗'; ?> Employee Role Exists</strong><br>
            <?php if ($employeeRole): ?>
                Employee role is properly configured in the roles table (ID: <?php echo $employeeRole['id']; ?>)
            <?php else: ?>
                Employee role is missing from the roles table. Please run database migrations.
                <?php $allPassed = false; ?>
            <?php endif; ?>
        </div>
        
        <?php
        // Test 2: Check if all employees have proper permissions
        $missingPermissions = [];
        foreach ($employees as $emp) {
            if (!$emp['can_access_inventory'] || !$emp['can_access_orders'] || !$emp['can_access_chat_support']) {
                $missing = [];
                if (!$emp['can_access_inventory']) $missing[] = 'Inventory';
                if (!$emp['can_access_orders']) $missing[] = 'Orders';
                if (!$emp['can_access_chat_support']) $missing[] = 'Chat Support';
                $missingPermissions[] = $emp['username'] . ' (' . implode(', ', $missing) . ')';
            }
        }
        ?>
        
        <div class="test-result <?php echo empty($missingPermissions) ? 'test-pass' : 'test-fail'; ?>">
            <strong><?php echo empty($missingPermissions) ? '✓' : '✗'; ?> All Employees Have Full Permissions</strong><br>
            <?php if (empty($missingPermissions)): ?>
                All Employee accounts have inventory, orders, and chat support access enabled.
            <?php else: ?>
                The following employees have restricted access:
                <ul style="margin-top: 10px; margin-left: 20px;">
                    <?php foreach ($missingPermissions as $msg): ?>
                        <li><?php echo htmlspecialchars($msg); ?></li>
                    <?php endforeach; ?>
                </ul>
                This is OK if intentionally restricted by Super Admin.
            <?php endif; ?>
        </div>
        
        <?php
        // Test 3: Check if all employees are active
        $inactiveEmployees = array_filter($employees, function($emp) {
            return !$emp['is_active'];
        });
        ?>
        
        <div class="test-result <?php echo empty($inactiveEmployees) ? 'test-pass' : 'test-fail'; ?>">
            <strong><?php echo empty($inactiveEmployees) ? '✓' : '✗'; ?> All Employee Accounts Are Active</strong><br>
            <?php if (empty($inactiveEmployees)): ?>
                All Employee accounts are active and can login.
            <?php else: ?>
                <?php echo count($inactiveEmployees); ?> Employee account(s) are inactive:
                <ul style="margin-top: 10px; margin-left: 20px;">
                    <?php foreach ($inactiveEmployees as $emp): ?>
                        <li><?php echo htmlspecialchars($emp['username']); ?></li>
                    <?php endforeach; ?>
                </ul>
            <?php endif; ?>
        </div>
        
        <?php
        // Test 4: Check database schema for permission columns
        $stmt = $pdo->query("DESCRIBE users");
        $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $hasInventoryCol = in_array('can_access_inventory', $columns);
        $hasOrdersCol = in_array('can_access_orders', $columns);
        $hasChatCol = in_array('can_access_chat_support', $columns);
        $schemaComplete = $hasInventoryCol && $hasOrdersCol && $hasChatCol;
        ?>
        
        <div class="test-result <?php echo $schemaComplete ? 'test-pass' : 'test-fail'; ?>">
            <strong><?php echo $schemaComplete ? '✓' : '✗'; ?> Database Schema Complete</strong><br>
            <?php if ($schemaComplete): ?>
                All required permission columns exist in the users table:
                <ul style="margin-top: 10px; margin-left: 20px;">
                    <li>✓ can_access_inventory</li>
                    <li>✓ can_access_orders</li>
                    <li>✓ can_access_chat_support</li>
                </ul>
            <?php else: ?>
                Missing permission columns:
                <ul style="margin-top: 10px; margin-left: 20px;">
                    <?php if (!$hasInventoryCol): ?><li>✗ can_access_inventory</li><?php endif; ?>
                    <?php if (!$hasOrdersCol): ?><li>✗ can_access_orders</li><?php endif; ?>
                    <?php if (!$hasChatCol): ?><li>✗ can_access_chat_support</li><?php endif; ?>
                </ul>
                <?php $allPassed = false; ?>
            <?php endif; ?>
        </div>
        
        <!-- Overall Status -->
        <div class="test-result <?php echo $allPassed ? 'test-pass' : 'test-fail'; ?>" style="margin-top: 20px; font-size: 18px;">
            <strong><?php echo $allPassed ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'; ?></strong><br>
            <?php if ($allPassed): ?>
                Employee account system is fully functional and ready for production use.
            <?php else: ?>
                Please address the failed tests above before using the Employee account system.
            <?php endif; ?>
        </div>
    </div>
    
    <!-- Recommendations -->
    <?php if (!empty($employees)): ?>
    <div class="section">
        <h2>
            <span class="icon">💡</span>
            Recommendations
        </h2>
        
        <?php if ($restrictedEmployees > 0): ?>
        <div class="test-result" style="background: #fef3c7; border-left-color: #f59e0b;">
            <strong>📝 Review Restricted Accounts</strong><br>
            <?php echo $restrictedEmployees; ?> Employee account(s) have restricted permissions. 
            Verify this is intentional or re-enable access via Super Admin dashboard.
        </div>
        <?php endif; ?>
        
        <?php if (!empty($inactiveEmployees)): ?>
        <div class="test-result" style="background: #fee2e2; border-left-color: #ef4444;">
            <strong>🔒 Reactivate Inactive Accounts</strong><br>
            <?php echo count($inactiveEmployees); ?> Employee account(s) are inactive. 
            If these accounts should be active, enable them via Super Admin dashboard.
        </div>
        <?php endif; ?>
        
        <?php
        // Check for employees who never logged in
        $neverLoggedIn = array_filter($employees, function($emp) {
            return empty($emp['last_login']);
        });
        if (!empty($neverLoggedIn)): ?>
        <div class="test-result" style="background: #dbeafe; border-left-color: #3b82f6;">
            <strong>ℹ️ First-Time Logins Pending</strong><br>
            <?php echo count($neverLoggedIn); ?> Employee account(s) have never logged in:
            <ul style="margin-top: 10px; margin-left: 20px;">
                <?php foreach ($neverLoggedIn as $emp): ?>
                    <li><?php echo htmlspecialchars($emp['username']); ?> - Created <?php echo date('M j, Y', strtotime($emp['created_at'])); ?></li>
                <?php endforeach; ?>
            </ul>
            Ensure these users have received their login credentials.
        </div>
        <?php endif; ?>
    </div>
    <?php endif; ?>
    
    <p class="timestamp">
        Last checked: <?php echo date('F j, Y \a\t g:i:s A'); ?>
    </p>
    
    <?php
    
} catch (PDOException $e) {
    ?>
    <div class="section">
        <div class="test-result test-fail">
            <strong>❌ Database Error</strong><br>
            <?php echo htmlspecialchars($e->getMessage()); ?>
        </div>
    </div>
    <?php
}

?>

    </div>
</body>
</html>

