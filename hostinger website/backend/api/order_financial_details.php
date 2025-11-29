<?php
/**
 * Order Financial Details API
 * Handles saving and retrieving financial details for orders
 */

require_once '../config/database.php';
require_once '../middleware/auth.php';

// Enable CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$endpoint = $_GET['endpoint'] ?? '';

try {
    $pdo = getConnection();
    
    switch ($endpoint) {
        case 'save_financial_details':
            if ($method === 'POST') {
                handleSaveFinancialDetails($pdo);
            } else {
                http_response_code(405);
                echo json_encode(['success' => false, 'error' => 'Method not allowed']);
            }
            break;
            
        case 'get_financial_details':
            if ($method === 'GET') {
                handleGetFinancialDetails($pdo);
            } else {
                http_response_code(405);
                echo json_encode(['success' => false, 'error' => 'Method not allowed']);
            }
            break;
            
        default:
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Endpoint not found']);
            break;
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}

function handleSaveFinancialDetails($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
        return;
    }
    
    // Validate required fields
    $requiredFields = ['order_id', 'purchase_date'];
    foreach ($requiredFields as $field) {
        if (!isset($input[$field]) || empty($input[$field])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => "Missing required field: $field"]);
            return;
        }
    }
    
    try {
        $pdo->beginTransaction();
        
        // Check if financial details already exist for this order
        $checkStmt = $pdo->prepare("SELECT id FROM order_financial_details WHERE order_id = ?");
        $checkStmt->execute([$input['order_id']]);
        $existing = $checkStmt->fetch();
        
        $purchaseDate = $input['purchase_date'];
        $customerName = $input['customer_name'] ?? null;
        $customerPhone = $input['customer_phone'] ?? null;
        
        if ($existing) {
            // Update existing record - build set clause dynamically
            $sets = ['purchase_date = ?'];
            $vals = [$purchaseDate];
            if ($customerName !== null) {
                $sets[] = 'customer_name = ?';
                $vals[] = $customerName;
            }
            if ($customerPhone !== null) {
                $sets[] = 'customer_phone = ?';
                $vals[] = $customerPhone;
            }
            $vals[] = $input['order_id'];
            
            $sql = "UPDATE order_financial_details SET " . implode(', ', $sets) . ", updated_at = NOW() WHERE order_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($vals);
        } else {
            // Insert new record - build columns and values dynamically
            $columns = ['order_id', 'purchase_date'];
            $placeholders = ['?', '?'];
            $values = [$input['order_id'], $purchaseDate];
            
            if ($customerName !== null) {
                $columns[] = 'customer_name';
                $placeholders[] = '?';
                $values[] = $customerName;
            }
            if ($customerPhone !== null) {
                $columns[] = 'customer_phone';
                $placeholders[] = '?';
                $values[] = $customerPhone;
            }
            
            $sql = "INSERT INTO order_financial_details (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($values);
        }
        
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Financial details saved successfully']);
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to save financial details: ' . $e->getMessage()]);
    }
}

function handleGetFinancialDetails($pdo) {
    $orderId = $_GET['order_id'] ?? null;
    
    if (!$orderId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Order ID is required']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("
            SELECT * FROM order_financial_details 
            WHERE order_id = ?
        ");
        $stmt->execute([$orderId]);
        $financialDetails = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($financialDetails) {
            echo json_encode(['success' => true, 'data' => $financialDetails]);
        } else {
            echo json_encode(['success' => true, 'data' => null]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to retrieve financial details: ' . $e->getMessage()]);
    }
}
?>
