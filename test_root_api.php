<?php
// Test API from root level
$url = 'http://localhost/capstone2/api/index.php?endpoint=otp_request';
$data = json_encode(['email' => 'test@gmail.com', 'purpose' => 'register']);

$options = [
    'http' => [
        'header' => "Content-Type: application/json\r\n",
        'method' => 'POST',
        'content' => $data
    ]
];

$context = stream_context_create($options);
$result = file_get_contents($url, false, $context);

echo "Root API Response: " . $result . "\n";

if ($result === false) {
    echo "Error: " . error_get_last()['message'] . "\n";
}
?>
