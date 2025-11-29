<?php
header('Content-Type: application/json');
// CORS handled by main router - remove wildcard for security
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Include reCAPTCHA helper if it exists
$recaptchaHelperPath = __DIR__ . '/../utils/recaptcha_helper.php';
if (file_exists($recaptchaHelperPath)) {
    require_once $recaptchaHelperPath;
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Verify reCAPTCHA if token is provided
if (function_exists('validateRecaptcha')) {
    $recaptchaValid = validateRecaptcha($input);
    if (!$recaptchaValid) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'reCAPTCHA verification failed. Please try again.']);
        exit();
    }
}

// Validate required fields
$required_fields = ['name', 'email', 'subject', 'message'];
foreach ($required_fields as $field) {
    if (!isset($input[$field]) || empty(trim($input[$field]))) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Field '$field' is required"]);
        exit();
    }
}

// Sanitize input data
$name = htmlspecialchars(trim($input['name']), ENT_QUOTES, 'UTF-8');
$email = filter_var(trim($input['email']), FILTER_SANITIZE_EMAIL);
$subject = htmlspecialchars(strtoupper(trim($input['subject'])), ENT_QUOTES, 'UTF-8');
$message = htmlspecialchars(strtoupper(trim($input['message'])), ENT_QUOTES, 'UTF-8');
$rating = isset($input['rating']) ? intval($input['rating']) : 0;

// Validate email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid email address']);
    exit();
}

// Database configuration
$host = 'localhost';
$dbname = 'builditpc_db';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Create feedback table if it doesn't exist
    $createTableSQL = "
    CREATE TABLE IF NOT EXISTS feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        rating INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('new', 'in_progress', 'resolved') DEFAULT 'new'
    )";
    
    $pdo->exec($createTableSQL);
    
    // Insert feedback into database
    $insertSQL = "INSERT INTO feedback (name, email, subject, message, rating) VALUES (?, ?, ?, ?, ?)";
    $stmt = $pdo->prepare($insertSQL);
    $result = $stmt->execute([$name, $email, $subject, $message, $rating]);
    
    if ($result) {
        // Send email notification (optional)
        $to = 'admin@builditpc.com'; // Change to your admin email
        $emailSubject = "New Contact Form Submission: " . $subject;
        $emailMessage = "
        New contact form submission received:
        
        Name: $name
        Email: $email
        Subject: $subject
        Rating: $rating/5
        
        Message:
        $message
        
        Submitted at: " . date('Y-m-d H:i:s');
        
        $headers = "From: noreply@builditpc.com\r\n";
        $headers .= "Reply-To: $email\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
        
        // Uncomment the line below to enable email notifications
        // mail($to, $emailSubject, $emailMessage, $headers);
        
        echo json_encode([
            'success' => true, 
            'message' => 'Thank you for your feedback! We will get back to you soon.',
            'data' => [
                'id' => $pdo->lastInsertId(),
                'name' => $name,
                'email' => $email,
                'subject' => $subject
            ]
        ]);
    } else {
        throw new Exception('Failed to insert feedback');
    }
    
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error occurred']);
} catch (Exception $e) {
    error_log("General error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'An error occurred while processing your request']);
}
?>
