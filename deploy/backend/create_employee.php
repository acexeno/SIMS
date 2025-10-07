<?php
// backend/create_employee.php
require_once __DIR__ . '/config/database.php';

$pdo = get_db_connection();

// Employee credentials
$username = 'employee1';
$email = 'employee1@builditpc.com';
$password = 'EmployeePass123';
$first_name = 'Employee';
$last_name = 'One';
$role_name = 'Employee';

// Hash the password using bcrypt
$hashedPassword = password_hash($password, PASSWORD_BCRYPT);

try {
    // 1. Ensure the Employee role exists
    $stmt = $pdo->prepare('INSERT IGNORE INTO roles (name) VALUES (:role_name)');
    $stmt->execute(['role_name' => $role_name]);

    // 2. Get the Employee role ID
    $stmt = $pdo->prepare('SELECT id FROM roles WHERE name = :role_name');
    $stmt->execute(['role_name' => $role_name]);
    $role = $stmt->fetch();
    if (!$role) {
        throw new Exception('Employee role could not be found or created.');
    }
    $role_id = $role['id'];

    // 3. Check if a user with this username or email already exists
    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = :username OR email = :email LIMIT 1');
    $stmt->execute(['username' => $username, 'email' => $email]);
    if ($stmt->fetch()) {
        echo "A user with this username or email already exists. Aborting.";
        exit;
    }

    // 4. Insert the employee user
    $stmt = $pdo->prepare('INSERT INTO users (username, email, password_hash, first_name, last_name, is_active, created_at) VALUES (:username, :email, :password_hash, :first_name, :last_name, 1, NOW())');
    $stmt->execute([
        'username' => $username,
        'email' => $email,
        'password_hash' => $hashedPassword,
        'first_name' => $first_name,
        'last_name' => $last_name
    ]);
    $user_id = $pdo->lastInsertId();

    // 5. Link the user to the Employee role
    $stmt = $pdo->prepare('INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)');
    $stmt->execute([
        'user_id' => $user_id,
        'role_id' => $role_id
    ]);

    echo "Employee account created successfully!\nUsername: $username\nPassword: $password\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
} 