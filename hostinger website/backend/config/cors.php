<?php
// Robust CORS handling for local development and production

// Skip CORS logic entirely when running via CLI (e.g., php script.php)
if (PHP_SAPI === 'cli') {
    return;
}

// Load environment configuration
try {
    require_once __DIR__ . '/env.php';
} catch (Exception $e) {
    // If env.php fails, continue with defaults
    error_log('Warning: Could not load env.php: ' . $e->getMessage());
}

// Provide a polyfill for getallheaders on environments where it is not defined (e.g., FastCGI)
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (strpos($name, 'HTTP_') === 0) {
                $key = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
                $headers[$key] = $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['Content-Type'] = $_SERVER['CONTENT_TYPE'];
        }
        if (isset($_SERVER['CONTENT_LENGTH'])) {
            $headers['Content-Length'] = $_SERVER['CONTENT_LENGTH'];
        }
        return $headers;
    }
}

// Get allowed origins from environment
function getAllowedOrigins() {
    $allowedOrigins = env('CORS_ALLOWED_ORIGINS', '');
    
    if (empty($allowedOrigins)) {
        // Default origins for development and production
        return [
            'http://localhost:3000', 'http://localhost:5173', 'http://localhost:5175', 'http://localhost:8080',
            'http://127.0.0.1:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5175', 'http://127.0.0.1:8080',
            'https://egiesims.shop', 'http://egiesims.shop'
        ];
    }
    
    return array_map('trim', explode(',', $allowedOrigins));
}

// Check if origin is allowed
function isOriginAllowed($origin) {
    $allowedOrigins = getAllowedOrigins();
    return in_array($origin, $allowedOrigins);
}

// Get the origin from the request
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Handle preflight OPTIONS request
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if ($origin && isOriginAllowed($origin)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
    } else {
        // Allow localhost, 127.0.0.1, and production domains
        if (strpos($origin, 'localhost') !== false || strpos($origin, '127.0.0.1') !== false || 
            strpos($origin, 'egiesims.shop') !== false) {
            header("Access-Control-Allow-Origin: $origin");
            header('Access-Control-Allow-Credentials: true');
        } else {
            // For development, allow requests without origin (like from Vite proxy)
            if (empty($origin)) {
                header("Access-Control-Allow-Origin: *");
            } else {
                // Reject unknown origins
                http_response_code(403);
                echo json_encode(['error' => 'CORS: Origin not allowed']);
                exit();
            }
        }
    }
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token');
    header('Access-Control-Max-Age: 86400'); // Cache preflight for 24 hours
    http_response_code(204);
    exit();
}

// For actual requests
if ($origin && isOriginAllowed($origin)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
} else {
    // Allow localhost, 127.0.0.1, and production domains
    if (strpos($origin, 'localhost') !== false || strpos($origin, '127.0.0.1') !== false || 
        strpos($origin, 'egiesims.shop') !== false) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
    } else {
        // For development, allow requests without origin (like from Vite proxy)
        if (empty($origin)) {
            header("Access-Control-Allow-Origin: *");
        } else {
            // Reject unknown origins
            http_response_code(403);
            echo json_encode(['error' => 'CORS: Origin not allowed']);
            exit();
        }
    }
}

// Note: Content-Type header is set in index.php after CORS headers
// This ensures JSON responses work correctly