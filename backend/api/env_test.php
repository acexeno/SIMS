<?php
// Environment test endpoint
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

echo json_encode([
    'status' => 'success',
    'message' => 'Environment test',
    'env_file_exists' => file_exists(__DIR__ . '/../../.env'),
    'current_dir' => __DIR__,
    'root_dir' => dirname(dirname(__DIR__)),
    'files_in_root' => array_slice(scandir(dirname(dirname(__DIR__))), 0, 10),
    'timestamp' => date('Y-m-d H:i:s')
]);
?>
