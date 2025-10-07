<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/jwt_helper.php';
require_once __DIR__ . '/auth.php';

$pdo = get_db_connection();

// Get and verify JWT token
$token = getBearerToken();
if (!$token) {
    echo json_encode(['success' => false, 'error' => 'No token provided']);
    exit;
}

$decoded = verifyJWT($token);
if (!$decoded || !isset($decoded['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Invalid token']);
    exit;
}

$user_id = (int)$decoded['user_id'];
$username = $decoded['username'] ?? 'Unknown User';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Return the current user's submissions and statuses
    try {
        $stmt = $pdo->prepare("SELECT id, build_id, status, admin_notes, submitted_at, reviewed_at FROM community_submissions WHERE user_id = ? ORDER BY submitted_at DESC");
        $stmt->execute([$user_id]);
        $submissions = $stmt->fetchAll();
        echo json_encode(['success' => true, 'data' => $submissions]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to fetch submissions']);
    }
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
        exit;
    }

    $build_id = isset($input['build_id']) ? (int)$input['build_id'] : null;
    $build_name = trim($input['build_name'] ?? '');
    $build_description = trim($input['build_description'] ?? '');
    $total_price = (float)($input['total_price'] ?? 0);
    $compatibility = (int)($input['compatibility'] ?? 0);

    if (!$build_id) {
        echo json_encode(['success' => false, 'error' => 'Build ID is required']);
        exit;
    }

    try {
        // Verify the build belongs to the user
        $stmt = $pdo->prepare("SELECT id FROM user_builds WHERE id = ? AND user_id = ?");
        $stmt->execute([$build_id, $user_id]);
        $build = $stmt->fetch();
        if (!$build) {
            echo json_encode(['success' => false, 'error' => 'Build not found or access denied']);
            exit;
        }

        // Check if a pending or approved submission exists
        $stmt = $pdo->prepare("SELECT id, status FROM community_submissions WHERE build_id = ? AND status IN ('pending','approved')");
        $stmt->execute([$build_id]);
        $existing = $stmt->fetch();
        if ($existing) {
            echo json_encode(['success' => false, 'error' => 'This build has already been submitted for review']);
            exit;
        }

        // Create community submission
        $stmt = $pdo->prepare("INSERT INTO community_submissions (build_id, user_id, build_name, build_description, total_price, compatibility, status, submitted_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())");
        $stmt->execute([$build_id, $user_id, $build_name, $build_description, $total_price, $compatibility]);
        $submission_id = (int)$pdo->lastInsertId();

        // Notify Admins/Employees/Super Admins
        // Get all admin-like users via roles tables
        $adminStmt = $pdo->query("SELECT u.id FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE r.name IN ('Admin','Employee','Super Admin')");
        $admins = $adminStmt->fetchAll();
        if ($admins) {
            $notification_title = 'New Community Build Submission';
            $notification_message = "User {$username} has submitted a build '{$build_name}' for community review.";
            $ins = $pdo->prepare("INSERT INTO notifications (user_id, type, title, message, priority, created_at) VALUES (?, 'build', ?, ?, 'low', NOW())");
            foreach ($admins as $admin) {
                $ins->execute([(int)$admin['id'], $notification_title, $notification_message]);
            }
        }

        echo json_encode(['success' => true, 'message' => 'Build submitted for community review successfully', 'submission_id' => $submission_id]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'error' => 'Method not allowed']);
?>
