<?php
/**
 * Lightweight JWT utilities for SIMS.
 * Caution: In production, prefer a vetted library such as firebase/php-jwt.
 */

// Load environment helper (safe if included multiple times)
require_once __DIR__ . '/../config/env.php';

// JWT configuration (overridable via environment)
define('JWT_SECRET', env('JWT_SECRET', 'CHANGE_THIS_JWT_SECRET_IN_PRODUCTION_2024_SECURE_KEY_64_CHARS'));
define('JWT_ALGORITHM', 'HS256');
define('JWT_EXPIRY', (int) env('JWT_EXPIRY', '7200')); // default 2 hours (increased from 1 hour for better UX)
// Refresh token configuration
define('REFRESH_JWT_SECRET', env('REFRESH_JWT_SECRET', 'CHANGE_THIS_REFRESH_JWT_SECRET_IN_PRODUCTION_2024_SECURE_KEY_64_CHARS'));
define('REFRESH_JWT_EXPIRY', (int) env('REFRESH_JWT_EXPIRY', '1209600')); // default 14 days

/**
 * Extract access token from request using multiple legacy-compatible locations.
 * Accepts:
 * - Authorization: Bearer <token> OR Authorization: <token>
 * - X-Auth-Token, X-Token, Token headers
 * - Query param: ?token=
 * - JSON or form body field: token
 * - Cookie: token
 * @return string|null JWT token or null if not found
 */
function getBearerToken() {
    // Primary: headers via getallheaders()
    $headers = function_exists('getallheaders') ? getallheaders() : [];

    // Normalize header keys to case-insensitive lookup
    $norm = [];
    foreach ($headers as $k => $v) {
        $norm[strtolower($k)] = $v;
    }

    // 1) Authorization header: Bearer <token> OR raw token
    $authHeader = $norm['authorization'] ?? null;
    if ($authHeader) {
        // Bearer pattern
        if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $m)) {
            return trim($m[1]);
        }
        // Fallback: header contains only the token without Bearer
        $trimmed = trim($authHeader);
        if ($trimmed !== '') {
            return $trimmed;
        }
    }

    // 2) Alternate token headers
    $altHeaders = [
        'x-auth-token',
        'x-token',
        'token'
    ];
    foreach ($altHeaders as $hk) {
        if (!empty($norm[$hk])) {
            return trim($norm[$hk]);
        }
    }

    // 3) Fallback to $_SERVER-provided headers if getallheaders() missing
    if (empty($headers)) {
        $serverAuth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['HTTP_AUTH'] ?? null;
        if ($serverAuth) {
            if (preg_match('/Bearer\s+(\S+)/i', $serverAuth, $m)) {
                return trim($m[1]);
            }
            $trimmed = trim($serverAuth);
            if ($trimmed !== '') {
                return $trimmed;
            }
        }
        $serverAlt = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? $_SERVER['HTTP_X_TOKEN'] ?? $_SERVER['HTTP_TOKEN'] ?? null;
        if ($serverAlt) {
            return trim($serverAlt);
        }
    }

    // 4) Query parameter
    if (isset($_GET['token']) && $_GET['token'] !== '') {
        return trim((string)$_GET['token']);
    }

    // 5) JSON body or form-encoded body
    // Read raw input safely (small bodies)
    $raw = file_get_contents('php://input');
    if (is_string($raw) && $raw !== '') {
        // Try JSON
        $json = json_decode($raw, true);
        if (is_array($json) && isset($json['token']) && $json['token'] !== '') {
            return trim((string)$json['token']);
        }
        // Try form-encoded
        $tmp = [];
        parse_str($raw, $tmp);
        if (is_array($tmp) && isset($tmp['token']) && $tmp['token'] !== '') {
            return trim((string)$tmp['token']);
        }
    }
    // Also check superglobal POST if populated
    if (isset($_POST['token']) && $_POST['token'] !== '') {
        return trim((string)$_POST['token']);
    }

    // 6) Cookie
    if (isset($_COOKIE['token']) && $_COOKIE['token'] !== '') {
        return trim((string)$_COOKIE['token']);
    }

    return null;
}

/**
 * Generate short-lived access token.
 * @param int $userId
 * @param string $username
 * @param array|string $roles
 * @return string JWT string
 */
function generateJWT($userId, $username, $roles) {
    $header = json_encode([
        'typ' => 'JWT',
        'alg' => JWT_ALGORITHM
    ]);
    
    $payload = json_encode([
        'user_id' => $userId,
        'username' => $username,
        'roles' => $roles,
        'type' => 'access',
        'iat' => time(),
        'exp' => time() + JWT_EXPIRY
    ]);
    
    $base64Header = base64url_encode($header);
    $base64Payload = base64url_encode($payload);
    
    $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, JWT_SECRET, true);
    $base64Signature = base64url_encode($signature);
    
    return $base64Header . "." . $base64Payload . "." . $base64Signature;
}

/**
 * Verify access token signature and expiry.
 * @param string $token
 * @return array|false Decoded payload on success, false on failure
 */
function verifyJWT($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return false;
    }
    
    list($header, $payload, $signature) = $parts;
    
    $validSignature = base64url_encode(
        hash_hmac('sha256', $header . "." . $payload, JWT_SECRET, true)
    );
    
    if ($signature !== $validSignature) {
        return false;
    }
    
    $payloadData = json_decode(base64url_decode($payload), true);
    
    if (!$payloadData) {
        return false;
    }
    
    // Check if token is expired
    if (isset($payloadData['exp']) && $payloadData['exp'] < time()) {
        return false;
    }
    
    return $payloadData;
}

/**
 * Generate refresh token (longer-lived, distinct secret).
 */
function generateRefreshJWT($userId, $username, $roles) {
    $header = json_encode([
        'typ' => 'JWT',
        'alg' => JWT_ALGORITHM
    ]);

    $payload = json_encode([
        'user_id' => $userId,
        'username' => $username,
        'roles' => $roles,
        'type' => 'refresh',
        'iat' => time(),
        'exp' => time() + REFRESH_JWT_EXPIRY
    ]);

    $base64Header = base64url_encode($header);
    $base64Payload = base64url_encode($payload);

    $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, REFRESH_JWT_SECRET, true);
    $base64Signature = base64url_encode($signature);

    return $base64Header . "." . $base64Payload . "." . $base64Signature;
}

/**
 * Verify refresh token signature, type, and expiry.
 */
function verifyRefreshJWT($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return false;
    }

    list($header, $payload, $signature) = $parts;

    $validSignature = base64url_encode(
        hash_hmac('sha256', $header . "." . $payload, REFRESH_JWT_SECRET, true)
    );

    if ($signature !== $validSignature) {
        return false;
    }

    $payloadData = json_decode(base64url_decode($payload), true);

    if (!$payloadData) {
        return false;
    }

    // Ensure it's a refresh token and not expired
    if (!isset($payloadData['type']) || $payloadData['type'] !== 'refresh') {
        return false;
    }
    if (isset($payloadData['exp']) && $payloadData['exp'] < time()) {
        return false;
    }

    return $payloadData;
}

// Base64URL encoding/decoding helpers
function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    // Convert URL-safe alphabet back to standard Base64
    $b64 = strtr($data, '-_', '+/');
    // Properly pad the string length to a multiple of 4
    $remainder = strlen($b64) % 4;
    if ($remainder) {
        $b64 .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode($b64);
}

/** Role helpers: normalize lists and check memberships */
function hasRole($userRoles, $requiredRole) {
    if (is_string($userRoles)) {
        $userRoles = explode(',', $userRoles);
    }
    return in_array($requiredRole, $userRoles);
}

function hasAnyRole($userRoles, $requiredRoles) {
    if (is_string($userRoles)) {
        $userRoles = explode(',', $userRoles);
    }
    if (is_string($requiredRoles)) {
        $requiredRoles = [$requiredRoles];
    }
    return !empty(array_intersect($userRoles, $requiredRoles));
}

function hasAllRoles($userRoles, $requiredRoles) {
    if (is_string($userRoles)) {
        $userRoles = explode(',', $userRoles);
    }
    if (is_string($requiredRoles)) {
        $requiredRoles = [$requiredRoles];
    }
    return empty(array_diff($requiredRoles, $userRoles));
}

/**
 * Map roles to coarse permissions used by the app.
 */
function getUserPermissions($userRoles) {
    $permissions = [];
    
    if (is_string($userRoles)) {
        $userRoles = explode(',', $userRoles);
    }
    
    foreach ($userRoles as $role) {
        switch ($role) {
            case 'Super Admin':
                $permissions = array_merge($permissions, [
                    'all' => true,
                    'users' => ['create', 'read', 'update', 'delete'],
                    'inventory' => ['create', 'read', 'update', 'delete'],
                    'orders' => ['create', 'read', 'update', 'delete'],
                    'reports' => ['create', 'read', 'update', 'delete'],
                    'settings' => ['create', 'read', 'update', 'delete'],
                    'system' => ['full_access']
                ]);
                break;
                
            case 'Admin':
                $permissions = array_merge($permissions, [
                    'users' => ['read', 'update'],
                    'inventory' => ['create', 'read', 'update', 'delete'],
                    'orders' => ['read', 'update'],
                    'reports' => ['read'],
                    'settings' => ['read', 'update'],
                    'chat' => ['read', 'write']
                ]);
                break;
                
            case 'Employee':
                $permissions = array_merge($permissions, [
                    'inventory' => ['read', 'update'],
                    'orders' => ['read', 'update'],
                    'reports' => ['read'],
                    'chat' => ['read', 'write']
                ]);
                break;
                
            case 'Client':
                $permissions = array_merge($permissions, [
                    'build' => ['create', 'read', 'update', 'delete'],
                    'order' => ['create', 'read'],
                    'chat' => ['read', 'write'],
                    'profile' => ['read', 'update']
                ]);
                break;
        }
    }
    
    return $permissions;
}

/**
 * Check if user has a named permission, optionally with specific action.
 */
function hasPermission($userRoles, $permission, $action = null) {
    $permissions = getUserPermissions($userRoles);
    
    if (isset($permissions['all']) && $permissions['all'] === true) {
        return true;
    }
    
    if (!isset($permissions[$permission])) {
        return false;
    }
    
    if ($action === null) {
        return true;
    }
    
    if (is_array($permissions[$permission])) {
        return in_array($action, $permissions[$permission]);
    }
    
    return $permissions[$permission] === $action;
} 