/**
 * Export utility functions for inventory data
 */
import * as XLSX from 'xlsx';

/**
 * Convert inventory data to CSV format
 * @param {Array} inventoryData - Array of inventory items
 * @param {Array} categories - Array of category data
 * @returns {string} CSV formatted string
 */
export const exportToCSV = (inventoryData, categories = []) => {
  if (!inventoryData || inventoryData.length === 0) {
    return '';
  }

  // Helper function to get category name
  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === Number(categoryId));
    return category ? category.name : categoryId;
  };

  // Helper function to get main category
  const getMainCategory = (item) => {
    const cat = categories.find(c => c.id === Number(item.category_id));
    if (!cat) return 'Unknown';
    
    const mainCategories = {
      'CPU': ['CPU', 'Procie Only', 'Pro & Mobo - Amd', 'Pro & Mobo - Intel'],
      'Motherboard': ['Motherboard', 'Mobo', 'Pro & Mobo - Amd', 'Pro & Mobo - Intel'],
      'GPU': ['GPU'],
      'RAM': ['RAM', 'Ram 3200mhz'],
      'Storage': ['Storage', 'Ssd Nvme'],
      'PSU': ['PSU', 'Psu - Tr'],
      'Case': ['Case', 'Case Gaming'],
      'Cooler': ['Cooler', 'Aio']
    };

    for (const [mainCat, names] of Object.entries(mainCategories)) {
      if (names.includes(cat.name)) return mainCat;
    }
    return cat.name;
  };

  // Helper function to get stock status
  const getStockStatus = (item) => {
    const stock = item.stock_quantity ?? item.stock;
    const price = Number(item.price);
    
    if (stock === 0) return 'Out of Stock';
    if (price === 0) return 'No Price';
    if (stock > 0 && stock <= 5) return 'Low Stock';
    return 'In Stock';
  };

  // CSV headers
  const headers = [
    'ID',
    'Name',
    'Category',
    'Main Category',
    'Brand',
    'Price',
    'Stock Quantity',
    'Stock Status',
    'Description',
    'Image URL',
    'Created At',
    'Updated At'
  ];

  // Convert data to CSV rows
  const rows = inventoryData.map(item => [
    item.id || '',
    `"${(item.name || '').replace(/"/g, '""')}"`, // Escape quotes in name
    `"${getCategoryName(item.category_id)}"`,
    `"${getMainCategory(item)}"`,
    `"${(item.brand || '').replace(/"/g, '""')}"`,
    item.price || '0',
    item.stock_quantity ?? item.stock ?? '0',
    `"${getStockStatus(item)}"`,
    `"${(item.description || '').replace(/"/g, '""')}"`,
    `"${item.image_url || ''}"`,
    `"${item.created_at || ''}"`,
    `"${item.updated_at || ''}"`
  ]);

  // Combine headers and rows
  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  
  return csvContent;
};

/**
 * Export inventory data as CSV file download
 * @param {Array} inventoryData - Array of inventory items
 * @param {Array} categories - Array of category data
 * @param {string} filename - Optional filename (default: inventory-export.csv)
 */
export const downloadCSV = (inventoryData, categories = [], filename = 'inventory-export.csv') => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    console.error('CSV export requires browser environment.');
    return;
  }

  const csvContent = exportToCSV(inventoryData, categories);
  
  if (!csvContent) {
    alert('No data to export');
    return;
  }

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

/**
 * Export inventory data as Excel file (using SheetJS library)
 * @param {Array} inventoryData - Array of inventory items
 * @param {Array} categories - Array of category data
 * @param {string} filename - Optional filename (default: inventory-export.xlsx)
 */
export const downloadExcel = (inventoryData, categories = [], filename = 'inventory-export.xlsx') => {
  // Check if SheetJS is available
  if (typeof XLSX === 'undefined' || !XLSX.utils || !XLSX.writeFile) {
    console.error('SheetJS library not loaded. Please include xlsx library for Excel export.');
    alert('Excel export requires SheetJS library. Falling back to CSV export.');
    downloadCSV(inventoryData, categories, filename.replace('.xlsx', '.csv'));
    return;
  }

  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    console.error('Excel export requires browser environment.');
    return;
  }

  if (!inventoryData || inventoryData.length === 0) {
    alert('No data to export');
    return;
  }

  // Helper functions (same as CSV)
  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === Number(categoryId));
    return category ? category.name : categoryId;
  };

  const getMainCategory = (item) => {
    const cat = categories.find(c => c.id === Number(item.category_id));
    if (!cat) return 'Unknown';
    
    const mainCategories = {
      'CPU': ['CPU', 'Procie Only', 'Pro & Mobo - Amd', 'Pro & Mobo - Intel'],
      'Motherboard': ['Motherboard', 'Mobo', 'Pro & Mobo - Amd', 'Pro & Mobo - Intel'],
      'GPU': ['GPU'],
      'RAM': ['RAM', 'Ram 3200mhz'],
      'Storage': ['Storage', 'Ssd Nvme'],
      'PSU': ['PSU', 'Psu - Tr'],
      'Case': ['Case', 'Case Gaming'],
      'Cooler': ['Cooler', 'Aio']
    };

    for (const [mainCat, names] of Object.entries(mainCategories)) {
      if (names.includes(cat.name)) return mainCat;
    }
    return cat.name;
  };

  const getStockStatus = (item) => {
    const stock = item.stock_quantity ?? item.stock;
    const price = Number(item.price);
    
    if (stock === 0) return 'Out of Stock';
    if (price === 0) return 'No Price';
    if (stock > 0 && stock <= 5) return 'Low Stock';
    return 'In Stock';
  };

  // Prepare data for Excel
  const excelData = inventoryData.map(item => ({
    'ID': item.id || '',
    'Name': item.name || '',
    'Category': getCategoryName(item.category_id),
    'Main Category': getMainCategory(item),
    'Brand': item.brand || '',
    'Price': Number(item.price) || 0,
    'Stock Quantity': Number(item.stock_quantity ?? item.stock) || 0,
    'Stock Status': getStockStatus(item),
    'Description': item.description || '',
    'Image URL': item.image_url || '',
    'Created At': item.created_at || '',
    'Updated At': item.updated_at || ''
  }));

  try {
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths for better readability
    const colWidths = [
      { wch: 8 },   // ID
      { wch: 30 },  // Name
      { wch: 15 },  // Category
      { wch: 15 },  // Main Category
      { wch: 12 },  // Brand
      { wch: 10 },  // Price
      { wch: 12 },  // Stock Quantity
      { wch: 12 },  // Stock Status
      { wch: 40 },  // Description
      { wch: 30 },  // Image URL
      { wch: 20 },  // Created At
      { wch: 20 }   // Updated At
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

    // Generate and download file
    XLSX.writeFile(wb, filename);
  } catch (error) {
    console.error('Error creating Excel file:', error);
    alert(`Failed to create Excel file: ${error.message}. Falling back to CSV export.`);
    downloadCSV(inventoryData, categories, filename.replace('.xlsx', '.csv'));
  }
};

/**
 * Export filtered inventory data based on current filters
 * @param {Array} allInventory - Complete inventory array
 * @param {string} searchTerm - Search term filter
 * @param {string} selectedCategory - Selected category filter
 * @param {string} selectedBrand - Selected brand filter
 * @param {Array} categories - Array of category data
 * @param {string} format - Export format ('csv' or 'excel')
 * @param {string} filename - Optional filename
 */
export const exportFilteredInventory = (
  allInventory, 
  searchTerm, 
  selectedCategory, 
  selectedBrand, 
  categories, 
  format = 'csv',
  filename = null
) => {
  // Apply same filtering logic as the inventory components
  const mainCategories = [
    { key: 'CPU', names: ['CPU', 'Procie Only', 'Pro & Mobo - Amd', 'Pro & Mobo - Intel'] },
    { key: 'Motherboard', names: ['Motherboard', 'Mobo', 'Pro & Mobo - Amd', 'Pro & Mobo - Intel'] },
    { key: 'GPU', names: ['GPU'] },
    { key: 'RAM', names: ['RAM', 'Ram 3200mhz'] },
    { key: 'Storage', names: ['Storage', 'Ssd Nvme'] },
    { key: 'PSU', names: ['PSU', 'Psu - Tr'] },
    { key: 'Case', names: ['Case', 'Case Gaming'] },
    { key: 'Cooler', names: ['Cooler', 'Aio'] }
  ];

  const getMainCategoryKey = (item) => {
    const cat = categories.find(c => c.id === Number(item.category_id));
    if (!cat) return null;
    for (const mainCat of mainCategories) {
      if (mainCat.names.includes(cat.name)) return mainCat.key;
    }
    return null;
  };

  // Filter inventory
  let filtered = allInventory.filter(item => {
    const mainCat = getMainCategoryKey(item);
    if (!mainCat) return false;
    if (selectedCategory !== 'all' && mainCat !== selectedCategory) return false;
    if (selectedBrand !== 'all') {
      if (!item.brand) return false;
      if (selectedBrand.toLowerCase() === 'amd' || selectedBrand.toLowerCase() === 'intel') {
        if (item.brand.toLowerCase() !== selectedBrand.toLowerCase()) return false;
      } else {
        if (item.brand.toLowerCase() !== selectedBrand.toLowerCase()) return false;
      }
    }
    return true;
  });

  // Apply search filter
  if (searchTerm.trim() !== '') {
    filtered = filtered.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  // Generate filename with timestamp if not provided
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const defaultFilename = `inventory-export-${timestamp}.${format === 'excel' ? 'xlsx' : 'csv'}`;
  const finalFilename = filename || defaultFilename;

  // Export based on format
  if (format === 'excel') {
    downloadExcel(filtered, categories, finalFilename);
  } else {
    downloadCSV(filtered, categories, finalFilename);
  }

  return filtered.length; // Return count of exported items
};

/**
 * Export sales reports data as Excel file with multiple sheets
 * @param {Object} reports - Sales reports data object
 * @param {string} filename - Optional filename (default: sales-report.xlsx)
 */
export const downloadSalesReport = (reports = {}, filename = null) => {
  // Check if SheetJS is available
  if (typeof XLSX === 'undefined' || !XLSX.utils || !XLSX.writeFile) {
    console.error('SheetJS library not loaded. Please include xlsx library for Excel export.');
    alert('Excel export requires SheetJS library. Please install xlsx package.');
    return;
  }

  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    console.error('Excel export requires browser environment.');
    return;
  }

  const {
    monthly_sales = [],
    daily_sales = [],
    weekly_sales = [],
    top_selling_products = [],
    revenue_per_category = [],
    revenue_per_brand = [],
    deadstock = [],
    stock_movement = [],
    order_status_breakdown = [],
    average_order_value = {}
  } = reports;

  // Check if there's any data to export
  const hasData = monthly_sales.length > 0 || daily_sales.length > 0 || weekly_sales.length > 0 || 
                  top_selling_products.length > 0 || revenue_per_category.length > 0 || 
                  revenue_per_brand.length > 0 || deadstock.length > 0 || 
                  stock_movement.length > 0 || order_status_breakdown.length > 0;

  try {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Helper to format currency
    const formatCurrency = (amount) => {
      if (!amount || amount === 0) return '₱0.00';
      return `₱${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // 1. Monthly Sales Sheet
    if (monthly_sales.length > 0) {
      const monthlyData = monthly_sales.map(item => ({
        'Month': item.month || '',
        'Total Sales': Number(item.total_sales) || 0,
        'Total Sales (Formatted)': formatCurrency(item.total_sales || 0),
        'Order Count': Number(item.order_count) || 0
      }));
      const wsMonthly = XLSX.utils.json_to_sheet(monthlyData);
      wsMonthly['!cols'] = [
        { wch: 20 },  // Month
        { wch: 15 },  // Total Sales
        { wch: 20 },  // Total Sales (Formatted)
        { wch: 12 }   // Order Count
      ];
      XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly Sales');
    }

    // 2. Weekly Sales Sheet
    if (weekly_sales.length > 0) {
      const weeklyData = weekly_sales.map(item => ({
        'Week': item.week || '',
        'Total Sales': Number(item.total_sales) || 0,
        'Total Sales (Formatted)': formatCurrency(item.total_sales || 0),
        'Order Count': Number(item.order_count) || 0
      }));
      const wsWeekly = XLSX.utils.json_to_sheet(weeklyData);
      wsWeekly['!cols'] = [
        { wch: 20 },  // Week
        { wch: 15 },  // Total Sales
        { wch: 20 },  // Total Sales (Formatted)
        { wch: 12 }   // Order Count
      ];
      XLSX.utils.book_append_sheet(wb, wsWeekly, 'Weekly Sales');
    }

    // 3. Daily Sales Sheet
    if (daily_sales.length > 0) {
      const dailyData = daily_sales.map(item => ({
        'Day': item.day || '',
        'Total Sales': Number(item.total_sales) || 0,
        'Total Sales (Formatted)': formatCurrency(item.total_sales || 0),
        'Order Count': Number(item.order_count) || 0
      }));
      const wsDaily = XLSX.utils.json_to_sheet(dailyData);
      wsDaily['!cols'] = [
        { wch: 20 },  // Day
        { wch: 15 },  // Total Sales
        { wch: 20 },  // Total Sales (Formatted)
        { wch: 12 }   // Order Count
      ];
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Sales');
    }

    // 4. Top Selling Products Sheet
    if (top_selling_products.length > 0) {
      const topProductsData = top_selling_products.map(item => ({
        'Product Name': item.name || '',
        'Brand': item.brand || '',
        'Total Quantity Sold': Number(item.total_quantity) || 0,
        'Total Revenue': Number(item.total_revenue) || 0,
        'Total Revenue (Formatted)': formatCurrency(item.total_revenue || 0)
      }));
      const wsTopProducts = XLSX.utils.json_to_sheet(topProductsData);
      wsTopProducts['!cols'] = [
        { wch: 40 },  // Product Name
        { wch: 15 },  // Brand
        { wch: 18 },  // Total Quantity Sold
        { wch: 15 },  // Total Revenue
        { wch: 20 }   // Total Revenue (Formatted)
      ];
      XLSX.utils.book_append_sheet(wb, wsTopProducts, 'Top Selling Products');
    }

    // 5. Revenue by Category Sheet
    if (revenue_per_category.length > 0) {
      const categoryData = revenue_per_category.map(item => ({
        'Category': item.category || '',
        'Total Revenue': Number(item.total_revenue) || 0,
        'Total Revenue (Formatted)': formatCurrency(item.total_revenue || 0),
        'Order Count': Number(item.order_count) || 0
      }));
      const wsCategory = XLSX.utils.json_to_sheet(categoryData);
      wsCategory['!cols'] = [
        { wch: 20 },  // Category
        { wch: 15 },  // Total Revenue
        { wch: 20 },  // Total Revenue (Formatted)
        { wch: 12 }   // Order Count
      ];
      XLSX.utils.book_append_sheet(wb, wsCategory, 'Revenue by Category');
    }

    // 6. Revenue by Brand Sheet
    if (revenue_per_brand.length > 0) {
      const brandData = revenue_per_brand.map(item => ({
        'Brand': item.brand || '',
        'Total Revenue': Number(item.total_revenue) || 0,
        'Total Revenue (Formatted)': formatCurrency(item.total_revenue || 0),
        'Order Count': Number(item.order_count) || 0
      }));
      const wsBrand = XLSX.utils.json_to_sheet(brandData);
      wsBrand['!cols'] = [
        { wch: 20 },  // Brand
        { wch: 15 },  // Total Revenue
        { wch: 20 },  // Total Revenue (Formatted)
        { wch: 12 }   // Order Count
      ];
      XLSX.utils.book_append_sheet(wb, wsBrand, 'Revenue by Brand');
    }

    // 7. Order Status Breakdown Sheet
    if (order_status_breakdown.length > 0) {
      const statusData = order_status_breakdown.map(item => ({
        'Status': item.status || '',
        'Count': Number(item.count) || 0,
        'Percentage': `${((Number(item.count) / order_status_breakdown.reduce((sum, s) => sum + Number(s.count), 0)) * 100).toFixed(2)}%`
      }));
      const wsStatus = XLSX.utils.json_to_sheet(statusData);
      wsStatus['!cols'] = [
        { wch: 20 },  // Status
        { wch: 12 },  // Count
        { wch: 12 }   // Percentage
      ];
      XLSX.utils.book_append_sheet(wb, wsStatus, 'Order Status');
    }

    // 8. Deadstock Sheet
    if (deadstock.length > 0) {
      const deadstockData = deadstock.map(item => ({
        'Component Name': item.name || '',
        'Brand': item.brand || '',
        'Stock Quantity': Number(item.stock_quantity) || 0,
        'Price': Number(item.price) || 0,
        'Price (Formatted)': formatCurrency(item.price || 0),
        'Total Value': Number(item.price || 0) * Number(item.stock_quantity || 0),
        'Total Value (Formatted)': formatCurrency(Number(item.price || 0) * Number(item.stock_quantity || 0)),
        'Last Sold Date': item.last_sold_date ? new Date(item.last_sold_date).toLocaleDateString() : 'Never'
      }));
      const wsDeadstock = XLSX.utils.json_to_sheet(deadstockData);
      wsDeadstock['!cols'] = [
        { wch: 40 },  // Component Name
        { wch: 15 },  // Brand
        { wch: 15 },  // Stock Quantity
        { wch: 15 },  // Price
        { wch: 18 },  // Price (Formatted)
        { wch: 15 },  // Total Value
        { wch: 20 },  // Total Value (Formatted)
        { wch: 18 }   // Last Sold Date
      ];
      XLSX.utils.book_append_sheet(wb, wsDeadstock, 'Deadstock');
    }

    // 9. Stock Movement Sheet
    if (stock_movement.length > 0) {
      const movementData = stock_movement.map(item => ({
        'Component Name': item.name || '',
        'Brand': item.brand || '',
        'Sold (Last 30 Days)': Number(item.sold_last_30_days) || 0
      }));
      const wsMovement = XLSX.utils.json_to_sheet(movementData);
      wsMovement['!cols'] = [
        { wch: 40 },  // Component Name
        { wch: 15 },  // Brand
        { wch: 20 }   // Sold (Last 30 Days)
      ];
      XLSX.utils.book_append_sheet(wb, wsMovement, 'Stock Movement');
    }

    // 10. Summary Sheet (Always created, even if no data)
    const summaryData = [
      { 'Metric': 'Report Status', 'Value': hasData ? 'Data Available' : 'No Data Available' },
      { 'Metric': 'Average Order Value', 'Value': formatCurrency(average_order_value?.avg_order_value || 0) },
      { 'Metric': 'Total Monthly Sales Records', 'Value': monthly_sales.length },
      { 'Metric': 'Total Weekly Sales Records', 'Value': weekly_sales.length },
      { 'Metric': 'Total Daily Sales Records', 'Value': daily_sales.length },
      { 'Metric': 'Top Selling Products Count', 'Value': top_selling_products.length },
      { 'Metric': 'Categories with Revenue', 'Value': revenue_per_category.length },
      { 'Metric': 'Brands with Revenue', 'Value': revenue_per_brand.length },
      { 'Metric': 'Deadstock Items', 'Value': deadstock.length },
      { 'Metric': 'Order Status Records', 'Value': order_status_breakdown.length },
      { 'Metric': 'Report Generated', 'Value': new Date().toLocaleString() },
      { 'Metric': 'Note', 'Value': hasData ? 'This report contains sales analytics data.' : 'No sales data is currently available. This may be because there are no completed orders yet or the system is still collecting data.' }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = [
      { wch: 30 },  // Metric
      { wch: 50 }   // Value (wider for notes)
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // If no data, show a message but still create the file
    if (!hasData) {
      // Add an empty "No Data" sheet to explain the situation
      const noDataSheet = XLSX.utils.json_to_sheet([
        { 'Message': 'No Sales Data Available' },
        { 'Message': '' },
        { 'Message': 'The following sheets are empty because there is no sales data to report:' },
        { 'Message': '' },
        { 'Message': '• Monthly Sales' },
        { 'Message': '• Weekly Sales' },
        { 'Message': '• Daily Sales' },
        { 'Message': '• Top Selling Products' },
        { 'Message': '• Revenue by Category' },
        { 'Message': '• Revenue by Brand' },
        { 'Message': '• Order Status Breakdown' },
        { 'Message': '• Deadstock' },
        { 'Message': '• Stock Movement' },
        { 'Message': '' },
        { 'Message': 'Please ensure there are completed orders in the system to generate sales reports.' }
      ]);
      noDataSheet['!cols'] = [{ wch: 60 }];
      XLSX.utils.book_append_sheet(wb, noDataSheet, 'Info');
    }

    // Generate filename with timestamp if not provided
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const defaultFilename = `sales-report-${timestamp}.xlsx`;
    const finalFilename = filename || defaultFilename;

    // Generate and download file
    XLSX.writeFile(wb, finalFilename);
  } catch (error) {
    console.error('Error creating sales report file:', error);
    alert(`Failed to create sales report: ${error.message}`);
  }
};
