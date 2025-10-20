<?php
// Simple feedback endpoint: stores feedback to logs/feedback.log as JSON lines
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
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

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) {
  echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
  exit;
}

$entry = [
  'timestamp' => date('c'),
  'rating' => intval($data['rating'] ?? 0),
  'category' => $data['category'] ?? '',
  'message' => strtoupper(trim($data['message'] ?? '')),
  'user' => $data['user'] ?? null,
  'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
  'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
];

$logDir = __DIR__ . '/../logs';
if (!is_dir($logDir)) {
  @mkdir($logDir, 0775, true);
}

$logFile = $logDir . '/feedback.log';
$line = json_encode($entry, JSON_UNESCAPED_UNICODE) . PHP_EOL;
@file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);

echo json_encode(['success' => true]);
?>


