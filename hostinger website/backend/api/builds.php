<?php
// Builds API for SIMS

// Include CORS and database configuration
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/jwt_helper.php';
require_once __DIR__ . '/auth.php'; // Include auth functions for getBearerToken

// Ensure a database connection is available whether routed via index.php or direct access
if (!isset($pdo) || !$pdo) {
    $pdo = get_db_connection();
}

// Only execute routing logic if this file is called directly
if (basename($_SERVER['SCRIPT_NAME']) === 'builds.php') {
    // Get the request method
    $method = $_SERVER['REQUEST_METHOD'];

    // Handle different HTTP methods
    switch ($method) {
        case 'POST':
            handleCreateBuild($pdo);
            break;
        case 'GET':
            // Check if it's a test request first
            if (isset($_GET['test'])) {
                if ($_GET['test'] === 'auth') {
                    handleTestAuth($pdo);
                } else if ($_GET['test'] === 'ping') {
                    handlePing();
                } else {
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid test parameter']);
                }
            } else if (isset($_GET['public'])) {
                // New endpoint for public builds
                handleGetPublicBuilds($pdo);
            } else {
                handleGetBuilds($pdo);
            }
            break;
        case 'PUT':
            if (isset($_GET['public'])) {
                handleTogglePublicBuild($pdo);
            } else {
                handleUpdateBuild($pdo);
            }
            break;
        case 'DELETE':
            handleDeleteBuild($pdo);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            break;
    }
}

function handleCreateBuild($pdo) {
    // Robust body parsing (JSON or form-encoded)
    $raw = file_get_contents('php://input');
    $input = [];
    if (is_string($raw) && $raw !== '') {
        $json = json_decode($raw, true);
        if (is_array($json)) {
            $input = $json;
        } else {
            $tmp = [];
            parse_str($raw, $tmp);
            if (is_array($tmp) && !empty($tmp)) $input = $tmp;
        }
    }
    if (empty($input) && !empty($_POST)) {
        $input = $_POST;
    }
    
    if (!$input || !is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON input']);
        return;
    }
    
    // Validate required fields
    if (empty($input['name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Build name is required']);
        return;
    }
    
    // Get user ID from JWT token
    $userId = getUserIdFromToken();
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        // Check for duplicate build (same name and components for this user)
        $componentsJson = json_encode($input['components']);
        $stmt = $pdo->prepare("
            SELECT id FROM user_builds 
            WHERE user_id = ? AND name = ? AND components = ?
        ");
        $stmt->execute([$userId, $input['name'], $componentsJson]);
        $existingBuild = $stmt->fetch();
        
        if ($existingBuild) {
            http_response_code(409);
            echo json_encode([
                'error' => 'A build with this name and configuration already exists',
                'build_id' => $existingBuild['id']
            ]);
            return;
        }
        
        // Insert build into database
        $stmt = $pdo->prepare("
            INSERT INTO user_builds (user_id, name, description, components, compatibility_score, total_price, is_public, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        
        // Allow users to set public flag, but it will be reviewed by admins
        $isPublic = isset($input['is_public']) ? (int)$input['is_public'] : 0;
        
        $stmt->execute([
            $userId,
            $input['name'],
            $input['description'] ?? '',
            $componentsJson,
            $input['compatibility'] ?? 0,
            $input['totalPrice'] ?? 0,
            $isPublic
        ]);
        
        $buildId = $pdo->lastInsertId();
        
        echo json_encode([
            'success' => true,
            'message' => 'Build saved successfully',
            'build_id' => $buildId
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save build: ' . $e->getMessage()]);
    }
}

function handleGetBuilds($pdo) {
    // Get user ID from JWT token
    $userId = getUserIdFromToken();
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("
            SELECT id, name, description, components, compatibility_score, total_price, is_public, created_at, updated_at
            FROM user_builds 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        ");
        $stmt->execute([$userId]);
        $builds = $stmt->fetchAll();
        
        // Debug: Log how many builds were fetched
        error_log("DEBUG: Fetched " . count($builds) . " builds for user_id: " . $userId);
        
        // Decode components JSON for each build and transform field names
        // Note: We process all builds and only filter out truly invalid ones (null/empty IDs)
        $validBuilds = [];
        foreach ($builds as &$build) {
            // Get the original ID value for debugging
            $originalId = $build['id'] ?? null;
            
            // Debug: Log each build's ID
            error_log("DEBUG: Processing build - ID: " . var_export($originalId, true) . " (type: " . gettype($originalId) . ")");
            
            // Only skip if ID is completely missing or empty (not just 0, as 0 might be valid in edge cases)
            // But for AUTO_INCREMENT primary keys, IDs should always be > 0, so we'll be lenient
            if ($originalId === null || $originalId === '' || $originalId === false) {
                error_log("Warning: Skipping build with missing ID. Original: " . var_export($originalId, true));
                continue;
            }
            
            // Convert ID to integer (PDO might return as string)
            $buildId = is_numeric($originalId) ? (int)$originalId : filter_var($originalId, FILTER_VALIDATE_INT);
            
            // Debug: Log the conversion result
            error_log("DEBUG: ID conversion - Original: " . var_export($originalId, true) . " -> Converted: " . var_export($buildId, true));
            
            // Only skip if conversion completely failed (false or null)
            // NOTE: We're allowing 0 and negative IDs temporarily to see builds
            // If IDs are 0, there's a database issue, but we'll show them anyway
            if ($buildId === false || $buildId === null) {
                error_log("Warning: Skipping build - ID conversion failed. Original: " . var_export($originalId, true) . ", Converted: " . var_export($buildId, true));
                continue;
            }
            
            // Warn if ID is 0 or negative (shouldn't happen with AUTO_INCREMENT)
            if ($buildId <= 0) {
                error_log("WARNING: Build has invalid ID (0 or negative): " . var_export($originalId, true) . " -> " . var_export($buildId, true) . " - But allowing it through for now");
            }
            
            // Create a new array to avoid reference issues
            $processedBuild = [];
            $processedBuild['id'] = (int)$buildId; // Explicitly set ID first
            $processedBuild['components'] = json_decode($build['components'], true);
            $processedBuild['name'] = $build['name'] ?? '';
            $processedBuild['description'] = $build['description'] ?? '';
            // Transform field names to match frontend expectations
            $processedBuild['compatibility'] = $build['compatibility_score'] ?? 0;
            $processedBuild['totalPrice'] = $build['total_price'] ?? 0;
            $processedBuild['isPublic'] = (int)($build['is_public'] ?? 0);
            $processedBuild['createdAt'] = $build['created_at'] ?? '';
            $processedBuild['updatedAt'] = $build['updated_at'] ?? '';
            
            // Debug: Log the processed build ID before adding
            error_log("DEBUG: Processed build ID: " . $processedBuild['id'] . " for build: " . ($processedBuild['name'] ?? 'unnamed'));
            
            // Add to valid builds array
            $validBuilds[] = $processedBuild;
        }
        
        // Debug: Log how many valid builds after filtering
        error_log("DEBUG: Returning " . count($validBuilds) . " valid builds out of " . count($builds) . " total");
        
        // Debug: Log the IDs that will be sent
        foreach ($validBuilds as $idx => $vb) {
            error_log("DEBUG: Valid build $idx ID: " . ($vb['id'] ?? 'MISSING') . " (type: " . gettype($vb['id'] ?? null) . ")");
        }
        
        $response = [
            'success' => true,
            'data' => $validBuilds,
            'debug' => [
                'total_fetched' => count($builds),
                'valid_count' => count($validBuilds),
                'user_id' => $userId
            ]
        ];
        
        // Debug: Log a sample of the JSON that will be sent (first build's ID)
        if (count($validBuilds) > 0) {
            error_log("DEBUG: Sample build ID in response: " . ($validBuilds[0]['id'] ?? 'MISSING'));
        }
        
        echo json_encode($response);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch builds: ' . $e->getMessage()]);
    }
}

function handleGetPublicBuilds($pdo) {
    try {
        // Get public builds with user information
        $stmt = $pdo->prepare("
            SELECT 
                ub.id, 
                ub.name, 
                ub.description, 
                ub.components, 
                ub.compatibility_score, 
                ub.total_price, 
                ub.created_at, 
                ub.updated_at,
                u.first_name,
                u.last_name
            FROM user_builds ub
            JOIN users u ON ub.user_id = u.id
            WHERE ub.is_public = 1 
            ORDER BY ub.created_at DESC
        ");
        $stmt->execute();
        $builds = $stmt->fetchAll();
        
        // Decode components JSON for each build and transform field names
        foreach ($builds as &$build) {
            $build['components'] = json_decode($build['components'], true);
            // Ensure ID is an integer
            $build['id'] = (int)$build['id'];
            $build['creator_name'] = $build['first_name'] . ' ' . $build['last_name'];
            // Transform field names to match frontend expectations
            $build['compatibility'] = $build['compatibility_score'];
            $build['totalPrice'] = $build['total_price'];
            $build['createdAt'] = $build['created_at'];
            $build['updatedAt'] = $build['updated_at'];
        }
        
        echo json_encode([
            'success' => true,
            'data' => $builds
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch public builds: ' . $e->getMessage()]);
    }
}

function handleTogglePublicBuild($pdo) {
    // Get build ID from URL parameter
    $buildId = $_GET['id'] ?? null;
    if (!$buildId) {
        http_response_code(400);
        echo json_encode(['error' => 'Build ID is required']);
        return;
    }
    
    // Get user ID from JWT token
    $userId = getUserIdFromToken();
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        // Verify the build belongs to the user
        $stmt = $pdo->prepare("SELECT id, is_public FROM user_builds WHERE id = ? AND user_id = ?");
        $stmt->execute([$buildId, $userId]);
        $build = $stmt->fetch();
        
        if (!$build) {
            http_response_code(404);
            echo json_encode(['error' => 'Build not found']);
            return;
        }
        
        // New rule: Users can only make builds private. To share publicly, submit for admin approval.
        if ((int)$build['is_public'] === 1) {
            $stmt = $pdo->prepare("UPDATE user_builds SET is_public = 0, updated_at = NOW() WHERE id = ? AND user_id = ?");
            $stmt->execute([$buildId, $userId]);
            echo json_encode(['success' => true, 'message' => 'Build made private successfully', 'is_public' => 0]);
        } else {
            echo json_encode(['success' => false, 'error' => 'To make this build public, submit it to Community for admin approval.']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update build visibility: ' . $e->getMessage()]);
    }
}

function handleUpdateBuild($pdo) {
    // Get build ID from URL parameter
    $buildId = $_GET['id'] ?? null;
    if (!$buildId) {
        http_response_code(400);
        echo json_encode(['error' => 'Build ID is required']);
        return;
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON input']);
        return;
    }
    
    // Get user ID from JWT token
    $userId = getUserIdFromToken();
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        // Verify the build belongs to the user
        $stmt = $pdo->prepare("SELECT id FROM user_builds WHERE id = ? AND user_id = ?");
        $stmt->execute([$buildId, $userId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Build not found']);
            return;
        }
        
        // Update the build
        $stmt = $pdo->prepare("
            UPDATE user_builds 
            SET name = ?, description = ?, components = ?, compatibility_score = ?, total_price = ?, is_public = ?, updated_at = NOW()
            WHERE id = ? AND user_id = ?
        ");
        
        $componentsJson = json_encode($input['components']);
        $isPublic = isset($input['is_public']) ? ($input['is_public'] ? 1 : 0) : 0;
        
        $stmt->execute([
            $input['name'],
            $input['description'] ?? '',
            $componentsJson,
            $input['compatibility'] ?? 0,
            $input['totalPrice'] ?? 0,
            $isPublic,
            $buildId,
            $userId
        ]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Build updated successfully',
            'build_id' => (int)$buildId
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update build: ' . $e->getMessage()]);
    }
}

function handleDeleteBuild($pdo) {
    // Get build ID from URL parameter - check both GET and parsed query string
    $buildId = $_GET['id'] ?? null;
    
    // If not found in $_GET, try parsing REQUEST_URI
    if (!$buildId) {
        $requestUri = $_SERVER['REQUEST_URI'] ?? '';
        $parsedUri = parse_url($requestUri);
        if (isset($parsedUri['query'])) {
            parse_str($parsedUri['query'], $queryParams);
            $buildId = $queryParams['id'] ?? null;
        }
    }
    
    if (!$buildId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Build ID is required']);
        return;
    }
    
    // Validate build ID is numeric and positive
    $buildId = filter_var($buildId, FILTER_VALIDATE_INT);
    if ($buildId === false || $buildId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid build ID']);
        return;
    }
    
    // Get user ID from JWT token
    $userId = getUserIdFromToken();
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        return;
    }
    
    try {
        // First, verify the build exists and belongs to the user (unless admin)
        $checkStmt = $pdo->prepare("SELECT id, user_id FROM user_builds WHERE id = ?");
        $checkStmt->execute([$buildId]);
        $build = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$build) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Build not found']);
            return;
        }
        
        // Check if user is admin or super admin
        $stmt = $pdo->prepare("
            SELECT r.name 
            FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = ? AND r.name IN ('Admin', 'Super Admin')
        ");
        $stmt->execute([$userId]);
        $isAdmin = $stmt->fetch();
        
        // Check permission: admin can delete any, regular users can only delete their own
        if (!$isAdmin && (int)$build['user_id'] !== (int)$userId) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'You do not have permission to delete this build']);
            return;
        }
        
        // Delete related community submissions first (if foreign key cascade doesn't exist)
        try {
            $deleteSubmissions = $pdo->prepare("DELETE FROM community_submissions WHERE build_id = ?");
            $deleteSubmissions->execute([$buildId]);
        } catch (Exception $e) {
            // If table doesn't exist or has issues, continue with build deletion
            error_log("Warning: Could not delete community submissions: " . $e->getMessage());
        }
        
        // Delete the build
        $stmt = $pdo->prepare("DELETE FROM user_builds WHERE id = ?");
        $result = $stmt->execute([$buildId]);
        
        if (!$result) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to delete build']);
            return;
        }
        
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Build not found or already deleted']);
            return;
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Build deleted successfully'
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Delete build error: " . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Delete build error: " . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'Failed to delete build: ' . $e->getMessage()]);
    }
}

function handlePing() {
    echo json_encode([
        'success' => true,
        'message' => 'Builds API is working',
        'timestamp' => time()
    ]);
}

function handleTestAuth($pdo) {
    $userId = getUserIdFromToken();
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication failed', 'debug' => 'No valid token found']);
        return;
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Authentication successful',
        'user_id' => $userId
    ]);
}

// Function to get user ID from token (using auth.php functions)
function getUserIdFromToken() {
    $token = getBearerToken();
    if (!$token) {
        return null;
    }
    try {
        $decoded = verifyJWT($token);
        if (!$decoded) {
            return null;
        }
        return $decoded['user_id'] ?? null;
    } catch (Exception $e) {
        return null;
    }
}