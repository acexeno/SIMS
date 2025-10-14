<?php
// backend/create_super_admin.php
require_once __DIR__ . '/config/database.php';

// Super admin credentials
$username = 'SuperAdminAccount';
$email = 'builditPC@gmail.com';
$password = 'BuildITPASS';
$first_name = 'Super';
$last_name = 'Admin';
$role_name = 'Super Admin';

// Hash the password using bcrypt
$hashedPassword = password_hash($password, PASSWORD_BCRYPT);

try {
    // 1. Ensure the SuperAdmin role exists
    $stmt = $pdo->prepare('INSERT IGNORE INTO roles (name) VALUES (:role_name)');
    $stmt->execute(['role_name' => $role_name]);

    // 2. Get the SuperAdmin role ID
    $stmt = $pdo->prepare('SELECT id FROM roles WHERE name = :role_name');
    $stmt->execute(['role_name' => $role_name]);
    $role = $stmt->fetch();
    if (!$role) {
        throw new Exception('SuperAdmin role could not be found or created.');
    }
    $role_id = $role['id'];

    // 3. Check if a user with this username or email already exists
    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = :username OR email = :email LIMIT 1');
    $stmt->execute(['username' => $username, 'email' => $email]);
    if ($stmt->fetch()) {
        echo "A user with this username or email already exists. Aborting.";
        exit;
    }

    // 4. Insert the super admin user
    $stmt = $pdo->prepare('INSERT INTO users (username, email, password_hash, first_name, last_name, is_active, created_at) VALUES (:username, :email, :password_hash, :first_name, :last_name, 1, NOW())');
    $stmt->execute([
        'username' => $username,
        'email' => $email,
        'password_hash' => $hashedPassword,
        'first_name' => $first_name,
        'last_name' => $last_name
    ]);
    $user_id = $pdo->lastInsertId();

    // 5. Link the user to the SuperAdmin role
    $stmt = $pdo->prepare('INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)');
    $stmt->execute([
        'user_id' => $user_id,
        'role_id' => $role_id
    ]);

    echo "Super admin account created successfully!";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
} 