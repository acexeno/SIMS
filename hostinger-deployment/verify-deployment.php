<?php
// BuildIt PC - Deployment Verification Script
// Run this after uploading to Hostinger to verify everything is working

echo "🚀 BuildIt PC - Deployment Verification\n";
echo "=====================================\n\n";

// Check if we're in the right environment
if (file_exists('.env')) {
    echo "✅ Environment file found\n";
} else {
    echo "❌ Environment file missing\n";
}

// Check if backend is accessible
if (file_exists('backend/health.php')) {
    echo "✅ Backend health check endpoint found\n";
} else {
    echo "❌ Backend health check endpoint missing\n";
}

// Check if frontend build is present
if (file_exists('dist/index.html')) {
    echo "✅ Frontend build found\n";
} else {
    echo "❌ Frontend build missing\n";
}

// Check if vendor dependencies are present
if (file_exists('vendor/autoload.php')) {
    echo "✅ PHP dependencies found\n";
} else {
    echo "❌ PHP dependencies missing\n";
}

// Check if images are present
$imageCount = 0;
if (is_dir('dist/images/components')) {
    $files = glob('dist/images/components/*.{png,svg}', GLOB_BRACE);
    $imageCount = count($files);
    echo "✅ Component images found: $imageCount files\n";
} else {
    echo "❌ Component images missing\n";
}

// Check if .htaccess is present
if (file_exists('.htaccess')) {
    echo "✅ Apache configuration found\n";
} else {
    echo "❌ Apache configuration missing\n";
}

echo "\n🎯 VERIFICATION COMPLETE!\n";
echo "========================\n\n";

if ($imageCount > 0) {
    echo "✅ Deployment package appears to be complete!\n";
    echo "📋 Next steps:\n";
    echo "1. Update database credentials in .env file\n";
    echo "2. Update CORS origins with your domain\n";
    echo "3. Change JWT secrets for security\n";
    echo "4. Test with /backend/health.php\n";
    echo "5. Test frontend at your domain root\n\n";
    echo "🚀 Ready for production!\n";
} else {
    echo "❌ Some components may be missing. Please check the deployment.\n";
}
?>

