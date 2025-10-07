<?php
// JWT Helper for SIMS Authentication
// Note: In production, use a proper JWT library like firebase/php-jwt

// Load environment helper (safe if included multiple times)
require_once __DIR__ . '/../config/env.php';

// JWT configuration with environment overrides
define('JWT_SECRET', env('JWT_SECRET', 'builditpc_secret_key_2024_change_in_production'));
define('JWT_ALGORITHM', 'HS256');
define('JWT_EXPIRY', (int) env('JWT_EXPIRY', '3600')); // default 1 hour

// Generate JWT Token
function generateJWT($userId, $username, $roles) {
    $header = json_encode([
        'typ' => 'JWT',
        'alg' => JWT_ALGORITHM
    ]);
    
    $payload = json_encode([
        'user_id' => $userId,
        'username' => $username,
        'roles' => $roles,
        'iat' => time(),
        'exp' => time() + JWT_EXPIRY
    ]);
    
    $base64Header = base64url_encode($header);
    $base64Payload = base64url_encode($payload);
    
    $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, JWT_SECRET, true);
    $base64Signature = base64url_encode($signature);
    
    return $base64Header . "." . $base64Payload . "." . $base64Signature;
}

// Verify JWT Token
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

// Base64URL encoding
function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

// Base64URL decoding
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

// Check if user has specific role
function hasRole($userRoles, $requiredRole) {
    if (is_string($userRoles)) {
        $userRoles = explode(',', $userRoles);
    }
    return in_array($requiredRole, $userRoles);
}

// Check if user has any of the required roles
function hasAnyRole($userRoles, $requiredRoles) {
    if (is_string($userRoles)) {
        $userRoles = explode(',', $userRoles);
    }
    if (is_string($requiredRoles)) {
        $requiredRoles = [$requiredRoles];
    }
    return !empty(array_intersect($userRoles, $requiredRoles));
}

// Check if user has all required roles
function hasAllRoles($userRoles, $requiredRoles) {
    if (is_string($userRoles)) {
        $userRoles = explode(',', $userRoles);
    }
    if (is_string($requiredRoles)) {
        $requiredRoles = [$requiredRoles];
    }
    return empty(array_diff($requiredRoles, $userRoles));
}

// Get user permissions based on roles
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

// Check if user has specific permission
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
?> 