<?php
header('Content-Type: application/json');
// CORS handled by main router - remove wildcard for security
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'error' => 'Method not allowed']);
  exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);
if (!$data || !isset($data['build_id']) || !isset($data['compatibility'])) {
  echo json_encode(['success' => false, 'error' => 'Missing params']);
  exit;
}

$dir = __DIR__ . '/../../logs';
if (!is_dir($dir)) @mkdir($dir, 0775, true);
$line = json_encode([
  'timestamp' => date('c'),
  'build_id' => $data['build_id'],
  'compatibility' => (int)$data['compatibility'],
]) . PHP_EOL;
@file_put_contents($dir . '/community_compatibility_updates.log', $line, FILE_APPEND | LOCK_EX);

echo json_encode(['success' => true]);
?>


