<?php
// Force correct MIME type for JS files
if (preg_match('/\.js$/', $_SERVER['REQUEST_URI'])) {
    header('Content-Type: application/javascript');
}
// If the request is for the API, route to the API index
if (preg_match('/^\/api\//', $_SERVER['REQUEST_URI'])) {
    include __DIR__ . '/api/index.php';
    exit;
}

// Otherwise, serve the React app (static files)
$publicPath = __DIR__ . '/public' . $_SERVER['REQUEST_URI'];
if (file_exists($publicPath) && !is_dir($publicPath)) {
    return false; // Let PHP's built-in server serve the static file
} else {
    // Serve index.html for React Router
    include __DIR__ . '/public/index.html';
} 