// Debug script to help identify image loading issues
// Add this to your browser console to test image loading

console.log('Starting image loading debug...');

// Test a few specific component images
const testImages = [
  '/images/components/cpu/R3 3200G (TRAY) WITH HEATSINK FAN.png',
  '/images/components/gpu/GALAX RTX 3060 1-CLICK OC BLK 12GB.png',
  '/images/components/ram/KINGSTON FURY BEAST DDR4 8GB.png',
  '/images/components/motherboard/ASRock B550M STEEL LEGEND.png',
  '/images/components/storage/Samsung 970 EVO Plus 500GB.png',
  '/images/components/psu/Corsair CX550F.png',
  '/images/components/case/INPLAY WIND 01.png',
  '/images/components/cooler/DEEPCOOL AK400.png'
];

function testImageLoad(imagePath) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      console.log(`${imagePath} - Loaded successfully`);
      resolve({ path: imagePath, status: 'success' });
    };
    img.onerror = () => {
      console.log(`${imagePath} - Failed to load`);
      resolve({ path: imagePath, status: 'error' });
    };
    img.src = imagePath;
  });
}

async function testAllImages() {
  console.log('🧪 Testing all component images...');
  const results = await Promise.all(testImages.map(testImageLoad));
  
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'error');
  
  console.log(`Results: ${successful.length} successful, ${failed.length} failed`);
  
  if (failed.length > 0) {
    console.log('Failed images:', failed.map(f => f.path));
  }
  
  return results;
}

// Test the getComponentImage function if it's available
if (typeof getComponentImage === 'function') {
  console.log('Testing getComponentImage function...');
  
  const testComponents = [
    'R3 3200G (TRAY) WITH HEATSINK FAN',
    'GALAX RTX 3060 1-CLICK OC BLK 12GB',
    'KINGSTON FURY BEAST DDR4 8GB',
    'ASRock B550M STEEL LEGEND',
    'Samsung 970 EVO Plus 500GB',
    'Corsair CX550F',
    'INPLAY WIND 01',
    'DEEPCOOL AK400'
  ];
  
  testComponents.forEach(component => {
    const imagePath = getComponentImage(component);
    console.log(`Component: "${component}" -> Image: ${imagePath}`);
  });
}

// Run the tests
testAllImages().then(results => {
  console.log('Image loading debug complete!');
  console.log('If images are failing, check:');
  console.log('   1. File paths are correct');
  console.log('   2. Images exist in the specified locations');
  console.log('   3. Server is serving static files correctly');
  console.log('   4. No CORS issues');
});

// Export for use in other scripts
window.debugImageLoading = {
  testImageLoad,
  testAllImages,
  testImages
};
