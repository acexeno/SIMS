/**
 * Test file for export functionality
 * This can be run in the browser console to test the export functions
 */

// Test data
const testInventory = [
  {
    id: 1,
    name: 'Intel Core i7-12700K',
    category_id: 1,
    brand: 'Intel',
    price: 25000,
    stock_quantity: 10,
    description: 'High-performance CPU',
    image_url: 'https://example.com/cpu.jpg',
    created_at: '2024-01-01',
    updated_at: '2024-01-15'
  },
  {
    id: 2,
    name: 'AMD Ryzen 7 5800X',
    category_id: 2,
    brand: 'AMD',
    price: 22000,
    stock_quantity: 5,
    description: 'High-performance CPU',
    image_url: 'https://example.com/amd-cpu.jpg',
    created_at: '2024-01-02',
    updated_at: '2024-01-16'
  }
];

const testCategories = [
  { id: 1, name: 'CPU' },
  { id: 2, name: 'Procie Only' }
];

// Test functions (to be run in browser console)
function testCSVExport() {
  console.log('Testing CSV Export...');
  const csvContent = exportToCSV(testInventory, testCategories);
  console.log('CSV Content:', csvContent);
  return csvContent;
}

function testExcelExport() {
  console.log('Testing Excel Export...');
  try {
    downloadExcel(testInventory, testCategories, 'test-inventory.xlsx');
    console.log('Excel export initiated');
  } catch (error) {
    console.log('Excel export failed (SheetJS not loaded):', error.message);
  }
}

function testFilteredExport() {
  console.log('Testing Filtered Export...');
  const exportedCount = exportFilteredInventory(
    testInventory,
    'Intel', // search term
    'CPU',   // category
    'Intel', // brand
    testCategories,
    'csv'
  );
  console.log(`Exported ${exportedCount} items`);
  return exportedCount;
}

// Export test functions to global scope for console testing
if (typeof window !== 'undefined') {
  window.testCSVExport = testCSVExport;
  window.testExcelExport = testExcelExport;
  window.testFilteredExport = testFilteredExport;
}
