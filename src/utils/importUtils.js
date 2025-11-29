/**
 * Import utility functions for inventory data
 */
import * as XLSX from 'xlsx';

/**
 * Parse CSV file content
 * @param {string} csvContent - CSV content as string
 * @returns {Array} Array of parsed objects
 */
export const parseCSV = (csvContent) => {
  if (!csvContent || csvContent.trim() === '') {
    return [];
  }

  // Normalize line endings (handle \r\n, \r, and \n)
  const normalizedContent = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    return []; // Need at least header and one row
  }

  // Parse header row using proper CSV line parser to handle quoted headers
  const headerValues = parseCSVLine(lines[0]);
  const headers = headerValues.map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    // Allow rows with different column counts but warn if too many mismatches
    if (values.length === headers.length || (values.length > 0 && headers.length > 0)) {
      const row = {};
      headers.forEach((header, index) => {
        let value = values[index] || '';
        // Remove quotes if present
        value = value.trim().replace(/^"|"$/g, '');
        row[header] = value;
      });
      // Only add row if it has at least one non-empty value
      if (Object.values(row).some(v => v !== '')) {
        data.push(row);
      }
    }
  }

  return data;
};

/**
 * Parse a CSV line handling quoted fields
 * @param {string} line - CSV line
 * @returns {Array} Array of values
 */
const parseCSVLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i++; // Skip next quote
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  
  return values;
};

/**
 * Parse Excel file
 * @param {File} file - Excel file object
 * @returns {Promise<Array>} Array of parsed objects
 */
export const parseExcel = async (file) => {
  if (typeof XLSX === 'undefined' || !XLSX.read) {
    throw new Error('SheetJS library not loaded. Please include xlsx library for Excel import.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false, cellText: false });
        
        // Check if workbook has any sheets
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          reject(new Error('Excel file contains no sheets'));
          return;
        }
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        if (!worksheet) {
          reject(new Error(`Sheet "${firstSheetName}" not found or is empty`));
          return;
        }
        
        // Convert to JSON with header row (first row as keys)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          defval: '', // Default value for empty cells
          raw: false  // Use formatted values
        });
        
        if (!jsonData || jsonData.length === 0) {
          reject(new Error('Excel sheet contains no data'));
          return;
        }
        
        resolve(jsonData);
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file. Please ensure the file is not corrupted.'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Normalize imported data to match component structure
 * @param {Array} importedData - Raw imported data
 * @param {Array} categories - Available categories
 * @returns {Array} Normalized component data
 */
export const normalizeImportedData = (importedData, categories = []) => {
  if (!Array.isArray(importedData) || importedData.length === 0) {
    return [];
  }

  // Helper to find category ID by name
  const findCategoryId = (categoryName) => {
    if (!categoryName) return null;
    
    // Direct ID match
    const idMatch = categoryName.match(/^\d+$/);
    if (idMatch) {
      const id = parseInt(categoryName, 10);
      const category = categories.find(c => c.id === id);
      return category ? id : null;
    }
    
    // Name match (case-insensitive)
    const category = categories.find(c => 
      c.name.toLowerCase() === categoryName.toLowerCase().trim()
    );
    return category ? category.id : null;
  };

  // Helper to get category ID from main category or category name
  const getCategoryId = (item) => {
    // Try "Category" field first
    if (item.Category) {
      const catId = findCategoryId(item.Category);
      if (catId) return catId;
    }
    
    // Try "Main Category" field
    if (item['Main Category']) {
      const mainCat = item['Main Category'].toLowerCase().trim();
      const mainCategories = {
        'cpu': ['CPU', 'Procie Only', 'Pro & Mobo - Amd', 'Pro & Mobo - Intel'],
        'motherboard': ['Motherboard', 'Mobo', 'Pro & Mobo - Amd', 'Pro & Mobo - Intel'],
        'gpu': ['GPU'],
        'ram': ['RAM', 'Ram 3200mhz'],
        'storage': ['Storage', 'Ssd Nvme'],
        'psu': ['PSU', 'Psu - Tr'],
        'power supply': ['PSU', 'Psu - Tr'],
        'case': ['Case', 'Case Gaming'],
        'cooler': ['Cooler', 'Aio']
      };
      
      for (const [key, names] of Object.entries(mainCategories)) {
        if (key === mainCat || names.some(n => n.toLowerCase() === mainCat)) {
          // Find category matching any of these names
          for (const name of names) {
            const category = categories.find(c => c.name === name);
            if (category) return category.id;
          }
        }
      }
    }
    
    return null;
  };

  const normalized = [];

  for (const item of importedData) {
    // Skip rows without name
    if (!item.Name && !item.name) {
      continue;
    }

    const name = item.Name || item.name || '';
    const categoryId = getCategoryId(item);
    
    if (!name.trim() || !categoryId) {
      continue; // Skip invalid rows
    }

    const normalizedItem = {
      name: name.trim(),
      category_id: categoryId,
      brand: (item.Brand || item.brand || '').trim() || null,
      price: parseFloat(item.Price || item.price || 0) || 0,
      stock_quantity: parseInt(item['Stock Quantity'] || item.stock_quantity || item['Stock'] || item.stock || 0, 10) || 0,
      image_url: (item['Image URL'] || item.image_url || item['Image'] || item.image || '').trim() || null
      // Note: description field is not included as it doesn't exist in the components table schema
    };

    normalized.push(normalizedItem);
  }

  return normalized;
};

/**
 * Validate imported component data
 * @param {Object} item - Component data to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateComponent = (item) => {
  const errors = [];

  if (!item.name || item.name.trim() === '') {
    errors.push('Name is required');
  }

  if (!item.category_id || item.category_id <= 0) {
    errors.push('Valid category is required');
  }

  if (item.price < 0) {
    errors.push('Price must be non-negative');
  }

  if (item.stock_quantity < 0) {
    errors.push('Stock quantity must be non-negative');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Import inventory data from file
 * @param {File} file - File to import (CSV or Excel)
 * @param {Array} categories - Available categories
 * @returns {Promise<Object>} Import result with data and validation info
 */
export const importInventoryFromFile = async (file, categories = []) => {
  if (!file) {
    throw new Error('No file provided');
  }

  // Validate file type
  const fileExtension = file.name.split('.').pop().toLowerCase();
  const supportedExtensions = ['csv', 'xlsx', 'xls'];
  
  if (!supportedExtensions.includes(fileExtension)) {
    throw new Error(`Unsupported file type: ${fileExtension}. Please use CSV or Excel (.xlsx, .xls) files.`);
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 10MB.`);
  }

  if (file.size === 0) {
    throw new Error('File is empty. Please select a valid file.');
  }

  let rawData = [];

  try {
    if (fileExtension === 'csv') {
      const text = await file.text();
      if (!text || text.trim() === '') {
        throw new Error('CSV file is empty or contains no readable content.');
      }
      rawData = parseCSV(text);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      rawData = await parseExcel(file);
    }

    if (!rawData || rawData.length === 0) {
      throw new Error('No data found in file. Please ensure the file has a header row and at least one data row.');
    }

    // Normalize data
    const normalized = normalizeImportedData(rawData, categories);

    if (normalized.length === 0) {
      throw new Error('No valid data rows found after parsing. Please check that your file contains columns like: Name, Category (or Main Category), Brand, Price, Stock Quantity.');
    }

    // Validate each item
    const validated = normalized.map(item => ({
      ...item,
      validation: validateComponent(item)
    }));

    const validItems = validated.filter(item => item.validation.isValid);
    const invalidItems = validated.filter(item => !item.validation.isValid);

    return {
      success: true,
      total: normalized.length,
      valid: validItems.map(({ validation, ...item }) => item),
      invalid: invalidItems.map(({ validation, ...item }) => ({
        ...item,
        errors: validation.errors
      })),
      rawData
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown error occurred while importing file',
      total: 0,
      valid: [],
      invalid: []
    };
  }
};

