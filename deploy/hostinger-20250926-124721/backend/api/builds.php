<?php
// Builds API for SIMS

// Include CORS and database configuration
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/jwt_helper.php';
require_once __DIR__ . '/auth.php'; // Include auth functions for getBearerToken

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
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
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
        // Insert build into database
        $stmt = $pdo->prepare("
            INSERT INTO user_builds (user_id, name, description, components, compatibility_score, total_price, is_public, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        
        $componentsJson = json_encode($input['components']);
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
        
        // Decode components JSON for each build and transform field names
        foreach ($builds as &$build) {
            $build['components'] = json_decode($build['components'], true);
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
            'message' => 'Build updated successfully'
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update build: ' . $e->getMessage()]);
    }
}

function handleDeleteBuild($pdo) {
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
        // Delete the build (only if it belongs to the user)
        $stmt = $pdo->prepare("DELETE FROM user_builds WHERE id = ? AND user_id = ?");
        $result = $stmt->execute([$buildId, $userId]);
        
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Build not found']);
            return;
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Build deleted successfully'
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete build: ' . $e->getMessage()]);
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
?> 