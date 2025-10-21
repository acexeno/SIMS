<?php
header('Content-Type: application/json');
// CORS handled by main router - remove wildcard for security
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../backend/config/cors.php';
require_once __DIR__ . '/../backend/config/database.php';
require_once __DIR__ . '/../backend/utils/jwt_helper.php';
require_once __DIR__ . '/../backend/api/auth.php';

$pdo = get_db_connection();

// Verify JWT token
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
$roles = $decoded['roles'] ?? [];
if (is_string($roles)) $roles = explode(',', $roles);
$hasAdminAccess = false;
foreach ($roles as $role) {
    if (in_array(trim($role), ['Admin', 'Super Admin', 'Employee'])) {
        $hasAdminAccess = true;
        break;
    }
}
if (!$hasAdminAccess) {
    echo json_encode(['success' => false, 'error' => 'Access denied. Admin privileges required.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET') {
    if ($action === 'submissions') {
        // Get all community submissions
        $status_filter = $_GET['status'] ?? '';
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = 20;
        $offset = ($page - 1) * $limit;
        
        $where_clause = "1=1";
        $params = [];
        
        if ($status_filter) {
            $where_clause .= " AND cs.status = ?";
            $params[] = $status_filter;
        }
        
        $stmt = $pdo->prepare("
            SELECT 
                cs.*,
                u.username as submitter_name,
                u.email as submitter_email,
                b.components,
                reviewer.username as reviewer_name
            FROM community_submissions cs
            LEFT JOIN users u ON cs.user_id = u.id
            LEFT JOIN user_builds b ON cs.build_id = b.id
            LEFT JOIN users reviewer ON cs.reviewed_by = reviewer.id
            WHERE $where_clause
            ORDER BY cs.submitted_at DESC
            LIMIT ? OFFSET ?
        ");
        
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $submissions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get total count
        $count_stmt = $pdo->prepare("
            SELECT COUNT(*) as total FROM community_submissions cs WHERE $where_clause
        ");
        $count_params = array_slice($params, 0, -2);
        $count_stmt->execute($count_params);
        $total = $count_stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        echo json_encode([
            'success' => true,
            'data' => $submissions,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => ceil($total / $limit)
            ]
        ]);
        
    } elseif ($action === 'stats') {
        // Get submission statistics
        $stmt = $pdo->prepare("
            SELECT 
                status,
                COUNT(*) as count
            FROM community_submissions 
            GROUP BY status
        ");
        $stmt->execute();
        $stats = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $stats
        ]);
        
    } else {
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
    
} elseif ($method === 'POST') {
    if ($action === 'review') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
            exit;
        }
        
        $submission_id = $input['submission_id'] ?? null;
        $status = $input['status'] ?? ''; // 'approved' or 'rejected'
        $admin_notes = $input['admin_notes'] ?? '';
        
        if (!$submission_id || !in_array($status, ['approved', 'rejected'])) {
            echo json_encode(['success' => false, 'error' => 'Invalid submission ID or status']);
            exit;
        }
        
        try {
            $pdo->beginTransaction();
            
            // Update submission status
            $stmt = $pdo->prepare("
                UPDATE community_submissions 
                SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$status, $admin_notes, $user_id, $submission_id]);
            
            // Get submission details
            $stmt = $pdo->prepare("
                SELECT cs.*, u.username as submitter_name, u.id as submitter_id
                FROM community_submissions cs
                LEFT JOIN users u ON cs.user_id = u.id
                WHERE cs.id = ?
            ");
            $stmt->execute([$submission_id]);
            $submission = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$submission) {
                throw new Exception('Submission not found');
            }
            
            if ($status === 'approved') {
                // Make the build public
                $stmt = $pdo->prepare("UPDATE user_builds SET is_public = 1 WHERE id = ?");
                $stmt->execute([$submission['build_id']]);
                
                // Create notification for the submitter
                $stmt = $pdo->prepare("INSERT INTO notifications (user_id, type, title, message, priority, created_at) VALUES (?, 'build', ?, ?, 'low', NOW())");
                $notification_title = "Community Build Approved";
                $notification_message = "Your build '{$submission['build_name']}' has been approved and is now visible in the Community Builds section!";
                $stmt->execute([$submission['submitter_id'], $notification_title, $notification_message]);
                
            } else {
                // Create notification for the submitter about rejection
                $stmt = $pdo->prepare("INSERT INTO notifications (user_id, type, title, message, priority, created_at) VALUES (?, 'build', ?, ?, 'low', NOW())");
                $notification_title = "Community Build Review";
                $notification_message = "Your build '{$submission['build_name']}' was not approved for the community. Reason: " . ($admin_notes ?: 'No specific reason provided');
                $stmt->execute([$submission['submitter_id'], $notification_title, $notification_message]);
            }
            
            $pdo->commit();
            
            echo json_encode([
                'success' => true,
                'message' => 'Submission ' . $status . ' successfully'
            ]);
            
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
        }
        
    } else {
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
    
} else {
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
?>
