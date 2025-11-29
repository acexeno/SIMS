<?php
// api/dashboard.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/jwt_helper.php';
require_once __DIR__ . '/../utils/branch_helper.php';
require_once __DIR__ . '/auth.php'; // for getBearerToken()

// Local debug helper
function dashboard_is_debug_enabled() {
    if (!function_exists('env')) return false;
    $appDebug = env('APP_DEBUG', '0');
    return ($appDebug === '1' || strtolower($appDebug) === 'true');
}

function handleGetDashboardData($pdo) {
    try {
        // Accept tokens from Authorization header, REDIRECT_HTTP_AUTHORIZATION, JSON body, or ?token
        $token = getBearerToken();
        if (!$token) {
            http_response_code(401);
            error_log("Dashboard endpoint: No token provided");
            $resp = ['error' => 'Unauthorized', 'message' => 'No authentication token provided'];
            if (dashboard_is_debug_enabled()) { $resp['debug'] = 'missing_token'; }
            echo json_encode($resp);
            return;
        }
        
        error_log("Dashboard endpoint: Token provided, length: " . strlen($token));
        $decoded = verifyJWT($token);
        if (!$decoded || !isset($decoded['user_id'])) {
            http_response_code(401);
            error_log("Dashboard endpoint: Token verification failed");
            $resp = ['error' => 'Invalid token', 'message' => 'Token is invalid or expired'];
            if (dashboard_is_debug_enabled()) { 
                $resp['debug'] = [
                    'token_provided' => !empty($token),
                    'token_length' => strlen($token),
                    'decoded_result' => $decoded
                ]; 
            }
            echo json_encode($resp);
            return;
        }
        
        error_log("Dashboard endpoint: Token verified for user ID " . $decoded['user_id']);
        
        // Additional validation: ensure user exists and is active
        $userId = $decoded['user_id'];
        $stmt = $pdo->prepare("SELECT id, is_active FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        
        if (!$user) {
            http_response_code(401);
            $resp = ['error' => 'User not found', 'message' => 'User account does not exist'];
            if (dashboard_is_debug_enabled()) { $resp['debug'] = ['user_id' => $userId]; }
            echo json_encode($resp);
            return;
        }
        
        if (!$user['is_active']) {
            http_response_code(401);
            $resp = ['error' => 'Account deactivated', 'message' => 'User account is deactivated'];
            if (dashboard_is_debug_enabled()) { $resp['debug'] = ['user_id' => $userId]; }
            echo json_encode($resp);
            return;
        }
        
        $roles = $decoded['roles'] ?? [];
        if (is_string($roles)) {
            $roles = explode(',', $roles);
        }

        // Initialize data structure
        $data = [];

        // For all admin roles, grant full access
        if (in_array('Super Admin', $roles) || in_array('Admin', $roles) || in_array('Employee', $roles)) {
            // Safely fetch users with error handling
            try {
                $stmt = $pdo->query("
                    SELECT u.*, GROUP_CONCAT(r.name) as roles
                    FROM users u
                    LEFT JOIN user_roles ur ON u.id = ur.user_id
                    LEFT JOIN roles r ON ur.role_id = r.id
                    WHERE NOT EXISTS (
                        SELECT 1 FROM user_roles ur2 
                        JOIN roles r2 ON ur2.role_id = r2.id 
                        WHERE ur2.user_id = u.id AND r2.name = 'Client'
                    )
                    GROUP BY u.id
                ");
                $data['users'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (Exception $e) {
                $data['users'] = [];
                error_log("Dashboard: Failed to fetch users: " . $e->getMessage());
            }
            
            // Safely fetch system stats
            try {
                $data['system_stats'] = get_system_stats($pdo);
            } catch (Exception $e) {
                $data['system_stats'] = ['total_users' => 0, 'total_orders' => 0, 'total_sales' => 0];
                error_log("Dashboard: Failed to fetch system stats: " . $e->getMessage());
            }
            
            // Branch-aware inventory: when branch is provided, override stock to that branch
            $branchCode = isset($_GET['branch']) ? trim($_GET['branch']) : null;
            $branchIdParam = isset($_GET['branch_id']) ? intval($_GET['branch_id']) : null;
            $branchId = null;
            if ($branchIdParam && $branchIdParam > 0) {
                $branchId = $branchIdParam;
            } elseif ($branchCode) {
                $branchId = get_branch_id_by_code($pdo, $branchCode);
            }

            // Safely fetch inventory
            try {
                if ($branchId) {
                    $data['inventory'] = fetch_components_with_branch_stock($pdo, $branchId);
                } else {
                    $data['inventory'] = pdo_get_all($pdo, 'components');
                }
            } catch (Exception $e) {
                $data['inventory'] = [];
                error_log("Dashboard: Failed to fetch inventory: " . $e->getMessage());
            }

            // Safely fetch orders
            try {
                $data['orders'] = pdo_get_all($pdo, 'orders');
            } catch (Exception $e) {
                $data['orders'] = [];
                error_log("Dashboard: Failed to fetch orders: " . $e->getMessage());
            }

            // Safely fetch reports
            try {
                $data['reports'] = get_reports_data($pdo);
            } catch (Exception $e) {
                $data['reports'] = [
                    'weekly_sales' => [],
                    'monthly_sales' => [],
                    'daily_sales' => [],
                    'top_selling_products' => [],
                    'revenue_per_category' => [],
                    'revenue_per_brand' => [],
                    'deadstock' => [],
                    'deadstock_total_value' => 0,
                    'stock_movement' => [],
                    'order_status_breakdown' => [],
                    'average_order_value' => ['avg_order_value' => 0],
                    'total_sales' => 0,
                    'total_orders' => 0
                ];
                error_log("Dashboard: Failed to fetch reports: " . $e->getMessage());
            }
        } else {
            http_response_code(403);
            $resp = ['error' => 'Forbidden'];
            if (dashboard_is_debug_enabled()) { $resp['debug'] = ['roles_detected' => $roles]; }
            echo json_encode($resp);
            return;
        }

        echo json_encode(['success' => true, 'data' => $data]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'An error occurred while fetching dashboard data.', 'message' => $e->getMessage()]);
    }
}

// --- Helper Functions ---

// A generic function to get all records from a table
function pdo_get_all($pdo, $table) {
    try {
        if ($table === 'components') {
            $stmt = $pdo->query("SELECT * FROM components WHERE is_active = 1");
        } else {
            $stmt = $pdo->query("SELECT * FROM $table");
        }
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        error_log("pdo_get_all: Failed to fetch from table '$table': " . $e->getMessage());
        return [];
    }
}

// Function to get system-wide statistics
function get_system_stats($pdo) {
    $stats = [];
    try {
        $stats['total_users'] = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    } catch (Exception $e) {
        $stats['total_users'] = 0;
        error_log("get_system_stats: Failed to count users: " . $e->getMessage());
    }
    
    try {
        $stats['total_orders'] = (int)$pdo->query("SELECT COUNT(*) FROM orders")->fetchColumn();
    } catch (Exception $e) {
        $stats['total_orders'] = 0;
        error_log("get_system_stats: Failed to count orders: " . $e->getMessage());
    }
    
    try {
        $stats['total_sales'] = (float)$pdo->query("SELECT SUM(total_price) FROM orders WHERE status = 'Completed'")->fetchColumn();
    } catch (Exception $e) {
        $stats['total_sales'] = 0;
        error_log("get_system_stats: Failed to sum sales: " . $e->getMessage());
    }
    
    return $stats;
}

// Function to get data for reports
function get_reports_data($pdo) {
    $reports = [];
    
    // Check if we have any orders
    try {
        $hasOrders = (int)$pdo->query("SELECT COUNT(*) FROM orders")->fetchColumn() > 0;
    } catch (Exception $e) {
        $hasOrders = false;
        error_log("get_reports_data: Failed to check orders: " . $e->getMessage());
    }
    
    if (!$hasOrders) {
        // Return empty reports if no orders table or no orders
        return [
            'weekly_sales' => [],
            'monthly_sales' => [],
            'daily_sales' => [],
            'top_selling_products' => [],
            'revenue_per_category' => [],
            'revenue_per_brand' => [],
            'deadstock' => [],
            'deadstock_total_value' => 0,
            'stock_movement' => [],
            'order_status_breakdown' => [],
            'average_order_value' => ['avg_order_value' => 0],
            'total_sales' => 0,
            'total_orders' => 0
        ];
    }
    
    // Weekly sales (last 12 weeks)
    try {
        $stmt = $pdo->query("SELECT 
            YEARWEEK(order_date, 1) as week_number,
            MIN(DATE(order_date)) as week_start,
            MAX(DATE(order_date)) as week_end,
            SUM(total_price) as total_sales,
            COUNT(*) as order_count
            FROM orders 
            WHERE status IN ('Completed','Processing') AND order_date >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
            GROUP BY week_number
            ORDER BY week_number DESC");
        $weeklyData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $weeklyData = [];
        error_log("get_reports_data: Failed to fetch weekly sales: " . $e->getMessage());
    }
    
    // Format weekly data for the frontend
    $reports['weekly_sales'] = array_map(function($week) {
        return [
            'week' => 'Week ' . substr($week['week_number'], 4) . 
                     ' (' . date('M d', strtotime($week['week_start'])) . ' - ' . 
                     date('M d', strtotime($week['week_end'])) . ')',
            'total_sales' => (float)$week['total_sales'],
            'order_count' => (int)$week['order_count']
        ];
    }, $weeklyData);
    
    // Monthly sales (last 12 months)
    try {
        $stmt = $pdo->query("SELECT 
            DATE_FORMAT(order_date, '%Y-%m') as month, 
            SUM(total_price) as total_sales,
            COUNT(*) as order_count
            FROM orders 
            WHERE status IN ('Completed','Processing') 
            GROUP BY month 
            ORDER BY month DESC 
            LIMIT 12");
        $reports['monthly_sales'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $reports['monthly_sales'] = [];
        error_log("get_reports_data: Failed to fetch monthly sales: " . $e->getMessage());
    }

    
    
    

    // Daily sales (last 30 days)
    try {
        $stmt = $pdo->query("SELECT 
            DATE(order_date) as day, 
            SUM(total_price) as total_sales,
            COUNT(*) as order_count
            FROM orders 
            WHERE status IN ('Completed','Processing') AND order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY day 
            ORDER BY day DESC");
        $reports['daily_sales'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $reports['daily_sales'] = [];
        error_log("get_reports_data: Failed to fetch daily sales: " . $e->getMessage());
    }
    
    

    // Top-selling products (by quantity and revenue) - only if order_items table exists
    try {
        $stmt = $pdo->query("SELECT c.id, c.name, c.brand, SUM(oi.quantity) as total_quantity, SUM(oi.price * oi.quantity) as total_revenue
            FROM order_items oi
            JOIN components c ON oi.component_id = c.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.status IN ('Completed','Processing')
            GROUP BY c.id, c.name, c.brand
            ORDER BY total_quantity DESC
            LIMIT 10");
        $reports['top_selling_products'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $reports['top_selling_products'] = [];
        error_log("get_reports_data: Failed to fetch top selling products (order_items table may not exist): " . $e->getMessage());
    }
    
    

    // Revenue per category - only if order_items table exists
    try {
        $stmt = $pdo->query("SELECT cat.name as category, SUM(oi.price * oi.quantity) as total_revenue
            FROM order_items oi
            JOIN components c ON oi.component_id = c.id
            JOIN component_categories cat ON c.category_id = cat.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.status IN ('Completed','Processing')
            GROUP BY cat.id, cat.name
            ORDER BY total_revenue DESC");
        $reports['revenue_per_category'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $reports['revenue_per_category'] = [];
        error_log("get_reports_data: Failed to fetch revenue per category (order_items table may not exist): " . $e->getMessage());
    }
    
    

    // Revenue per brand - only if order_items table exists
    try {
        $stmt = $pdo->query("SELECT c.brand, SUM(oi.price * oi.quantity) as total_revenue
            FROM order_items oi
            JOIN components c ON oi.component_id = c.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.status IN ('Completed','Processing') AND c.brand IS NOT NULL AND c.brand != ''
            GROUP BY c.brand
            ORDER BY total_revenue DESC");
        $reports['revenue_per_brand'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $reports['revenue_per_brand'] = [];
        error_log("get_reports_data: Failed to fetch revenue per brand (order_items table may not exist): " . $e->getMessage());
    }
    
    

    // Deadstock detection (stock > 0, no sales in last X days)
    try {
        $period = isset($_GET['period']) && is_numeric($_GET['period']) ? intval($_GET['period']) : 90;
        if ($period < 1) $period = 90;
        
        // Check if order_items table exists and has data
        $tableExists = $pdo->query("SHOW TABLES LIKE 'order_items'")->fetchColumn();
        $hasOrderData = false;
        
        if ($tableExists) {
            $orderCount = $pdo->query("SELECT COUNT(*) FROM order_items")->fetchColumn();
            $hasOrderData = $orderCount > 0;
        }
        
        if (!$tableExists || !$hasOrderData) {
            // No order data exists - show ALL components with stock as deadstock
            $stmt = $pdo->query("SELECT 
                c.id, 
                c.name, 
                c.stock_quantity, 
                c.price, 
                (c.price * c.stock_quantity) as total_value,
                NULL as last_sold_date
                FROM components c
                WHERE c.stock_quantity > 0
                ORDER BY total_value DESC");
            
            $deadstockItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $totalDeadstockValue = array_sum(array_column($deadstockItems, 'total_value'));
            
            $reports['deadstock'] = $deadstockItems;
            $reports['deadstock_total_value'] = $totalDeadstockValue;
        } else {
            // Order data exists - use normal deadstock logic
            $stmt = $pdo->query("SELECT 
                c.id, 
                c.name, 
                c.stock_quantity, 
                c.price, 
                (c.price * c.stock_quantity) as total_value,
                MAX(o.order_date) as last_sold_date
                FROM components c
                LEFT JOIN order_items oi ON c.id = oi.component_id
                LEFT JOIN orders o ON oi.order_id = o.id AND o.status IN ('Completed','Processing')
                WHERE c.stock_quantity > 0
                GROUP BY c.id, c.name, c.stock_quantity, c.price
                HAVING (MAX(o.order_date) IS NULL OR MAX(o.order_date) < DATE_SUB(CURDATE(), INTERVAL $period DAY))
                ORDER BY total_value DESC");
            
            $deadstockItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $totalDeadstockValue = array_sum(array_column($deadstockItems, 'total_value'));
            
            $reports['deadstock'] = $deadstockItems;
            $reports['deadstock_total_value'] = $totalDeadstockValue;
        }
    } catch (Exception $e) {
        $reports['deadstock'] = [];
        $reports['deadstock_total_value'] = 0;
        error_log("get_reports_data: Failed to fetch deadstock: " . $e->getMessage());
    }
    
    

    // Stock movement (sales out per product, last 30 days) - only if order_items table exists
    try {
        $stmt = $pdo->query("SELECT c.id, c.name, SUM(oi.quantity) as sold_last_30_days
            FROM order_items oi
            JOIN components c ON oi.component_id = c.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.status IN ('Completed','Processing') AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY c.id, c.name
            ORDER BY sold_last_30_days DESC");
        $reports['stock_movement'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $reports['stock_movement'] = [];
        error_log("get_reports_data: Failed to fetch stock movement (order_items table may not exist): " . $e->getMessage());
    }
    
    

    // Order status breakdown
    try {
        $stmt = $pdo->query("SELECT status, COUNT(*) as count FROM orders GROUP BY status");
        $reports['order_status_breakdown'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $reports['order_status_breakdown'] = [];
        error_log("get_reports_data: Failed to fetch order status breakdown: " . $e->getMessage());
    }

    // Average order value (include processing and completed orders)
    try {
        $stmt = $pdo->query("SELECT AVG(total_price) as avg_order_value FROM orders WHERE status IN ('Completed','Processing')");
        $avgOrderValue = $stmt->fetch(PDO::FETCH_ASSOC);
        // Handle NULL case when AVG returns NULL (no matching orders)
        if ($avgOrderValue && $avgOrderValue['avg_order_value'] !== null) {
            $reports['average_order_value'] = ['avg_order_value' => (float)$avgOrderValue['avg_order_value']];
        } else {
            $reports['average_order_value'] = ['avg_order_value' => 0];
        }
    } catch (Exception $e) {
        $reports['average_order_value'] = ['avg_order_value' => 0];
        error_log("get_reports_data: Failed to fetch average order value: " . $e->getMessage());
    }

    // Add total sales and total orders for the dashboard
    try {
        $reports['total_sales'] = array_sum(array_column($reports['monthly_sales'], 'total_sales'));
        $reports['total_orders'] = array_sum(array_column($reports['order_status_breakdown'], 'count'));
    } catch (Exception $e) {
        $reports['total_sales'] = 0;
        $reports['total_orders'] = 0;
        error_log("get_reports_data: Failed to calculate totals: " . $e->getMessage());
    }
    
    

    return $reports;
}

 