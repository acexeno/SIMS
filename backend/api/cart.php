<?php
// Cart API for managing user shopping carts

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/jwt_helper.php';
require_once __DIR__ . '/auth.php'; // for getBearerToken()

header('Content-Type: application/json');

// Only define these functions if they don't already exist (from orders.php)
if (!function_exists('getDecodedToken')) {
    function getDecodedToken() {
        $token = getBearerToken();
        if (!$token && isset($_GET['token'])) {
            $token = $_GET['token'];
        }
        if (!$token) return null;
        try {
            $decoded = verifyJWT($token);
            return $decoded ?: null;
        } catch (Exception $e) {
            return null;
        }
    }
}

if (!function_exists('requireAuthOr403')) {
    function requireAuthOr403() {
        $decoded = getDecodedToken();
        if (!$decoded || !isset($decoded['user_id'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Unauthorized']);
            exit;
        }
        return $decoded;
    }
}

// Check if cart_items table exists, create if not
function ensureCartTableExists($pdo) {
    try {
        // Check if table exists
        $stmt = $pdo->query("SHOW TABLES LIKE 'cart_items'");
        if ($stmt->rowCount() === 0) {
            // Table doesn't exist, create it
            $createTableSql = "
                CREATE TABLE IF NOT EXISTS cart_items (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    component_id INT NULL,
                    prebuilt_id INT NULL,
                    quantity INT NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE,
                    FOREIGN KEY (prebuilt_id) REFERENCES prebuilts(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_user_component (user_id, component_id),
                    UNIQUE KEY unique_user_prebuilt (user_id, prebuilt_id),
                    INDEX idx_user_id (user_id),
                    INDEX idx_component_id (component_id),
                    INDEX idx_prebuilt_id (prebuilt_id),
                    CHECK ((component_id IS NOT NULL AND prebuilt_id IS NULL) OR (component_id IS NULL AND prebuilt_id IS NOT NULL))
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ";
            $pdo->exec($createTableSql);
        } else {
            // Table exists, check if prebuilt_id column exists
            $stmt = $pdo->query("SHOW COLUMNS FROM cart_items LIKE 'prebuilt_id'");
            if ($stmt->rowCount() === 0) {
                // Add prebuilt_id column
                $pdo->exec("ALTER TABLE cart_items ADD COLUMN prebuilt_id INT NULL AFTER component_id");
                $pdo->exec("ALTER TABLE cart_items ADD FOREIGN KEY (prebuilt_id) REFERENCES prebuilts(id) ON DELETE CASCADE");
                $pdo->exec("ALTER TABLE cart_items ADD UNIQUE KEY unique_user_prebuilt (user_id, prebuilt_id)");
                $pdo->exec("ALTER TABLE cart_items ADD INDEX idx_prebuilt_id (prebuilt_id)");
                // Modify component_id to allow NULL
                $pdo->exec("ALTER TABLE cart_items MODIFY component_id INT NULL");
            }
        }
        return true;
    } catch (Exception $e) {
        error_log('Failed to ensure cart_items table exists: ' . $e->getMessage());
        return false;
    }
}

// Cleanup: Convert old cart data where prebuilts were added as individual components
function cleanupPrebuiltComponentsInCart($pdo, $userId) {
    try {
        // Get all component cart items for this user
        $stmt = $pdo->prepare("
            SELECT ci.id, ci.component_id, ci.quantity
            FROM cart_items ci
            WHERE ci.user_id = ? AND ci.component_id IS NOT NULL
        ");
        $stmt->execute([$userId]);
        $componentItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($componentItems)) {
            return ['cleaned' => 0, 'message' => 'No component items to check'];
        }
        
        // Get all prebuilts
        $stmt = $pdo->prepare("SELECT id, name, component_ids FROM prebuilts WHERE in_stock = 1");
        $stmt->execute();
        $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $cleanedCount = 0;
        $processedPrebuilts = [];
        
        foreach ($prebuilts as $prebuilt) {
            $prebuiltId = (int)$prebuilt['id'];
            
            // Skip if user already has this prebuilt in cart
            $stmt = $pdo->prepare("SELECT id FROM cart_items WHERE user_id = ? AND prebuilt_id = ?");
            $stmt->execute([$userId, $prebuiltId]);
            if ($stmt->fetch()) {
                continue; // Already have this prebuilt, skip
            }
            
            // Parse component_ids
            $componentIds = json_decode($prebuilt['component_ids'], true);
            if (!is_array($componentIds) || empty($componentIds)) {
                continue;
            }
            
            // Get all component IDs from the prebuilt (handle both array and object formats)
            $prebuiltComponentIds = [];
            foreach ($componentIds as $key => $value) {
                if (is_numeric($value)) {
                    $prebuiltComponentIds[] = (int)$value;
                } elseif (is_numeric($key)) {
                    $prebuiltComponentIds[] = (int)$key;
                }
            }
            
            if (empty($prebuiltComponentIds)) {
                continue;
            }
            
            // Check if all prebuilt components are in the user's cart
            $userComponentIds = array_map(function($item) {
                return (int)$item['component_id'];
            }, $componentItems);
            
            $allComponentsInCart = true;
            $matchingCartItems = [];
            $minQuantity = PHP_INT_MAX;
            
            foreach ($prebuiltComponentIds as $compId) {
                $found = false;
                foreach ($componentItems as $cartItem) {
                    if ((int)$cartItem['component_id'] === $compId) {
                        $found = true;
                        $matchingCartItems[] = $cartItem['id'];
                        $minQuantity = min($minQuantity, (int)$cartItem['quantity']);
                        break;
                    }
                }
                if (!$found) {
                    $allComponentsInCart = false;
                    break;
                }
            }
            
            // If all components are in cart, convert to prebuilt
            if ($allComponentsInCart && count($matchingCartItems) === count($prebuiltComponentIds)) {
                // Delete the individual component cart items
                $placeholders = str_repeat('?,', count($matchingCartItems) - 1) . '?';
                $stmt = $pdo->prepare("DELETE FROM cart_items WHERE id IN ($placeholders) AND user_id = ?");
                $stmt->execute(array_merge($matchingCartItems, [$userId]));
                
                // Add the prebuilt to cart with the minimum quantity found
                $stmt = $pdo->prepare("INSERT INTO cart_items (user_id, prebuilt_id, quantity) VALUES (?, ?, ?)");
                $stmt->execute([$userId, $prebuiltId, max(1, $minQuantity)]);
                
                $cleanedCount++;
                $processedPrebuilts[] = $prebuilt['name'];
                
                // Remove processed items from componentItems array to avoid double processing
                $componentItems = array_filter($componentItems, function($item) use ($matchingCartItems) {
                    return !in_array($item['id'], $matchingCartItems);
                });
                $componentItems = array_values($componentItems); // Re-index
            }
        }
        
        return [
            'cleaned' => $cleanedCount,
            'prebuilts' => $processedPrebuilts,
            'message' => $cleanedCount > 0 
                ? "Converted {$cleanedCount} prebuilt(s) from individual components: " . implode(', ', $processedPrebuilts)
                : 'No prebuilts found to convert'
        ];
    } catch (Exception $e) {
        error_log('Cleanup prebuilt components error: ' . $e->getMessage());
        return ['cleaned' => 0, 'error' => $e->getMessage()];
    }
}

// GET: Fetch user's cart
function handleGetCart($pdo) {
    $decoded = requireAuthOr403();
    $userId = (int)$decoded['user_id'];
    
    try {
        // Ensure table exists
        if (!ensureCartTableExists($pdo)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Cart system initialization failed']);
            return;
        }
        
        // Auto-cleanup: Convert old prebuilt components to prebuilt items (only once per session)
        // Check if cleanup was already done in this request
        static $cleanupDone = false;
        if (!$cleanupDone && !isset($_GET['skip_cleanup'])) {
            $cleanupResult = cleanupPrebuiltComponentsInCart($pdo, $userId);
            $cleanupDone = true;
            // Log cleanup if it happened
            if ($cleanupResult['cleaned'] > 0) {
                error_log("Cart cleanup for user {$userId}: " . $cleanupResult['message']);
            }
        }
        
        // Fetch component items
        $stmt = $pdo->prepare("
            SELECT 
                ci.id,
                ci.component_id,
                ci.prebuilt_id,
                ci.quantity,
                c.name,
                c.price,
                c.image_url,
                c.stock_quantity,
                c.brand,
                c.model,
                ci.created_at,
                ci.updated_at,
                'component' as item_type
            FROM cart_items ci
            JOIN components c ON ci.component_id = c.id
            WHERE ci.user_id = ? AND ci.component_id IS NOT NULL AND (c.is_active IS NULL OR c.is_active = 1)
            ORDER BY ci.created_at DESC
        ");
        $stmt->execute([$userId]);
        $componentItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Fetch prebuilt items
        $stmt = $pdo->prepare("
            SELECT 
                ci.id,
                ci.component_id,
                ci.prebuilt_id,
                ci.quantity,
                p.name,
                p.price,
                p.image,
                p.category,
                p.description,
                p.component_ids,
                ci.created_at,
                ci.updated_at,
                'prebuilt' as item_type
            FROM cart_items ci
            JOIN prebuilts p ON ci.prebuilt_id = p.id
            WHERE ci.user_id = ? AND ci.prebuilt_id IS NOT NULL
            ORDER BY ci.created_at DESC
        ");
        $stmt->execute([$userId]);
        $prebuiltItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Merge items and sort by created_at
        $cartItems = array_merge($componentItems, $prebuiltItems);
        usort($cartItems, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });
        
        // Calculate total
        $total = 0;
        foreach ($cartItems as $item) {
            $total += (float)$item['price'] * (int)$item['quantity'];
        }
        
        echo json_encode([
            'success' => true,
            'data' => $cartItems,
            'total' => $total,
            'item_count' => count($cartItems)
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        error_log('Get cart error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'Failed to fetch cart: ' . $e->getMessage()]);
    }
}

// POST: Add item to cart or update quantity if exists
function handleAddToCart($pdo) {
    $decoded = requireAuthOr403();
    $userId = (int)$decoded['user_id'];
    $input = json_decode(file_get_contents('php://input'), true);
    
    $componentId = isset($input['component_id']) ? (int)$input['component_id'] : 0;
    $prebuiltId = isset($input['prebuilt_id']) ? (int)$input['prebuilt_id'] : 0;
    $quantity = isset($input['quantity']) ? max(1, (int)$input['quantity']) : 1;
    
    // Must have exactly one of component_id or prebuilt_id
    if (($componentId <= 0 && $prebuiltId <= 0) || ($componentId > 0 && $prebuiltId > 0)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Must provide exactly one of component_id or prebuilt_id']);
        return;
    }
    
    try {
        // Ensure table exists
        if (!ensureCartTableExists($pdo)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Cart system initialization failed']);
            return;
        }
        
        if ($componentId > 0) {
            // Handle component
            $stmt = $pdo->prepare("SELECT id, name, price, stock_quantity FROM components WHERE id = ? AND (is_active IS NULL OR is_active = 1)");
            $stmt->execute([$componentId]);
            $component = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$component) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Component not found']);
                return;
            }
            
            // Check stock availability
            if ((int)$component['stock_quantity'] < $quantity) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'Insufficient stock',
                    'available' => (int)$component['stock_quantity'],
                    'requested' => $quantity
                ]);
                return;
            }
            
            // Check if item already exists in cart
            $stmt = $pdo->prepare("SELECT id, quantity FROM cart_items WHERE user_id = ? AND component_id = ?");
            $stmt->execute([$userId, $componentId]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($existing) {
                // Update quantity
                $newQuantity = (int)$existing['quantity'] + $quantity;
                
                // Check stock again with new quantity
                if ((int)$component['stock_quantity'] < $newQuantity) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Insufficient stock for total quantity',
                        'available' => (int)$component['stock_quantity'],
                        'current_in_cart' => (int)$existing['quantity'],
                        'requested' => $quantity,
                        'total_would_be' => $newQuantity
                    ]);
                    return;
                }
                
                $stmt = $pdo->prepare("UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?");
                $stmt->execute([$newQuantity, $existing['id']]);
                echo json_encode([
                    'success' => true,
                    'message' => 'Cart updated',
                    'quantity' => $newQuantity
                ]);
            } else {
                // Insert new item
                $stmt = $pdo->prepare("INSERT INTO cart_items (user_id, component_id, quantity) VALUES (?, ?, ?)");
                $stmt->execute([$userId, $componentId, $quantity]);
                echo json_encode([
                    'success' => true,
                    'message' => 'Item added to cart',
                    'cart_item_id' => $pdo->lastInsertId()
                ]);
            }
        } else {
            // Handle prebuilt
            $stmt = $pdo->prepare("SELECT id, name, price, in_stock FROM prebuilts WHERE id = ?");
            $stmt->execute([$prebuiltId]);
            $prebuilt = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$prebuilt) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Prebuilt not found']);
                return;
            }
            
            // Check if prebuilt is in stock
            if ((int)$prebuilt['in_stock'] !== 1) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'Prebuilt is out of stock'
                ]);
                return;
            }
            
            // Check if item already exists in cart
            $stmt = $pdo->prepare("SELECT id, quantity FROM cart_items WHERE user_id = ? AND prebuilt_id = ?");
            $stmt->execute([$userId, $prebuiltId]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($existing) {
                // Update quantity
                $newQuantity = (int)$existing['quantity'] + $quantity;
                
                $stmt = $pdo->prepare("UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?");
                $stmt->execute([$newQuantity, $existing['id']]);
                echo json_encode([
                    'success' => true,
                    'message' => 'Cart updated',
                    'quantity' => $newQuantity
                ]);
            } else {
                // Insert new item
                $stmt = $pdo->prepare("INSERT INTO cart_items (user_id, prebuilt_id, quantity) VALUES (?, ?, ?)");
                $stmt->execute([$userId, $prebuiltId, $quantity]);
                echo json_encode([
                    'success' => true,
                    'message' => 'Prebuilt added to cart',
                    'cart_item_id' => $pdo->lastInsertId()
                ]);
            }
        }
    } catch (Exception $e) {
        http_response_code(500);
        error_log('Add to cart error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'Failed to add to cart: ' . $e->getMessage()]);
    }
}

// PUT: Update cart item quantity
function handleUpdateCartItem($pdo) {
    $decoded = requireAuthOr403();
    $userId = (int)$decoded['user_id'];
    $input = json_decode(file_get_contents('php://input'), true);
    
    $cartItemId = isset($input['cart_item_id']) ? (int)$input['cart_item_id'] : 0;
    $quantity = isset($input['quantity']) ? max(1, (int)$input['quantity']) : 1;
    
    if ($cartItemId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid cart_item_id']);
        return;
    }
    
    try {
        // Ensure table exists
        if (!ensureCartTableExists($pdo)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Cart system initialization failed']);
            return;
        }
        
        // First, check if cart item exists and belongs to user
        $stmt = $pdo->prepare("SELECT ci.id, ci.component_id, ci.prebuilt_id FROM cart_items ci WHERE ci.id = ? AND ci.user_id = ?");
        $stmt->execute([$cartItemId, $userId]);
        $cartItem = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$cartItem) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Cart item not found']);
            return;
        }
        
        // Handle component items
        if ($cartItem['component_id'] !== null) {
            // Verify component exists and get stock
            $stmt = $pdo->prepare("SELECT id, name, stock_quantity FROM components WHERE id = ? AND (is_active IS NULL OR is_active = 1)");
            $stmt->execute([$cartItem['component_id']]);
            $component = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$component) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Component not found']);
                return;
            }
            
            // Check stock availability
            if ((int)$component['stock_quantity'] < $quantity) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'Insufficient stock',
                    'available' => (int)$component['stock_quantity'],
                    'requested' => $quantity
                ]);
                return;
            }
        } 
        // Handle prebuilt items
        else if ($cartItem['prebuilt_id'] !== null) {
            // Verify prebuilt exists and is in stock
            $stmt = $pdo->prepare("SELECT id, name, in_stock FROM prebuilts WHERE id = ?");
            $stmt->execute([$cartItem['prebuilt_id']]);
            $prebuilt = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$prebuilt) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Prebuilt not found']);
                return;
            }
            
            // Check if prebuilt is in stock (prebuilts don't have quantity limits, just in_stock flag)
            if ((int)$prebuilt['in_stock'] !== 1) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'Prebuilt is out of stock'
                ]);
                return;
            }
            // For prebuilts, we don't check stock_quantity since they don't have that field
            // The in_stock flag is sufficient
        } else {
            // Cart item has neither component_id nor prebuilt_id (should not happen)
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid cart item: missing component or prebuilt reference']);
            return;
        }
        
        // Update quantity
        $stmt = $pdo->prepare("UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ? AND user_id = ?");
        $stmt->execute([$quantity, $cartItemId, $userId]);
        
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Failed to update cart item']);
            return;
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Cart item updated',
            'quantity' => $quantity
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        error_log('Update cart item error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'Failed to update cart item: ' . $e->getMessage()]);
    }
}

// DELETE: Remove item from cart
function handleRemoveFromCart($pdo) {
    $decoded = requireAuthOr403();
    $userId = (int)$decoded['user_id'];
    
    $cartItemId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    
    if ($cartItemId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid cart_item_id']);
        return;
    }
    
    try {
        // Ensure table exists
        if (!ensureCartTableExists($pdo)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Cart system initialization failed']);
            return;
        }
        // Verify cart item belongs to user
        $stmt = $pdo->prepare("SELECT id FROM cart_items WHERE id = ? AND user_id = ?");
        $stmt->execute([$cartItemId, $userId]);
        
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Cart item not found']);
            return;
        }
        
        // Delete cart item
        $stmt = $pdo->prepare("DELETE FROM cart_items WHERE id = ? AND user_id = ?");
        $stmt->execute([$cartItemId, $userId]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Item removed from cart'
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        error_log('Remove from cart error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'Failed to remove from cart: ' . $e->getMessage()]);
    }
}

// DELETE: Clear entire cart
function handleClearCart($pdo) {
    $decoded = requireAuthOr403();
    $userId = (int)$decoded['user_id'];
    
    try {
        // Ensure table exists
        if (!ensureCartTableExists($pdo)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Cart system initialization failed']);
            return;
        }
        $stmt = $pdo->prepare("DELETE FROM cart_items WHERE user_id = ?");
        $stmt->execute([$userId]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Cart cleared'
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        error_log('Clear cart error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'Failed to clear cart: ' . $e->getMessage()]);
    }
}

// GET: Get cart count
function handleGetCartCount($pdo) {
    $decoded = requireAuthOr403();
    $userId = (int)$decoded['user_id'];
    
    try {
        // Ensure table exists
        if (!ensureCartTableExists($pdo)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Cart system initialization failed']);
            return;
        }
        
        $stmt = $pdo->prepare("SELECT COUNT(*) as count, SUM(quantity) as total_items FROM cart_items WHERE user_id = ?");
        $stmt->execute([$userId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'count' => (int)$result['count'],
            'total_items' => (int)($result['total_items'] ?? 0)
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        error_log('Cart count error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'Failed to get cart count: ' . $e->getMessage()]);
    }
}

// Main routing
if (basename($_SERVER['SCRIPT_NAME']) === 'cart.php') {
    $pdo = get_db_connection();
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'GET') {
        if (isset($_GET['count'])) {
            handleGetCartCount($pdo);
        } else {
            handleGetCart($pdo);
        }
    } elseif ($method === 'POST') {
        if (isset($_GET['action']) && $_GET['action'] === 'clear') {
            handleClearCart($pdo);
        } elseif (isset($_GET['action']) && $_GET['action'] === 'cleanup') {
            // Manual cleanup endpoint
            $decoded = requireAuthOr403();
            $userId = (int)$decoded['user_id'];
            $result = cleanupPrebuiltComponentsInCart($pdo, $userId);
            echo json_encode([
                'success' => true,
                'cleaned' => $result['cleaned'],
                'prebuilts' => $result['prebuilts'] ?? [],
                'message' => $result['message'] ?? 'Cleanup completed'
            ]);
        } else {
            handleAddToCart($pdo);
        }
    } elseif ($method === 'PUT') {
        handleUpdateCartItem($pdo);
    } elseif ($method === 'DELETE') {
        handleRemoveFromCart($pdo);
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    }
}
