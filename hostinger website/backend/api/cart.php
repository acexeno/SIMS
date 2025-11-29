<?php
// Cart API for managing user shopping carts

// Only load dependencies if not already loaded by router
if (!function_exists('get_db_connection')) {
    require_once __DIR__ . '/../config/cors.php';
    require_once __DIR__ . '/../config/database.php';
    require_once __DIR__ . '/../utils/jwt_helper.php';
    require_once __DIR__ . '/auth.php'; // for getBearerToken()
}

// Only set headers if not already set
if (!headers_sent()) {
    header('Content-Type: application/json');
}

// Only get connection if not provided
if (!isset($pdo)) {
    $pdo = null; // Will be set in routing section if needed
}

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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1
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
            
            // CRITICAL: Check if id column has AUTO_INCREMENT and PRIMARY KEY
            $stmt = $pdo->query("SHOW COLUMNS FROM cart_items WHERE Field = 'id'");
            $idColumn = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($idColumn) {
                $hasAutoIncrement = strpos($idColumn['Extra'], 'auto_increment') !== false;
                $hasPrimaryKey = strpos($idColumn['Key'], 'PRI') !== false;
                
                if (!$hasAutoIncrement || !$hasPrimaryKey) {
                    error_log("CRITICAL: cart_items.id column missing AUTO_INCREMENT or PRIMARY KEY. Fixing...");
                    
                    // Get max ID if there are existing records
                    $stmt = $pdo->query("SELECT MAX(id) as max_id FROM cart_items");
                    $result = $stmt->fetch(PDO::FETCH_ASSOC);
                    $maxId = (int)($result['max_id'] ?? 0);
                    
                    // Delete any records with id = 0
                    $pdo->exec("DELETE FROM cart_items WHERE id = 0");
                    
                    // Fix the id column - add AUTO_INCREMENT and PRIMARY KEY
                    try {
                        if ($maxId > 0) {
                            // Has existing records - set AUTO_INCREMENT to max + 1
                            $pdo->exec("ALTER TABLE cart_items MODIFY id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY");
                            $pdo->exec("ALTER TABLE cart_items AUTO_INCREMENT = " . ($maxId + 1));
                        } else {
                            // Empty table - set AUTO_INCREMENT to 1
                            $pdo->exec("ALTER TABLE cart_items MODIFY id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY");
                            $pdo->exec("ALTER TABLE cart_items AUTO_INCREMENT = 1");
                        }
                        error_log("SUCCESS: Fixed cart_items.id column - added AUTO_INCREMENT and PRIMARY KEY");
                    } catch (Exception $fixException) {
                        error_log("CRITICAL: Failed to fix cart_items.id column: " . $fixException->getMessage());
                        // Continue anyway - maybe it will work
                    }
                } else {
                    // AUTO_INCREMENT and PRIMARY KEY exist, just ensure AUTO_INCREMENT value is correct
                    $stmt = $pdo->query("SELECT COUNT(*) as count FROM cart_items WHERE id = 0");
                    $result = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($result && (int)$result['count'] > 0) {
                        error_log("WARNING: Found " . $result['count'] . " cart_items with id = 0. Attempting to fix...");
                        $pdo->exec("DELETE FROM cart_items WHERE id = 0");
                    }
                    
                    // Ensure AUTO_INCREMENT is properly set
                    $stmt = $pdo->query("SELECT MAX(id) as max_id FROM cart_items");
                    $result = $stmt->fetch(PDO::FETCH_ASSOC);
                    $maxId = (int)($result['max_id'] ?? 0);
                    if ($maxId > 0) {
                        $pdo->exec("ALTER TABLE cart_items AUTO_INCREMENT = " . ($maxId + 1));
                    } else {
                        $pdo->exec("ALTER TABLE cart_items AUTO_INCREMENT = 1");
                    }
                }
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
        // CRITICAL: First, get all prebuilts already in cart to protect them
        // This must be done FIRST before any processing to ensure we never affect existing prebuilts
        $stmt = $pdo->prepare("
            SELECT ci.id as cart_item_id, ci.prebuilt_id, p.id, p.component_ids 
            FROM cart_items ci
            JOIN prebuilts p ON ci.prebuilt_id = p.id
            WHERE ci.user_id = ? AND ci.prebuilt_id IS NOT NULL
        ");
        $stmt->execute([$userId]);
        $existingPrebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get all component cart items for this user (ONLY component items, never prebuilts)
        $stmt = $pdo->prepare("
            SELECT ci.id, ci.component_id, ci.quantity
            FROM cart_items ci
            WHERE ci.user_id = ? AND ci.component_id IS NOT NULL AND ci.prebuilt_id IS NULL
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
        
        // Collect all component IDs from existing prebuilts in cart
        $protectedComponentIds = [];
        $existingPrebuiltIds = [];
        foreach ($existingPrebuilts as $existingPrebuilt) {
            $existingPrebuiltIds[] = (int)$existingPrebuilt['id'];
            $existingComponentIds = json_decode($existingPrebuilt['component_ids'], true);
            if (is_array($existingComponentIds)) {
                foreach ($existingComponentIds as $key => $value) {
                    if (is_numeric($value)) {
                        $protectedComponentIds[] = (int)$value;
                    } elseif (is_numeric($key)) {
                        $protectedComponentIds[] = (int)$key;
                    }
                }
            }
        }
        
        foreach ($prebuilts as $prebuilt) {
            $prebuiltId = (int)$prebuilt['id'];
            
            // Skip if user already has this prebuilt in cart
            if (in_array($prebuiltId, $existingPrebuiltIds)) {
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
            // BUT: Skip components that are already part of existing prebuilts in cart
            $userComponentIds = array_map(function($item) {
                return (int)$item['component_id'];
            }, $componentItems);
            
            // Filter out protected components (those already in other prebuilts)
            $unprotectedComponentIds = array_filter($prebuiltComponentIds, function($compId) use ($protectedComponentIds) {
                return !in_array($compId, $protectedComponentIds);
            });
            
            // If all components are protected, skip this prebuilt
            if (empty($unprotectedComponentIds)) {
                continue; // All components are already part of other prebuilts, skip
            }
            
            // Check if all unprotected components are in cart
            $allComponentsInCart = true;
            $matchingCartItems = [];
            $minQuantity = PHP_INT_MAX;
            
            foreach ($unprotectedComponentIds as $compId) {
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
            
            // If all unprotected components are in cart, convert to prebuilt
            if ($allComponentsInCart && count($matchingCartItems) === count($unprotectedComponentIds)) {
                // CRITICAL: Delete ONLY component items (never prebuilts)
                // Double-check that we're only deleting component items by verifying prebuilt_id IS NULL
                $placeholders = str_repeat('?,', count($matchingCartItems) - 1) . '?';
                $stmt = $pdo->prepare("DELETE FROM cart_items WHERE id IN ($placeholders) AND user_id = ? AND component_id IS NOT NULL AND prebuilt_id IS NULL");
                $stmt->execute(array_merge($matchingCartItems, [$userId]));
                
                // Add the prebuilt to cart with the minimum quantity found
                try {
                    $stmt = $pdo->prepare("INSERT INTO cart_items (user_id, prebuilt_id, quantity) VALUES (?, ?, ?)");
                    $stmt->execute([$userId, $prebuiltId, max(1, $minQuantity)]);
                } catch (PDOException $e) {
                    // Handle unique constraint violation (prebuilt was added between check and insert)
                    if ($e->getCode() == 23000 || strpos($e->getMessage(), 'Duplicate entry') !== false || strpos($e->getMessage(), 'unique_user_prebuilt') !== false) {
                        // Prebuilt already exists, update quantity instead
                        $stmt = $pdo->prepare("SELECT id, quantity FROM cart_items WHERE user_id = ? AND prebuilt_id = ?");
                        $stmt->execute([$userId, $prebuiltId]);
                        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
                        if ($existing) {
                            $newQuantity = (int)$existing['quantity'] + max(1, $minQuantity);
                            $stmt = $pdo->prepare("UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?");
                            $stmt->execute([$newQuantity, $existing['id']]);
                        }
                        // Continue processing even if insert failed (item already exists)
                    } else {
                        // Re-throw if it's a different error
                        throw $e;
                    }
                }
                
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
        
        // Auto-cleanup: Convert old prebuilt components to prebuilt items (only once per request)
        // IMPORTANT: Only run cleanup if there are component items AND we're not in a critical operation
        // The cleanup function already protects components that belong to existing prebuilts
        // Check if cleanup was already done in this request
        static $cleanupDone = false;
        if (!$cleanupDone && !isset($_GET['skip_cleanup'])) {
            // Quick check: run cleanup ONLY if there are component items AND no recent prebuilt additions
            // This prevents cleanup from interfering with prebuilts that were just added
            $quickCheck = $pdo->prepare("
                SELECT 
                    (SELECT COUNT(*) FROM cart_items WHERE user_id = ? AND component_id IS NOT NULL) as comp_count,
                    (SELECT COUNT(*) FROM cart_items WHERE user_id = ? AND prebuilt_id IS NOT NULL) as prebuilt_count,
                    (SELECT MAX(created_at) FROM cart_items WHERE user_id = ? AND prebuilt_id IS NOT NULL) as last_prebuilt_added
            ");
            $quickCheck->execute([$userId, $userId, $userId]);
            $counts = $quickCheck->fetch(PDO::FETCH_ASSOC);
            $compCount = (int)$counts['comp_count'];
            $prebuiltCount = (int)$counts['prebuilt_count'];
            $lastPrebuiltAdded = $counts['last_prebuilt_added'];
            
            // Only run cleanup if:
            // 1. There are component items to potentially convert
            // 2. Either there are no prebuilts, OR the last prebuilt was added more than 5 seconds ago
            //    (this prevents cleanup from running immediately after adding a prebuilt)
            $shouldRunCleanup = false;
            if ($compCount > 0) {
                if ($prebuiltCount === 0) {
                    // No prebuilts, safe to run cleanup
                    $shouldRunCleanup = true;
                } elseif ($lastPrebuiltAdded) {
                    // Check if last prebuilt was added more than 5 seconds ago
                    $lastAddedTime = strtotime($lastPrebuiltAdded);
                    $currentTime = time();
                    if (($currentTime - $lastAddedTime) > 5) {
                        // Last prebuilt was added more than 5 seconds ago, safe to run cleanup
                        $shouldRunCleanup = true;
                    }
                }
            }
            
            if ($shouldRunCleanup && !isset($_GET['skip_cleanup'])) {
                $cleanupResult = cleanupPrebuiltComponentsInCart($pdo, $userId);
                $cleanupDone = true;
                // Log cleanup if it happened
                if ($cleanupResult['cleaned'] > 0) {
                    error_log("Cart cleanup for user {$userId}: " . $cleanupResult['message']);
                }
            } else {
                $cleanupDone = true; // Mark as done even if we skip
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
                p.image as image_url,
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
        
        // CRITICAL: Filter out items with invalid IDs (id = 0 or null) before returning
        $validCartItems = [];
        foreach ($cartItems as $item) {
            if (!isset($item['id']) || $item['id'] === null) {
                error_log("WARNING: Filtered out cart item with missing ID for user_id: " . $userId);
                continue;
            }
            
            $itemId = (int)$item['id'];
            if ($itemId > 0) {
                // Ensure ID is properly cast as integer
                $item['id'] = $itemId;
                $validCartItems[] = $item;
            } else {
                // Log invalid items for debugging
                error_log("WARNING: Filtered out cart item with invalid ID (0 or negative): " . var_export($item['id'], true) . " for user_id: " . $userId);
            }
        }
        
        usort($validCartItems, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });
        
        // Calculate total
        $total = 0;
        foreach ($validCartItems as $item) {
            $total += (float)$item['price'] * (int)$item['quantity'];
        }
        
        echo json_encode([
            'success' => true,
            'data' => $validCartItems,
            'total' => $total,
            'item_count' => count($validCartItems)
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        error_log('Get cart error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'Failed to fetch cart: ' . $e->getMessage()]);
    }
}

// Helper function to find matching prebuilt by component IDs
function findMatchingPrebuilt($pdo, $componentIds) {
    try {
        // Get all prebuilts
        $stmt = $pdo->prepare("SELECT id, name, component_ids, in_stock FROM prebuilts WHERE in_stock = 1");
        $stmt->execute();
        $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Normalize input component IDs to array of numeric IDs
        $inputIds = [];
        if (is_array($componentIds)) {
            foreach ($componentIds as $key => $value) {
                if (is_numeric($value)) {
                    $inputIds[] = (int)$value;
                } elseif (is_numeric($key)) {
                    $inputIds[] = (int)$key;
                }
            }
        }
        $inputIds = array_unique($inputIds);
        sort($inputIds);
        
        if (empty($inputIds)) {
            return null;
        }
        
        // Check each prebuilt
        foreach ($prebuilts as $prebuilt) {
            $prebuiltComponentIds = json_decode($prebuilt['component_ids'], true);
            if (!is_array($prebuiltComponentIds)) {
                continue;
            }
            
            // Normalize prebuilt component IDs (handle both object {cpu: 1, ...} and array formats)
            $prebuiltIds = [];
            foreach ($prebuiltComponentIds as $key => $value) {
                if (is_numeric($value)) {
                    $prebuiltIds[] = (int)$value;
                } elseif (is_numeric($key)) {
                    $prebuiltIds[] = (int)$key;
                }
            }
            $prebuiltIds = array_unique($prebuiltIds);
            sort($prebuiltIds);
            
            // Check if component IDs match exactly (same count and same IDs)
            if (count($inputIds) === count($prebuiltIds)) {
                $match = true;
                for ($i = 0; $i < count($inputIds); $i++) {
                    if ($inputIds[$i] !== $prebuiltIds[$i]) {
                        $match = false;
                        break;
                    }
                }
                if ($match) {
                    return [
                        'id' => (int)$prebuilt['id'],
                        'name' => $prebuilt['name'],
                        'in_stock' => (int)$prebuilt['in_stock']
                    ];
                }
            }
        }
        
        return null;
    } catch (Exception $e) {
        error_log('Error finding matching prebuilt: ' . $e->getMessage());
        return null;
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
            // IMPORTANT: Allow components to be added even if they're part of another prebuilt
            // Users should be able to have multiple prebuilts with overlapping components
            // Only prevent true duplicates (same component added twice as individual items)
            
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
                try {
                    $stmt = $pdo->prepare("INSERT INTO cart_items (user_id, component_id, quantity) VALUES (?, ?, ?)");
                    $stmt->execute([$userId, $componentId, $quantity]);
                    $cartItemId = $pdo->lastInsertId();
                } catch (PDOException $insertException) {
                    // Check for foreign key constraint violations
                    $errorCode = $insertException->getCode();
                    $errorMessage = $insertException->getMessage();
                    
                    if ($errorCode == 23000 || strpos($errorMessage, 'foreign key constraint') !== false || strpos($errorMessage, 'Cannot add or update') !== false) {
                        error_log("CRITICAL: Foreign key constraint violation when adding component to cart: user_id={$userId}, component_id={$componentId}, error=" . $errorMessage);
                        http_response_code(400);
                        echo json_encode([
                            'success' => false,
                            'error' => 'Invalid component or user. Please refresh the page and try again.'
                        ]);
                        return;
                    } else {
                        // Re-throw other database errors
                        error_log("CRITICAL: Database error when inserting component to cart: user_id={$userId}, component_id={$componentId}, error=" . $errorMessage);
                        throw $insertException;
                    }
                }
                
                // Verify the insertion was successful
                if (!$cartItemId || $cartItemId <= 0) {
                    error_log("CRITICAL: Failed to insert component to cart - lastInsertId returned invalid value: {$cartItemId} for user_id={$userId}, component_id={$componentId}");
                    
                    // Try to fix AUTO_INCREMENT and retry
                    try {
                        // First, check if the insert actually succeeded by querying the table
                        $checkStmt = $pdo->prepare("SELECT id FROM cart_items WHERE user_id = ? AND component_id = ? ORDER BY id DESC LIMIT 1");
                        $checkStmt->execute([$userId, $componentId]);
                        $existingItem = $checkStmt->fetch(PDO::FETCH_ASSOC);
                        
                        if ($existingItem && isset($existingItem['id']) && $existingItem['id'] > 0) {
                            // Insert actually succeeded, just lastInsertId() didn't work
                            $cartItemId = (int)$existingItem['id'];
                            error_log("INFO: Insert succeeded but lastInsertId failed. Using queried ID: {$cartItemId}");
                        } else {
                            // Insert really failed, try to fix AUTO_INCREMENT
                            $stmt = $pdo->query("SELECT MAX(id) as max_id FROM cart_items");
                            $result = $stmt->fetch(PDO::FETCH_ASSOC);
                            $maxId = (int)($result['max_id'] ?? 0);
                            
                            // Try to fix AUTO_INCREMENT (may fail due to permissions, but that's OK)
                            try {
                                $pdo->exec("ALTER TABLE cart_items AUTO_INCREMENT = " . ($maxId + 1));
                                error_log("INFO: Successfully fixed AUTO_INCREMENT to " . ($maxId + 1));
                            } catch (Exception $alterException) {
                                error_log("WARNING: Could not fix AUTO_INCREMENT (may need manual SQL fix): " . $alterException->getMessage());
                                // Continue anyway - maybe the table is fine
                            }
                            
                            // Retry the insert
                            $stmt = $pdo->prepare("INSERT INTO cart_items (user_id, component_id, quantity) VALUES (?, ?, ?)");
                            $stmt->execute([$userId, $componentId, $quantity]);
                            $cartItemId = $pdo->lastInsertId();
                            
                            // If lastInsertId still fails, try to query for the inserted record
                            if (!$cartItemId || $cartItemId <= 0) {
                                $checkStmt = $pdo->prepare("SELECT id FROM cart_items WHERE user_id = ? AND component_id = ? ORDER BY id DESC LIMIT 1");
                                $checkStmt->execute([$userId, $componentId]);
                                $retryItem = $checkStmt->fetch(PDO::FETCH_ASSOC);
                                
                                if ($retryItem && isset($retryItem['id']) && $retryItem['id'] > 0) {
                                    $cartItemId = (int)$retryItem['id'];
                                    error_log("INFO: Retry insert succeeded but lastInsertId failed. Using queried ID: {$cartItemId}");
                                } else {
                                    error_log("CRITICAL: Retry insert completely failed - lastInsertId: {$cartItemId}, queried: " . var_export($retryItem, true));
                                    http_response_code(500);
                                    echo json_encode([
                                        'success' => false, 
                                        'error' => 'Failed to add item to cart - database error. Please contact support or run the SQL fix commands.',
                                        'debug_info' => 'lastInsertId returned: ' . $cartItemId
                                    ]);
                                    return;
                                }
                            }
                        }
                    } catch (Exception $retryException) {
                        error_log("CRITICAL: Exception during retry: " . $retryException->getMessage() . " | Trace: " . $retryException->getTraceAsString());
                        http_response_code(500);
                        echo json_encode([
                            'success' => false, 
                            'error' => 'Failed to add item to cart - database error: ' . $retryException->getMessage()
                        ]);
                        return;
                    }
                }
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Item added to cart',
                    'cart_item_id' => $cartItemId
                ]);
            }
        } else {
            // Handle prebuilt
            $stmt = $pdo->prepare("SELECT id, name, price, in_stock, component_ids FROM prebuilts WHERE id = ?");
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
            
            // Validate prebuilt_id is a valid integer
            if (!is_numeric($prebuiltId) || $prebuiltId <= 0) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'Invalid prebuilt ID'
                ]);
                return;
            }
            
            // IMPORTANT: Before adding prebuilt, check if any of its components are already in cart as individual items
            // If so, remove them first to avoid duplicates
            // BUT: Only remove components that are NOT part of other prebuilts already in the cart
            $componentIds = json_decode($prebuilt['component_ids'], true);
            if (is_array($componentIds) && !empty($componentIds)) {
                $prebuiltComponentIds = [];
                foreach ($componentIds as $key => $value) {
                    if (is_numeric($value)) {
                        $prebuiltComponentIds[] = (int)$value;
                    } elseif (is_numeric($key)) {
                        $prebuiltComponentIds[] = (int)$key;
                    }
                }
                
                if (!empty($prebuiltComponentIds)) {
                    // Get all other prebuilts in cart (excluding the one we're adding)
                    $stmt = $pdo->prepare("
                        SELECT p.component_ids 
                        FROM cart_items ci
                        JOIN prebuilts p ON ci.prebuilt_id = p.id
                        WHERE ci.user_id = ? AND ci.prebuilt_id IS NOT NULL AND ci.prebuilt_id != ?
                    ");
                    $stmt->execute([$userId, $prebuiltId]);
                    $otherPrebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    
                    // Collect all component IDs from other prebuilts
                    $protectedComponentIds = [];
                    foreach ($otherPrebuilts as $otherPrebuilt) {
                        $otherComponentIds = json_decode($otherPrebuilt['component_ids'], true);
                        if (is_array($otherComponentIds)) {
                            foreach ($otherComponentIds as $key => $value) {
                                if (is_numeric($value)) {
                                    $protectedComponentIds[] = (int)$value;
                                } elseif (is_numeric($key)) {
                                    $protectedComponentIds[] = (int)$key;
                                }
                            }
                        }
                    }
                    
                    // Only remove components that are NOT protected (not part of other prebuilts)
                    $componentsToRemove = array_diff($prebuiltComponentIds, $protectedComponentIds);
                    
                    if (!empty($componentsToRemove)) {
                        // CRITICAL: Only delete standalone component items (prebuilt_id IS NULL)
                        // Never delete components that are part of existing prebuilts
                        $placeholders = str_repeat('?,', count($componentsToRemove) - 1) . '?';
                        $stmt = $pdo->prepare("DELETE FROM cart_items WHERE user_id = ? AND component_id IN ($placeholders) AND prebuilt_id IS NULL");
                        $stmt->execute(array_merge([$userId], array_values($componentsToRemove)));
                    }
                }
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
                try {
                // Insert new item - ensure component_id is NULL for prebuilts
                try {
                    $stmt = $pdo->prepare("INSERT INTO cart_items (user_id, prebuilt_id, component_id, quantity) VALUES (?, ?, NULL, ?)");
                    $stmt->execute([$userId, $prebuiltId, $quantity]);
                    $cartItemId = $pdo->lastInsertId();
                } catch (PDOException $insertException) {
                    // Check for unique constraint violation first (same prebuilt already in cart)
                    $errorCode = $insertException->getCode();
                    $errorMessage = $insertException->getMessage();
                    
                    if ($errorCode == 23000 && (strpos($errorMessage, 'Duplicate entry') !== false || strpos($errorMessage, 'unique_user_prebuilt') !== false)) {
                        // Item was added between check and insert, update quantity instead
                        error_log("INFO: Unique constraint violation (race condition) when adding prebuilt to cart: user_id={$userId}, prebuilt_id={$prebuiltId}");
                        $stmt = $pdo->prepare("SELECT id, quantity FROM cart_items WHERE user_id = ? AND prebuilt_id = ?");
                        $stmt->execute([$userId, $prebuiltId]);
                        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
                        
                        if ($existing) {
                            $newQuantity = (int)$existing['quantity'] + $quantity;
                            $stmt = $pdo->prepare("UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?");
                            $stmt->execute([$newQuantity, $existing['id']]);
                            echo json_encode([
                                'success' => true,
                                'message' => 'Cart updated',
                                'quantity' => $newQuantity
                            ]);
                            return;
                        } else {
                            // Should not happen, but handle gracefully
                            error_log("WARNING: Unique constraint violation but item not found: user_id={$userId}, prebuilt_id={$prebuiltId}");
                            http_response_code(400);
                            echo json_encode([
                                'success' => false,
                                'error' => 'Failed to add prebuilt to cart. Please try again.'
                            ]);
                            return;
                        }
                    } elseif ($errorCode == 23000 || strpos($errorMessage, 'foreign key constraint') !== false || strpos($errorMessage, 'Cannot add or update') !== false) {
                        // Foreign key constraint violation
                        error_log("CRITICAL: Foreign key constraint violation when adding prebuilt to cart: user_id={$userId}, prebuilt_id={$prebuiltId}, error=" . $errorMessage);
                        http_response_code(400);
                        echo json_encode([
                            'success' => false,
                            'error' => 'Invalid prebuilt or user. Please refresh the page and try again.'
                        ]);
                        return;
                    } else {
                        // Re-throw other database errors to be caught by outer try-catch
                        error_log("CRITICAL: Database error when inserting prebuilt to cart: user_id={$userId}, prebuilt_id={$prebuiltId}, error=" . $errorMessage);
                        throw $insertException;
                    }
                }
                
                // CRITICAL: Verify the insertion was successful and ID is valid
                if (!$cartItemId || $cartItemId <= 0) {
                    error_log("CRITICAL: Failed to insert prebuilt to cart - lastInsertId returned invalid value: {$cartItemId} for user_id={$userId}, prebuilt_id={$prebuiltId}");
                    
                    // Try to fix AUTO_INCREMENT and retry
                    try {
                        // First, check if the insert actually succeeded by querying the table
                        $checkStmt = $pdo->prepare("SELECT id FROM cart_items WHERE user_id = ? AND prebuilt_id = ? ORDER BY id DESC LIMIT 1");
                        $checkStmt->execute([$userId, $prebuiltId]);
                        $existingItem = $checkStmt->fetch(PDO::FETCH_ASSOC);
                        
                        if ($existingItem && isset($existingItem['id']) && $existingItem['id'] > 0) {
                            // Insert actually succeeded, just lastInsertId() didn't work
                            $cartItemId = (int)$existingItem['id'];
                            error_log("INFO: Insert succeeded but lastInsertId failed. Using queried ID: {$cartItemId}");
                        } else {
                            // Insert really failed, try to fix AUTO_INCREMENT
                            $stmt = $pdo->query("SELECT MAX(id) as max_id FROM cart_items");
                            $result = $stmt->fetch(PDO::FETCH_ASSOC);
                            $maxId = (int)($result['max_id'] ?? 0);
                            
                            // Try to fix AUTO_INCREMENT (may fail due to permissions, but that's OK)
                            try {
                                $pdo->exec("ALTER TABLE cart_items AUTO_INCREMENT = " . ($maxId + 1));
                                error_log("INFO: Successfully fixed AUTO_INCREMENT to " . ($maxId + 1));
                            } catch (Exception $alterException) {
                                error_log("WARNING: Could not fix AUTO_INCREMENT (may need manual SQL fix): " . $alterException->getMessage());
                                // Continue anyway - maybe the table is fine
                            }
                            
                            // Retry the insert
                            $stmt = $pdo->prepare("INSERT INTO cart_items (user_id, prebuilt_id, component_id, quantity) VALUES (?, ?, NULL, ?)");
                            $stmt->execute([$userId, $prebuiltId, $quantity]);
                            $cartItemId = $pdo->lastInsertId();
                            
                            // If lastInsertId still fails, try to query for the inserted record
                            if (!$cartItemId || $cartItemId <= 0) {
                                $checkStmt = $pdo->prepare("SELECT id FROM cart_items WHERE user_id = ? AND prebuilt_id = ? ORDER BY id DESC LIMIT 1");
                                $checkStmt->execute([$userId, $prebuiltId]);
                                $retryItem = $checkStmt->fetch(PDO::FETCH_ASSOC);
                                
                                if ($retryItem && isset($retryItem['id']) && $retryItem['id'] > 0) {
                                    $cartItemId = (int)$retryItem['id'];
                                    error_log("INFO: Retry insert succeeded but lastInsertId failed. Using queried ID: {$cartItemId}");
                                } else {
                                    error_log("CRITICAL: Retry insert completely failed - lastInsertId: {$cartItemId}, queried: " . var_export($retryItem, true));
                                    http_response_code(500);
                                    echo json_encode([
                                        'success' => false, 
                                        'error' => 'Failed to add prebuilt to cart - database error. Please contact support or run the SQL fix commands.',
                                        'debug_info' => 'lastInsertId returned: ' . $cartItemId
                                    ]);
                                    return;
                                }
                            }
                        }
                    } catch (Exception $retryException) {
                        error_log("CRITICAL: Exception during retry: " . $retryException->getMessage() . " | Trace: " . $retryException->getTraceAsString());
                        http_response_code(500);
                        echo json_encode([
                            'success' => false, 
                            'error' => 'Failed to add prebuilt to cart - database error: ' . $retryException->getMessage()
                        ]);
                        return;
                    }
                }
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Prebuilt added to cart',
                    'cart_item_id' => $cartItemId,
                    'prebuilt_id' => $prebuiltId,
                    'prebuilt_name' => $prebuilt['name']
                ]);
                } catch (PDOException $e) {
                    // Handle unique constraint violation (race condition)
                    if ($e->getCode() == 23000 || strpos($e->getMessage(), 'Duplicate entry') !== false || strpos($e->getMessage(), 'unique_user_prebuilt') !== false) {
                        // Item was added between check and insert, update quantity instead
                        $stmt = $pdo->prepare("SELECT id, quantity FROM cart_items WHERE user_id = ? AND prebuilt_id = ?");
                        $stmt->execute([$userId, $prebuiltId]);
                        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
                        
                        if ($existing) {
                            $newQuantity = (int)$existing['quantity'] + $quantity;
                            $stmt = $pdo->prepare("UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?");
                            $stmt->execute([$newQuantity, $existing['id']]);
                            echo json_encode([
                                'success' => true,
                                'message' => 'Cart updated',
                                'quantity' => $newQuantity
                            ]);
                        } else {
                            // Should not happen, but handle gracefully
                            error_log("Unique constraint violation but item not found: user_id={$userId}, prebuilt_id={$prebuiltId}, error=" . $e->getMessage());
                            http_response_code(500);
                            echo json_encode(['success' => false, 'error' => 'Failed to add prebuilt to cart']);
                        }
                    } else {
                        // Log other database errors for debugging
                        error_log("Database error adding prebuilt to cart: user_id={$userId}, prebuilt_id={$prebuiltId}, error=" . $e->getMessage());
                        // Re-throw if it's a different error
                        throw $e;
                    }
                }
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
        // Verify cart item belongs to user
        $stmt = $pdo->prepare("SELECT ci.id, ci.component_id, c.stock_quantity FROM cart_items ci JOIN components c ON ci.component_id = c.id WHERE ci.id = ? AND ci.user_id = ?");
        $stmt->execute([$cartItemId, $userId]);
        $cartItem = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$cartItem) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Cart item not found']);
            return;
        }
        
        // Check stock availability
        if ((int)$cartItem['stock_quantity'] < $quantity) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Insufficient stock',
                'available' => (int)$cartItem['stock_quantity'],
                'requested' => $quantity
            ]);
            return;
        }
        
        // Update quantity
        $stmt = $pdo->prepare("UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$quantity, $cartItemId]);
        
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

// Main routing - execute when called directly OR when included via index.php
// When included via index.php, always execute (cart endpoint is being called)
// When called directly, check SCRIPT_NAME
$shouldExecute = (
    basename($_SERVER['SCRIPT_NAME'] ?? '') === 'cart.php' ||
    (isset($pdo) && $pdo instanceof PDO) ||
    (isset($_GET['endpoint']) && $_GET['endpoint'] === 'cart')
);

if ($shouldExecute) {
    // Only get connection if not already provided
    if (!isset($pdo) || !($pdo instanceof PDO)) {
        $pdo = get_db_connection();
    }
    
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    
    if ($method === 'GET') {
        if (isset($_GET['count'])) {
            handleGetCartCount($pdo);
        } elseif (isset($_GET['action']) && $_GET['action'] === 'find_prebuilt') {
            // Endpoint to find matching prebuilt by component IDs
            $decoded = requireAuthOr403();
            $componentIds = isset($_GET['component_ids']) ? json_decode($_GET['component_ids'], true) : [];
            if (empty($componentIds) || !is_array($componentIds)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Invalid component_ids']);
                return;
            }
            $match = findMatchingPrebuilt($pdo, $componentIds);
            if ($match) {
                echo json_encode(['success' => true, 'prebuilt' => $match]);
            } else {
                echo json_encode(['success' => false, 'prebuilt' => null]);
            }
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
