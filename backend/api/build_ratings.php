<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/jwt_helper.php';

$pdo = get_db_connection();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET') {
    // Verify JWT token for user-specific operations
    $token = getBearerToken();
    $userId = null;
    
    if ($token) {
        $decoded = verifyJWT($token);
        if ($decoded && isset($decoded['user_id'])) {
            $userId = (int)$decoded['user_id'];
        }
    }
    
    if ($action === 'stats') {
        // Get rating statistics for a build
        $buildId = isset($_GET['build_id']) ? (int)$_GET['build_id'] : 0;
        
        if ($buildId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid build_id']);
            exit;
        }
        
        try {
            // Check if build exists
            $stmt = $pdo->prepare("SELECT id FROM user_builds WHERE id = ?");
            $stmt->execute([$buildId]);
            if (!$stmt->fetch()) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Build not found']);
                exit;
            }
            
            // Get rating statistics using the view if it exists, otherwise calculate directly
            try {
                $stmt = $pdo->prepare("
                    SELECT 
                        build_id,
                        total_ratings,
                        COALESCE(ROUND(average_rating, 2), 0) as average_rating,
                        min_rating,
                        max_rating,
                        five_star_count,
                        four_star_count,
                        three_star_count,
                        two_star_count,
                        one_star_count
                    FROM build_rating_stats 
                    WHERE build_id = ?
                ");
                $stmt->execute([$buildId]);
                $stats = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$stats) {
                    // No ratings yet, return default values
                    $stats = [
                        'build_id' => $buildId,
                        'total_ratings' => 0,
                        'average_rating' => 0,
                        'min_rating' => 0,
                        'max_rating' => 0,
                        'five_star_count' => 0,
                        'four_star_count' => 0,
                        'three_star_count' => 0,
                        'two_star_count' => 0,
                        'one_star_count' => 0
                    ];
                }
            } catch (Exception $e) {
                // View doesn't exist, calculate directly
                $stmt = $pdo->prepare("
                    SELECT 
                        COUNT(*) as total_ratings,
                        COALESCE(ROUND(AVG(rating), 2), 0) as average_rating,
                        COALESCE(MIN(rating), 0) as min_rating,
                        COALESCE(MAX(rating), 0) as max_rating,
                        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star_count,
                        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star_count,
                        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star_count,
                        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star_count,
                        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star_count
                    FROM build_ratings
                    WHERE build_id = ?
                ");
                $stmt->execute([$buildId]);
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                
                $stats = [
                    'build_id' => $buildId,
                    'total_ratings' => (int)($result['total_ratings'] ?? 0),
                    'average_rating' => (float)($result['average_rating'] ?? 0),
                    'min_rating' => (int)($result['min_rating'] ?? 0),
                    'max_rating' => (int)($result['max_rating'] ?? 0),
                    'five_star_count' => (int)($result['five_star_count'] ?? 0),
                    'four_star_count' => (int)($result['four_star_count'] ?? 0),
                    'three_star_count' => (int)($result['three_star_count'] ?? 0),
                    'two_star_count' => (int)($result['two_star_count'] ?? 0),
                    'one_star_count' => (int)($result['one_star_count'] ?? 0)
                ];
            }
            
            echo json_encode([
                'success' => true,
                'data' => $stats
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
        }
        
    } elseif ($action === 'user_rating') {
        // Get user's rating for a specific build
        $buildId = isset($_GET['build_id']) ? (int)$_GET['build_id'] : 0;
        
        if ($buildId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid build_id']);
            exit;
        }
        
        if (!$userId) {
            // User not logged in, return null rating
            echo json_encode([
                'success' => true,
                'data' => null
            ]);
            exit;
        }
        
        try {
            $stmt = $pdo->prepare("
                SELECT 
                    id,
                    build_id,
                    user_id,
                    rating,
                    review_text,
                    created_at,
                    updated_at
                FROM build_ratings
                WHERE build_id = ? AND user_id = ?
            ");
            $stmt->execute([$buildId, $userId]);
            $rating = $stmt->fetch(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $rating ?: null
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
        }
        
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
    
} elseif ($method === 'POST') {
    if ($action === 'submit') {
        // Submit or update a rating
        $token = getBearerToken();
        if (!$token) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Authentication required']);
            exit;
        }
        
        $decoded = verifyJWT($token);
        if (!$decoded || !isset($decoded['user_id'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Invalid token']);
            exit;
        }
        
        $userId = (int)$decoded['user_id'];
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
            exit;
        }
        
        $buildId = isset($input['build_id']) ? (int)$input['build_id'] : 0;
        $rating = isset($input['rating']) ? (int)$input['rating'] : 0;
        $reviewText = isset($input['review_text']) ? trim($input['review_text']) : '';
        
        if ($buildId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid build_id']);
            exit;
        }
        
        if ($rating < 1 || $rating > 5) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Rating must be between 1 and 5']);
            exit;
        }
        
        try {
            // Verify build exists
            $stmt = $pdo->prepare("SELECT id FROM user_builds WHERE id = ?");
            $stmt->execute([$buildId]);
            if (!$stmt->fetch()) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Build not found']);
                exit;
            }
            
            // Check if user has already rated this build
            $stmt = $pdo->prepare("
                SELECT id FROM build_ratings 
                WHERE build_id = ? AND user_id = ?
            ");
            $stmt->execute([$buildId, $userId]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($existing) {
                // Update existing rating
                $stmt = $pdo->prepare("
                    UPDATE build_ratings 
                    SET rating = ?, review_text = ?, updated_at = NOW()
                    WHERE build_id = ? AND user_id = ?
                ");
                $stmt->execute([$rating, $reviewText, $buildId, $userId]);
                $message = 'Rating updated successfully';
            } else {
                // Insert new rating
                $stmt = $pdo->prepare("
                    INSERT INTO build_ratings (build_id, user_id, rating, review_text, created_at, updated_at)
                    VALUES (?, ?, ?, ?, NOW(), NOW())
                ");
                $stmt->execute([$buildId, $userId, $rating, $reviewText]);
                $message = 'Rating submitted successfully';
            }
            
            echo json_encode([
                'success' => true,
                'message' => $message
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
        }
        
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
    
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
?>

