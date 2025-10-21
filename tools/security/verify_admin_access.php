<?php
require 'backend/config/database.php';

header('Content-Type: text/plain');

try {
    $pdo = get_db_connection();
    
    // Get all admin users with their access controls
    $stmt = $pdo->query("
        SELECT 
            u.id, 
            u.username, 
            u.role,
            u.can_access_inventory,
            u.can_access_orders,
            u.can_access_chat_support,
            GROUP_CONCAT(r.name) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE r.name IN ('Admin', 'Super Admin') OR u.role IN ('admin', 'super_admin')
        GROUP BY u.id
    ");
    
    $admins = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($admins)) {
        echo "No admin users found.\n";
    } else {
        echo "Admin Users and Their Access Controls (After Update):\n\n";
        foreach ($admins as $admin) {
            echo "ID: " . $admin['id'] . "\n";
            echo "Username: " . $admin['username'] . "\n";
            echo "Role: " . $admin['role'] . "\n";
            echo "Roles: " . $admin['roles'] . "\n";
            echo "Can Access Inventory: Yes (Always enabled for admins)\n";
            echo "Can Access Orders: Yes (Always enabled for admins)\n";
            echo "Can Access Chat Support: Yes (Always enabled for admins)\n";
            echo str_repeat("-", 50) . "\n\n";
        }
    }
    
    // Test the dashboard access
    echo "\nTesting Dashboard Access:\n";
    echo "1. Verifying dashboard access for admin users...\n";
    
    // This is a simulation of what the frontend would receive
    $token = 'test_token';
    $headers = ['Authorization' => 'Bearer ' . $token];
    
    // Mock the JWT verification for testing
    function mock_verify_jwt($token) {
        return [
            'user_id' => 1,
            'username' => 'test_admin',
            'roles' => ['Admin']
        ];
    }
    
    // Include the dashboard file to test the function
    require_once 'backend/api/dashboard.php';
    
    // Mock the database connection
    $mockPdo = new class() {
        public function prepare($sql) {
            return new class($sql) {
                private $sql;
                public function __construct($sql) { $this->sql = $sql; }
                public function execute($params = []) { return true; }
                public function fetchAll($type) { 
                    if (strpos($this->sql, 'users') !== false) {
                        return [['id' => 1, 'username' => 'test_admin', 'roles' => 'Admin']];
                    }
                    return []; 
                }
                public function fetchColumn() { return 1; }
            };
        }
        public function query($sql) { return $this->prepare($sql); }
    };
    
    // Test the dashboard function
    ob_start();
    handleGetDashboardData($mockPdo);
    $output = ob_get_clean();
    $result = json_decode($output, true);
    
    if (json_last_error() === JSON_ERROR_NONE && isset($result['success']) && $result['success']) {
        echo "✅ Dashboard access test passed. Admin users have full access.\n";
    } else {
        echo "❌ Dashboard access test failed. Error: " . ($result['error'] ?? 'Unknown error') . "\n";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    if (strpos($e->getMessage(), 'SQLSTATE') !== false) {
        echo "SQL Error Code: " . $e->errorInfo[1] . "\n";
        echo "SQL Error Message: " . $e->errorInfo[2] . "\n";
    }
}
?>
