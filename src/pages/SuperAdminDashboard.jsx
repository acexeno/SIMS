import React, { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE } from '../utils/apiBase'
import { authorizedFetch, ensureValidToken } from '../utils/auth'
import PasswordInput from '../components/common/PasswordInput'
import {
  BarChart3,
  Users,
  Settings,
  Shield,
  UserPlus,
  Eye,
  Edit,
  Trash2,
  TrendingUp,
  Database,
  Activity,
  Package,
  Wrench,
  FileText,
  MessageSquare,
  Plus,
  Bell,
  Cpu,
  Monitor,
  MemoryStick,
  HardDrive,
  Zap,
  Server,
  Thermometer,
  Check,
  Download,
  Upload,
  Archive,
  RotateCcw
} from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'
import { getComponentImage } from '../utils/componentImages'
import { formatCurrencyPHP } from '../utils/currency'
import { exportFilteredInventory } from '../utils/exportUtils'
import { importInventoryFromFile } from '../utils/importUtils'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import SuperAdminPrebuiltPCs from './SuperAdminPrebuiltPCs.jsx'
import SuperAdminPCAssembly from './SuperAdminPCAssembly.jsx'
import AdminReports from '../components/AdminReports';
// SupplierManagement temporarily disabled
import SystemReports from '../components/SystemReports';
import ComponentSearchInput from '../components/ComponentSearchInput';

const formalCategoryNames = {
  "Aio": "CPU Cooler (AIO)",
  "Case Gaming": "PC Case (Gaming)",
  "GPU": "Graphics Card (GPU)",
  "Mobo": "Motherboard",
  "Procie Only": "Processor (CPU)",
  "PSU": "Power Supply (PSU)",
  "Psu - Tr": "Power Supply (PSU, True Rated)",
  "Ram 3200mhz": "Memory (RAM, 3200MHz)",
  "Ssd Nvme": "Storage (SSD NVMe)",
  "Cooler": "CPU Cooler",
  "RAM": "Memory (RAM)",
  "Storage": "Storage",
  "Case": "PC Case",
  "Motherboard": "Motherboard",
  "CPU": "Processor (CPU)"
};

// Shared EditForm used by Super Admin inventory modal
function EditForm({ item = {}, categories = [], onCancel = () => {}, onSave = () => {} }) {
  const [form, setForm] = React.useState({
    id: item.id || null,
    name: item.name || '',
    brand: item.brand || '',
    price: item.price || 0,
    stock_quantity: item.stock_quantity ?? item.stock ?? 0,
    category_id: item.category_id || (categories[0] && categories[0].id) || '',
    image_url: item.image_url || ''
  });
  const [saving, setSaving] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const [imageMeta, setImageMeta] = React.useState(null); // { sizeBytes, width, height }
  const [uploadError, setUploadError] = React.useState(null);

  const handleChange = (k, v) => {
    // Clear upload error when manually changing image URL
    if (k === 'image_url') {
      setUploadError(null);
    }
    setForm(prev => ({ ...prev, [k]: v }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Please select a JPEG, PNG, GIF, or WebP image.');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      setUploadError('File too large. Maximum size is 5MB.');
      return;
    }

    setUploadError(null);

    // Convert file to base64 data URL
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        handleChange('image_url', dataUrl);
        
        // Load image to get dimensions
        const img = new Image();
        img.onload = () => {
          setImageMeta({ 
            sizeBytes: file.size, 
            width: img.naturalWidth, 
            height: img.naturalHeight 
          });
        };
        img.onerror = () => {
          setImageMeta({ sizeBytes: file.size, width: null, height: null });
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        setUploadError('Error reading file. Please try again.');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File conversion error:', err);
      setUploadError('Error processing file. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Convert blob URL to base64 if it's still a blob URL (fallback for old code)
      let imageUrl = form.image_url;
      if (imageUrl && imageUrl.startsWith('blob:')) {
        // Try to convert blob URL to base64
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          imageUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (err) {
          console.warn('Could not convert blob URL, clearing image');
          imageUrl = null;
        }
      }

      const endpoint = form.id ? 'update_component' : 'create_component';
      const submitData = { ...form, image_url: imageUrl };
      const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });
      const result = await res.json();
      if (result.success) {
        onSave(result.data || form);
      } else {
        alert(result.error || 'Save failed');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input required value={form.name} onChange={e => handleChange('name', e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Brand</label>
        <input value={form.brand} onChange={e => handleChange('brand', e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Image</label>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Image URL (optional)"
            value={form.image_url && !form.image_url.startsWith('data:') ? form.image_url : ''}
            onChange={e => handleChange('image_url', e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleFileChange}
            className="mt-1"
          />
        </div>
        {uploadError && (
          <div className="mt-2 text-xs text-red-600">{uploadError}</div>
        )}
        <div className="mt-2">
          {form.image_url ? (
            <div className="flex items-center gap-3">
              <img src={form.image_url} alt="Preview" className="w-20 h-20 object-contain border rounded" onError={e => { e.currentTarget.style.display = 'none'; }} />
              {imageMeta && (
                <span className="text-xs text-gray-600">
                  {imageMeta.width && imageMeta.height ? `${imageMeta.width}×${imageMeta.height} px, ` : ''}{(imageMeta.sizeBytes / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-500">Optional: provide a URL or pick a file</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Price</label>
          <input type="number" step="0.01" value={form.price} onChange={e => handleChange('price', e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Stock Quantity</label>
          <input type="number" value={form.stock_quantity} onChange={e => handleChange('stock_quantity', e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Category</label>
        <select value={form.category_id} onChange={e => handleChange('category_id', e.target.value)} className="mt-1 block w-full border rounded px-3 py-2">
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">Cancel</button>
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
}

const PesoSign = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 20V6a4 4 0 0 0-4-4H7v18" />
    <path d="M7 10h8" />
    <path d="M7 6h8" />
    <path d="M7 14h8" />
  </svg>
);

const InventoryManagement = ({ inventory, categories, user, setInventory: setInventoryState, branch, setBranch }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [modalItem, setModalItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [activeView, setActiveView] = useState('active'); // 'active' or 'archive'
  const [archivedComponents, setArchivedComponents] = useState([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const fileInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportDropdown && !event.target.closest('.export-dropdown')) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportDropdown]);

  // Main component types for dropdown
  const mainCategories = [
    { key: 'CPU', names: ['CPU', 'Procie Only', 'Pro & Mobo - Amd', 'Pro & Mobo - Intel'] },
    { key: 'Motherboard', names: ['Motherboard', 'Mobo', 'Pro & Mobo - Amd', 'Pro & Mobo - Intel'] },
    { key: 'GPU', names: ['GPU'] },
    { key: 'RAM', names: ['RAM', 'Ram 3200mhz'] },
    { key: 'Storage', names: ['Storage', 'Ssd Nvme'] },
    { key: 'PSU', names: ['PSU', 'Psu - Tr'] },
    { key: 'Case', names: ['Case', 'Case Gaming'] },
    { key: 'Cooler', names: ['Cooler', 'Aio'] },
  ];

  // Map category key to all matching category ids
  const categoryKeyToIds = {};
  mainCategories.forEach(cat => {
    categoryKeyToIds[cat.key] = categories
      .filter(c => cat.names.includes(c.name))
      .map(c => String(c.id));
  });

  // Helper to get main category key for an item
  const getMainCategoryKey = (item) => {
    const cat = categories.find(c => c.id === Number(item.category_id));
    if (!cat) return null;
    for (const mainCat of mainCategories) {
      if (mainCat.names.includes(cat.name)) return mainCat.key;
    }
    return null;
  };

  // Get all brands from filtered computer components only
  const filteredComponentItems = inventory.filter(item => getMainCategoryKey(item));
  const allBrands = Array.from(new Set(
    filteredComponentItems
      .map(item => (item.brand || '').trim())
      .filter(Boolean)
      .map(b => b.toLowerCase())
  ));
  // Normalize to title case for display
  const displayBrands = allBrands.map(b => b.charAt(0).toUpperCase() + b.slice(1));
  // Always include AMD and Intel if present
  const brandOptions = ['all'];
  if (allBrands.includes('amd')) brandOptions.push('AMD');
  if (allBrands.includes('intel')) brandOptions.push('Intel');
  // Add the rest, excluding AMD/Intel
  brandOptions.push(...displayBrands.filter(b => b !== 'Amd' && b !== 'Intel'));

  // Filtering logic
  let filtered = inventory.filter(item => {
    const mainCat = getMainCategoryKey(item);
    if (!mainCat) return false;
    if (selectedCategory !== 'all' && mainCat !== selectedCategory) return false;
    if (selectedBrand !== 'all') {
      if (!item.brand) return false;
      // Case-insensitive match
      if (selectedBrand.toLowerCase() === 'amd' || selectedBrand.toLowerCase() === 'intel') {
        if (item.brand.toLowerCase() !== selectedBrand.toLowerCase()) return false;
      } else {
        if (item.brand.toLowerCase() !== selectedBrand.toLowerCase()) return false;
      }
    }
    return true;
  });
  if (searchTerm.trim() !== '') {
    filtered = filtered.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'price') return Number(b.price) - Number(a.price);
    if (sortBy === 'stock') return Number(a.stock_quantity || a.stock) - Number(b.stock_quantity || b.stock);
    if (sortBy === 'category') return (getMainCategoryKey(a) || '').localeCompare(getMainCategoryKey(b) || '');
    return 0;
  });

  // Export functionality
  const handleExport = (format) => {
    const exportedCount = exportFilteredInventory(
      inventory,
      searchTerm,
      selectedCategory,
      selectedBrand,
      categories,
      format
    );
    
    if (exportedCount > 0) {
      alert(`Successfully exported ${exportedCount} items to ${format.toUpperCase()} format.`);
    } else {
      alert('No items match the current filters to export.');
    }
  };

  // Import functionality
  const handleImport = async (file) => {
    if (!file) return;

    setIsImporting(true);
    try {
      // Parse the file
      const result = await importInventoryFromFile(file, categories);

      if (!result.success) {
        alert(`Import failed: ${result.error}`);
        setIsImporting(false);
        return;
      }

      if (result.valid.length === 0) {
        alert('No valid items found in the file. Please check the file format.');
        setIsImporting(false);
        return;
      }

      // Show preview and confirmation
      const previewMessage = `Found ${result.total} items:\n` +
        `- ${result.valid.length} valid items\n` +
        `- ${result.invalid.length} invalid items\n\n` +
        (result.invalid.length > 0 ? `Invalid items:\n${result.invalid.map((item, idx) => `  ${idx + 1}. ${item.name || 'Unknown'}: ${item.errors?.join(', ') || 'Error'}`).join('\n')}\n\n` : '') +
        `Continue with import?`;

      if (!confirm(previewMessage)) {
        setIsImporting(false);
        return;
      }

      // Send to backend
      const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=import_components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ components: result.valid })
      });

      const importResult = await res.json();

      if (!importResult.success) {
        alert(`Import failed: ${importResult.error || 'Unknown error'}`);
        setIsImporting(false);
        return;
      }

      // Show results
      const successMessage = `Import completed!\n\n` +
        `Total: ${importResult.total}\n` +
        `Created: ${importResult.created}\n` +
        `Updated: ${importResult.updated}\n` +
        `Failed: ${importResult.failed}\n\n` +
        (importResult.errors.length > 0 ? `Errors:\n${importResult.errors.map((err, idx) => `  ${idx + 1}. ${err.name}: ${err.error}`).join('\n')}` : '');

      alert(successMessage);

      // Refresh inventory by calling dashboard API
      try {
        const refreshRes = await authorizedFetch(`${API_BASE}/index.php?endpoint=dashboard`);
        const refreshData = await refreshRes.json();
        if (refreshData.success && refreshData.data && setInventoryState) {
          setInventoryState(refreshData.data.inventory || []);
        }
      } catch (refreshError) {
        console.error('Error refreshing inventory:', refreshError);
        // Still show success message even if refresh fails
      }
    } catch (error) {
      console.error('Import error:', error);
      alert(`Import failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension before processing
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = ['csv', 'xlsx', 'xls'];
    
    if (!allowedExtensions.includes(fileExtension)) {
      alert(`Invalid file type: .${fileExtension}\n\nPlease select a CSV or Excel file (.csv, .xlsx, .xls)`);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    handleImport(file);
  };

  // Fetch archived components
  const fetchArchivedComponents = async () => {
    setLoadingArchive(true);
    try {
      const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=archived_components`);
      const result = await res.json();
      if (result.success) {
        setArchivedComponents(result.data || []);
      } else {
        console.error('Failed to fetch archived components:', result.error);
        setArchivedComponents([]);
      }
    } catch (error) {
      console.error('Error fetching archived components:', error);
      setArchivedComponents([]);
    } finally {
      setLoadingArchive(false);
    }
  };

  // Load archived components when switching to archive view
  useEffect(() => {
    if (activeView === 'archive') {
      fetchArchivedComponents();
    }
  }, [activeView]);

  // Restore component from archive
  const handleRestoreComponent = async (archivedId) => {
    if (!window.confirm('Are you sure you want to restore this component to the active inventory?')) return;
    
    try {
      const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=restore_component`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: archivedId })
      });
      const result = await res.json();
      if (result.success) {
        alert('Component restored successfully!');
        // Refresh archived list
        fetchArchivedComponents();
        // Refresh main inventory if available
        try {
          const refreshRes = await authorizedFetch(`${API_BASE}/index.php?endpoint=dashboard`);
          const refreshData = await refreshRes.json();
          if (refreshData.success && refreshData.data && setInventoryState) {
            setInventoryState(refreshData.data.inventory || []);
          }
        } catch (refreshError) {
          console.error('Error refreshing inventory:', refreshError);
        }
        // Switch back to active view
        setActiveView('active');
      } else {
        alert(result.error || 'Failed to restore component');
      }
    } catch (error) {
      console.error('Error restoring component:', error);
      alert('Error restoring component');
    }
  };

  // Filter archived components
  const filteredArchived = archivedComponents.filter(item => {
    if (searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(searchLower) ||
        (item.brand && item.brand.toLowerCase().includes(searchLower)) ||
        (item.category_name && item.category_name.toLowerCase().includes(searchLower))
      );
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'price') return Number(b.price) - Number(a.price);
    if (sortBy === 'stock') return Number(a.stock_quantity || 0) - Number(b.stock_quantity || 0);
    if (sortBy === 'category') return (a.category_name || '').localeCompare(b.category_name || '');
    if (sortBy === 'deleted') return new Date(b.deleted_at) - new Date(a.deleted_at);
    return 0;
  });

  return (
    <div className="page-container space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Inventory</h2>
          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveView('active')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeView === 'active'
                  ? 'bg-green-600 text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveView('archive')}
              className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
                activeView === 'archive'
                  ? 'bg-gray-800 text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Archive className="h-4 w-4" />
              Archive
            </button>
          </div>
        </div>
        {activeView === 'active' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Branch:</span>
              <div className="inline-flex rounded-lg border overflow-hidden">
                <button
                  className={`px-3 py-1 text-sm ${branch === null ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setBranch(null)}
                >
                  All
                </button>
                <button
                  className={`px-3 py-1 text-sm border-l ${branch === 'BULACAN' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setBranch('BULACAN')}
                >
                  Bulacan
                </button>
                <button
                  className={`px-3 py-1 text-sm border-l ${branch === 'MARIKINA' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setBranch('MARIKINA')}
                >
                  Marikina
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Import Button */}
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileChange}
                  className="hidden"
                  id="import-file-input-superadmin"
                />
                <label htmlFor="import-file-input-superadmin">
                  <button
                    className={`btn btn-outline shadow flex items-center gap-2 ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isImporting}
                    onClick={() => !isImporting && fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {isImporting ? 'Importing...' : 'Import'}
                  </button>
                </label>
              </div>
              {/* Export Dropdown */}
              <div className="relative export-dropdown">
                <button 
                  className="btn btn-outline shadow flex items-center gap-2"
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
                {showExportDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-10">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          handleExport('csv');
                          setShowExportDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Export as CSV
                      </button>
                      <button
                        onClick={() => {
                          handleExport('excel');
                          setShowExportDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Export as Excel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button className="btn btn-primary shadow" onClick={() => setEditItem({})}>
                <Plus className="h-4 w-4" />
                Add Product
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Search, Filter, Sort Controls */}
      <div className="card">
        <div className="flex flex-col gap-3">
          {/* Search Bar - Full width on mobile, fixed width on larger screens */}
          <div className="w-full">
            <input
              type="text"
              placeholder="Search by name or brand..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="px-4 py-2 border rounded-lg w-full"
              style={{ minHeight: '42px' }}
            />
          </div>
          
          {/* Filter Controls - Only show for active view */}
          {activeView === 'active' && (
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border rounded-lg flex-1"
                  style={{ minHeight: '42px' }}
                >
                  <option value="all">All Components</option>
                  {mainCategories.map(cat => (
                    <option key={cat.key} value={cat.key}>{cat.key}</option>
                  ))}
                </select>
                <select
                  value={selectedBrand}
                  onChange={e => setSelectedBrand(e.target.value)}
                  className="px-4 py-2 border rounded-lg flex-1"
                  style={{ minHeight: '42px' }}
                >
                  <option value="all">All Brands</option>
                  {brandOptions.filter(b => b !== 'all').map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          
          {/* Sort Control - Separate row on mobile, inline on larger screens */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-4 py-2 border rounded-lg w-full sm:w-48"
              style={{ minHeight: '42px' }}
            >
              <option value="name">Sort by Name</option>
              <option value="price">Sort by Price</option>
              <option value="stock">Sort by Stock</option>
              <option value="category">Sort by Category</option>
              {activeView === 'archive' && <option value="deleted">Sort by Deleted Date</option>}
            </select>
          </div>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="table-ui">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Price</th>
              <th>Status</th>
              {activeView === 'archive' && <th>Deleted At</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeView === 'active' ? (
              filtered.length > 0 ? filtered.map((item) => {
              // Use image_url if it exists and is not empty/null, otherwise fallback to getComponentImage
              const imgSrc = (item.image_url && item.image_url.trim() !== '') ? item.image_url : getComponentImage(item.name);
              return (
                <tr key={item.id}>
                  <td className="text-sm font-medium text-gray-900 break-words max-w-xs flex items-center gap-3" style={{ maxWidth: '320px' }} title={item.name}>
                    <img
                      src={imgSrc}
                      alt={item.name}
                      className="w-12 h-12 object-contain rounded border cursor-pointer hover:shadow-lg transition duration-150"
                      onClick={() => setModalItem(item)}
                      onError={e => { 
                        e.target.onerror = null; 
                        // Try getComponentImage fallback first, then default
                        const fallbackSrc = getComponentImage(item.name);
                        if (fallbackSrc !== imgSrc) {
                          e.target.src = fallbackSrc;
                        } else {
                          e.target.src = '/images/components/default.png';
                        }
                      }}
                    />
                    <span className="align-middle">{item.name}</span>
                  </td>
                  <td className="text-sm text-gray-900">{getMainCategoryKey(item)}</td>
                  <td className="text-sm text-gray-900">{item.stock_quantity ?? item.stock}</td>
                  <td className="text-sm text-gray-900">₱{item.price}</td>
                  <td>
                    {(() => {
                      const stock = item.stock_quantity ?? item.stock;
                      const price = Number(item.price);
                      if (stock === 0) {
                        return <span className="chip chip-red">Out of Stock</span>;
                      } else if (price === 0) {
                        return <span className="chip chip-gray">No Price</span>;
                      } else if (stock > 0 && stock <= 5) {
                        return <span className="chip chip-yellow">Low Stock</span>;
                      } else {
                        return <span className="chip chip-green">In Stock</span>;
                      }
                    })()}
                  </td>
                  <td className="text-sm font-medium space-x-2">
                    <button
                      className="btn btn-outline btn-icon"
                      onClick={() => setEditItem(item)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      className="btn btn-outline btn-icon text-red-600 border-red-200 hover:bg-red-50"
                      onClick={async () => {
                        if (!window.confirm(`Delete '${item.name}'?`)) return;
                        try {
                          const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=delete_component&id=${encodeURIComponent(item.id)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: item.id })
                          });
                          const result = await res.json();
                          if (result.success) {
                            // reload to refresh inventory list; ideally lift state up instead
                            window.location.reload();
                          } else {
                            alert(result.error || 'Failed to delete item');
                          }
                        } catch (e) {
                          console.error(e);
                          alert('Error deleting item');
                        }
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
              }) : <tr><td colSpan="6" className="empty-state">No inventory data available.</td></tr>
            ) : (
              loadingArchive ? (
                <tr><td colSpan={activeView === 'archive' ? "7" : "6"} className="empty-state text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                  Loading archived components...
                </td></tr>
              ) : filteredArchived.length > 0 ? filteredArchived.map((item) => {
                const imgSrc = (item.image_url && item.image_url.trim() !== '') ? item.image_url : getComponentImage(item.name);
                const deletedDate = item.deleted_at ? new Date(item.deleted_at).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'Unknown';
                return (
                  <tr key={item.id}>
                    <td className="text-sm font-medium text-gray-900 break-words max-w-xs flex items-center gap-3" style={{ maxWidth: '320px' }} title={item.name}>
                      <img
                        src={imgSrc}
                        alt={item.name}
                        className="w-12 h-12 object-contain rounded border cursor-pointer hover:shadow-lg transition duration-150"
                        onClick={() => setModalItem(item)}
                        onError={e => { 
                          e.target.onerror = null; 
                          const fallbackSrc = getComponentImage(item.name);
                          if (fallbackSrc !== imgSrc) {
                            e.target.src = fallbackSrc;
                          } else {
                            e.target.src = '/images/components/default.png';
                          }
                        }}
                      />
                      <span className="align-middle">{item.name}</span>
                    </td>
                    <td className="text-sm text-gray-900">{item.category_name || 'N/A'}</td>
                    <td className="text-sm text-gray-900">{item.stock_quantity ?? 0}</td>
                    <td className="text-sm text-gray-900">₱{item.price}</td>
                    <td>
                      <span className="chip chip-gray">Archived</span>
                    </td>
                    {activeView === 'archive' && (
                      <td className="text-sm text-gray-500">{deletedDate}</td>
                    )}
                    <td className="text-sm font-medium space-x-2">
                      <button
                        className="btn btn-outline btn-icon text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => handleRestoreComponent(item.id)}
                        title="Restore Component"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={activeView === 'archive' ? "7" : "6"} className="empty-state">No archived components found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Modal for enlarged image and details */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setModalItem(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-0 relative w-full max-w-4xl flex flex-col md:flex-row items-stretch" onClick={e => e.stopPropagation()}>
            {/* Close Button */}
            <button className="absolute top-4 right-4 bg-gray-100 hover:bg-green-100 text-gray-500 hover:text-green-600 rounded-full p-3 transition-colors shadow text-2xl" onClick={() => setModalItem(null)} aria-label="Close modal">
              <span className="sr-only">Close</span>
              &times;
            </button>
            {/* Image Section */}
            <div className="flex-shrink-0 flex items-center justify-center bg-gray-50 rounded-l-2xl md:rounded-l-2xl md:rounded-r-none p-10 md:w-1/2 w-full border-b md:border-b-0 md:border-r">
              <div className="flex items-center justify-center w-full max-w-[500px] max-h-[400px] bg-white rounded border overflow-hidden">
                <img 
                  src={modalItem.image_url || getComponentImage(modalItem.name)} 
                  alt={modalItem.name} 
                  className="max-w-full max-h-[400px] object-contain" 
                  onError={e => { 
                    e.target.onerror = null; 
                    e.target.src = getComponentImage(modalItem.name);
                  }}
                />
              </div>
            </div>
            {/* Details Section */}
            <div className="flex-1 flex flex-col justify-center p-10 md:w-1/2 w-full">
              <div className="text-3xl font-extrabold text-gray-900 mb-4 text-center md:text-left">{modalItem.name}</div>
              <div className="mb-6 flex flex-wrap gap-3 justify-center md:justify-start">
                <span className="inline-block bg-gray-100 text-gray-700 rounded px-3 py-1 text-base font-semibold">ID: {modalItem.id}</span>
                <span className="inline-block bg-blue-100 text-blue-700 rounded px-3 py-1 text-base font-semibold">{getMainCategoryKey(modalItem)}</span>
                <span className="inline-block bg-green-100 text-green-700 rounded px-3 py-1 text-base font-semibold">Brand: {modalItem.brand || '-'}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-lg text-gray-700 mb-6">
                <div className="flex items-center font-semibold"><span className="mr-2 text-blue-600 text-2xl font-bold align-middle">₱</span>Price:</div>
                <div className="font-bold text-green-700 text-xl">₱{modalItem.price}</div>
                <div className="flex items-center font-semibold"><span className="mr-2"><svg className="w-5 h-5 text-yellow-500 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg></span>Stock:</div>
                <div className="text-lg">{modalItem.stock_quantity ?? modalItem.stock}</div>
              </div>
              {/* Extra details if available */}
              {modalItem.specs && typeof modalItem.specs === 'object' && Object.keys(modalItem.specs).length > 0 && (
                <div className="mb-2">
                  <div className="font-semibold text-gray-800 mb-2 text-lg">Specs:</div>
                  <ul className="list-disc list-inside text-xs text-gray-700 bg-green-50 rounded p-2 border border-green-100 mt-1">
                    {Object.entries(modalItem.specs).map(([key, value]) => (
                      <li key={key}><span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span> {String(value)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Edit/Create modal for SuperAdmin */}
      {editItem !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setEditItem(null)}>
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-2xl w-full relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" onClick={() => setEditItem(null)}>×</button>
            <h3 className="text-xl font-bold mb-4">{editItem.id ? 'Edit Product' : 'Add Product'}</h3>
            <EditForm
              item={editItem}
              categories={categories}
              onCancel={() => setEditItem(null)}
              onSave={(saved) => {
                if (saved) {
                  // refresh page to pick up changes from server
                  window.location.reload();
                }
                setEditItem(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const OrdersManagement = ({ orders, inventory, categories = [], onRefetch }) => {
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/index.php?endpoint=orders&id=${orderId}&action=delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete order');
      }

      alert('Order deleted successfully');
      if (onRefetch) onRefetch();
    } catch (error) {
      console.error('Delete order error:', error);
      alert(`Failed to delete order: ${error.message}`);
    }
  };

  const handleEditOrder = (order) => {
    setEditingOrder(order);
    setOrderModalOpen(true);
  };

  return (
  <div className="page-container space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Orders</h2>
      <button className="btn btn-primary shadow" onClick={() => { setEditingOrder(null); setOrderModalOpen(true); }}>
        <Plus className="h-4 w-4" />
        Add Order
      </button>
    </div>
    <div className="card overflow-x-auto">
      <table className="table-ui">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(orders && orders.length > 0) ? orders.map((order) => (
            <tr key={order.id}>
              <td className="text-sm font-semibold text-gray-900">#{order.id}</td>
              <td className="text-sm text-gray-900">{order.user_id}</td>
              <td className="text-sm text-gray-900">₱{order.total_price}</td>
              <td>
                <span className={`chip ${
                  order.status === 'Completed' ? 'chip-green' :
                  order.status === 'Processing' ? 'chip-yellow' : 'chip-gray'
                }`}>{order.status}</span>
              </td>
              <td className="text-sm text-gray-900">{order.order_date}</td>
              <td className="text-sm font-medium space-x-2">
                <button 
                  className="btn btn-outline btn-icon"
                  onClick={() => handleEditOrder(order)}
                  title="Edit Order"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button 
                  className="btn btn-outline btn-icon text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleDeleteOrder(order.id)}
                  title="Delete Order"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan="6" className="empty-state">No order data available.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    {orderModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-6" onClick={() => setOrderModalOpen(false)}>
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-6xl w-full max-h-[95vh] overflow-y-auto relative modal-scrollbar" onClick={e => e.stopPropagation()}>
          <button className="absolute top-6 right-6 text-gray-500 hover:text-gray-800 z-10 text-2xl font-bold" onClick={() => setOrderModalOpen(false)}>×</button>
          <h3 className="text-2xl font-bold mb-6 text-gray-800">{editingOrder ? 'Edit Order' : 'Create Order'}</h3>
          <CreateOrderForm
            inventory={inventory}
            categories={categories}
            editingOrder={editingOrder}
            onCancel={() => { setOrderModalOpen(false); setEditingOrder(null); }}
            onCreated={() => { setOrderModalOpen(false); setEditingOrder(null); if (onRefetch) onRefetch(); }}
          />
        </div>
      </div>
    )}
  </div>
  );
};

const SuperAdminNotifications = () => {
  const {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    unreadCount
  } = useNotifications();
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [expanded, setExpanded] = useState({}); // Track expanded grouped notifications

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.read;
    if (filter === 'read') return notification.read;
    return true;
  });

  // Helper to detect grouped notification
  const isGroupedNotification = (n) =>
    n.type === 'stock' && (n.title === 'Low Stock: Multiple Components' || n.title === 'Out of Stock: Multiple Components');

  // Helper to parse component list from grouped message with bullet points
  const parseComponentList = (message) => {
    const categorized = {};
    
    // Split message into lines and process bullet points
    const lines = message.split('\n');
    let currentCategory = null;
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      // Check for category headers (• Category Name (X items):)
      const categoryMatch = trimmedLine.match(/^•\s*(.+?)\s*\((\d+)\s*items?\):/);
      if (categoryMatch) {
        currentCategory = categoryMatch[1].trim();
        categorized[currentCategory] = [];
        return;
      }
      
      // Check for component items (- Component Name)
      const componentMatch = trimmedLine.match(/^-\s*(.+)$/);
      if (componentMatch && currentCategory) {
        const componentName = componentMatch[1].trim();
        categorized[currentCategory].push(componentName);
      }
    });
    
    return categorized;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
    </div>
  );

  return (
    <div className="p-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Notifications</h1>
            <p className="text-sm text-gray-500">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition"
          >
            <option value="all">All Notifications</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
            >
              Mark All as Read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete all notifications?')) {
                  deleteAllNotifications();
                }
              }}
              className="px-4 py-2 bg-gray-300 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-400 transition-colors"
            >
              Delete All
            </button>
          )}
        </div>
      </div>
      {/* Notifications List */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
            </h3>
            <p className="text-gray-500">
              {filter === 'all' 
                ? 'You\'ll see important updates here when they arrive.'
                : `You have no ${filter} notifications at the moment.`
              }
            </p>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const grouped = isGroupedNotification(n);
            const categorizedComponents = grouped ? parseComponentList(n.message) : {};
            return (
              <div
                key={n.id}
                className={`bg-white rounded-2xl shadow-lg border p-6 transition-all duration-200 hover:shadow-2xl ${
                  !n.read ? 'border-l-4 border-red-500 bg-red-50' : ''
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    <Bell className={`w-6 h-6 ${n.read ? 'text-gray-400' : 'text-red-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className={`text-base font-semibold mb-3 ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>{n.title}</h3>
                        {!grouped && (
                          <div className="mt-3 mb-4">
                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{n.message}</p>
                          </div>
                        )}
                        {grouped && Object.keys(categorizedComponents).length > 0 && (
                          <div className="mt-4 mb-4 bg-red-50 rounded-lg p-4 border border-red-100">
                            <div className="text-sm font-semibold text-red-800 mb-3">
                              Affected Components:
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                              {Object.entries(categorizedComponents).map(([category, components]) => (
                                <div key={category} className="bg-white rounded-lg p-3 border border-red-200">
                                  <div className="text-sm font-medium text-red-700 mb-2 flex items-center">
                                    <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                                    {category} ({components.length} items)
                                  </div>
                                  <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {components.map((comp, idx) => (
                                      <div key={idx} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 border border-red-100">
                                        {comp}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center mt-4 text-sm text-gray-500">
                          {n.timestamp && (new Date(n.timestamp)).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 ml-6">
                        {!n.read && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                            title="Mark as read"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(n.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                          title="Delete notification"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const SuperAdminDashboard = ({ initialTab = 'dashboard', user, setUser }) => {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [users, setUsers] = useState([])
  const [systemStats, setSystemStats] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [inventory, setInventory] = useState([])
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'employee', // Default to employee
    first_name: '',
    last_name: ''
  })
  const [passwordRequirements, setPasswordRequirements] = useState({
    min_length: 8,
    max_length: null, // No maximum limit - allows stronger passwords and passphrases
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_special: true
  })
  const [generatingPassword, setGeneratingPassword] = useState(false)
  const [orders, setOrders] = useState([])
  const [adminReports, setAdminReports] = useState({})
  const [categories, setCategories] = useState([]);
  const [dashboardSalesChartType, setDashboardSalesChartType] = useState('monthly');
  // Branch filter: null = All (global), or 'BULACAN' / 'MARIKINA'
  const [branch, setBranch] = useState(null);
  let dashboardSalesChartData = [];
  let dashboardSalesChartTitle = '';
  let dashboardSalesChartComponent = null;
  if (dashboardSalesChartType === 'monthly') {
    dashboardSalesChartData = adminReports?.monthly_sales || [];
    dashboardSalesChartTitle = 'Monthly Sales';
    dashboardSalesChartComponent = dashboardSalesChartData.length > 0 ? (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={dashboardSalesChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" label={{ value: 'Month', position: 'insideBottomRight', offset: 0 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="total_sales" stroke="#A020F0" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    ) : (
      <div className="h-[280px] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-3">No data available</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            This could be because there are no completed orders yet or the system is still collecting data.
          </p>
        </div>
      </div>
    );
  } else if (dashboardSalesChartType === 'weekly') {
    dashboardSalesChartData = adminReports?.weekly_sales || [];
    dashboardSalesChartTitle = 'Weekly Sales';
    dashboardSalesChartComponent = dashboardSalesChartData.length > 0 ? (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={dashboardSalesChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" label={{ value: 'Week', position: 'insideBottomRight', offset: 0 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="total_sales" stroke="#36A2EB" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    ) : (
      <div className="h-[280px] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-3">No data available</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            This could be because there are no completed orders yet or the system is still collecting data.
          </p>
        </div>
      </div>
    );
  } else if (dashboardSalesChartType === 'daily') {
    dashboardSalesChartData = adminReports?.daily_sales || [];
    dashboardSalesChartTitle = 'Daily Sales (Last 30 Days)';
    dashboardSalesChartComponent = dashboardSalesChartData.length > 0 ? (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={dashboardSalesChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" label={{ value: 'Day', position: 'insideBottomRight', offset: 0 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="total_sales" fill="#36A2EB" />
        </BarChart>
      </ResponsiveContainer>
    ) : (
      <div className="h-[320px] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-3">No data available</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            This could be because there are no completed orders yet or the system is still collecting data.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Fetch password requirements on component mount
  useEffect(() => {
    const fetchPasswordRequirements = async () => {
      try {
        const response = await fetch(`${API_BASE}/index.php?endpoint=password_requirements`);
        const data = await response.json();
        if (data.success && data.requirements) {
          setPasswordRequirements(data.requirements);
        }
      } catch (error) {
        console.error('Failed to fetch password requirements:', error);
        // Keep default requirements if fetch fails
      }
    };
    
    fetchPasswordRequirements();
  }, []);
  
  useEffect(() => {
    const fetchData = async (showLoading = false) => {
      if (showLoading) setIsLoading(true);
      try {
        const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=dashboard${branch ? `&branch=${branch}` : ''}`, {
          method: 'GET'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const result = await response.json();

        if (result.success) {
          const data = result.data;
          setUsers(data.users || []);
          setSystemStats(data.system_stats || {});
          setInventory(data.inventory || []);
          setOrders(data.orders || []);
          setAdminReports(data.reports || {});
        } else {
          throw new Error(result.error || 'API call was not successful');
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        // Do not set isLoading to true here
      } finally {
        if (showLoading) setIsLoading(false);
      }
    };

    // Initial load with loading spinner
    fetchData(true);

    // Polling every 60 seconds (reduced frequency to prevent blinking)
    const interval = setInterval(() => {
      fetchData(false);
    }, 60000);

    return () => clearInterval(interval);
  }, [branch]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=categories`);
        const result = await response.json();
        if (result.success) {
          setCategories(result.data);
        }
      } catch (e) {
        // Optionally handle error
      }
    };
    fetchCategories();
  }, []);

  // Fetch user profile to ensure roles are properly set
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Wait for authentication to be ready before making API calls
        const token = await ensureValidToken();
        if (!token) {
          // No valid token for profile fetch, skipping
          return;
        }
        
        const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=profile`, { 
          method: 'GET',
          suppressUnauthorizedEvent: true 
        });
        if (res.status === 401) {
          // 401 error in profile fetch, skipping
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (data.success && data.user) {
          if (setUser) setUser(data.user);
        }
      } catch (error) {
        console.error('SuperAdminDashboard: Error fetching profile:', error);
      }
    };
    
    // Add a small delay to let authentication stabilize
    const timeoutId = setTimeout(fetchProfile, 500);
    return () => clearTimeout(timeoutId);
  }, [setUser]);

  // ... rest of the code remains the same ...

  // RECOMMENDED: Super Admin creates users via secure register with role assignment
  // The backend now handles role assignment and permissions automatically when role is provided
  const createUser = async ({ username, email, password, first_name, last_name, role }) => {
    try {
      // Perform a privileged register bypassing email OTP for Super Admin
      // Pass the role directly - backend will assign the correct role and permissions
      const regRes = await authorizedFetch(`${API_BASE}/index.php?endpoint=register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          email, 
          password, 
          first_name, 
          last_name, 
          role,  // Pass role directly - backend will assign it when ADMIN_OVERRIDE is used
          otp_code: 'ADMIN_OVERRIDE' 
        })
      });
      const regData = await regRes.json();
      if (!regRes.ok || !regData.success || !regData.user?.id) {
        // Show more detailed error message if available
        const errorMsg = regData.details || regData.error || 'Registration failed';
        throw new Error(errorMsg);
      }
      
      // Verify that the role was assigned correctly
      const assignedRoles = regData.user?.roles || [];
      if (!assignedRoles.includes(role)) {
        console.warn(`Warning: User created but role assignment may have failed. Expected: ${role}, Got: ${assignedRoles.join(', ')}`);
      }

      // Success message with clear instructions
      alert(`✅ User created successfully as ${role}!\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 LOGIN CREDENTIALS:\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 Username: ${username}\n🔑 Password: ${password}\n\n⚠️ IMPORTANT:\n• Use the USERNAME (not email) to login\n• Copy these credentials now - you cannot retrieve them later\n• Share them securely with the user\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    } catch (e) {
      alert(`❌ Failed to create user:\n${e.message}`);
      throw e;
    }
  };

  // Generate secure password automatically
  const handleGeneratePassword = async () => {
    setGeneratingPassword(true);
    try {
      const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=generate_password`);
      const data = await res.json();
      if (data.success && data.password) {
        // Clear any existing password first, then set new one
        setNewUser(prev => ({ ...prev, password: data.password }));
      } else {
        alert('Failed to generate password');
      }
    } catch (err) {
      console.error('Error generating password:', err);
      alert('Error generating password');
    } finally {
      setGeneratingPassword(false);
    }
  };

  // Open create user modal with clean form
  const handleOpenCreateUserModal = () => {
    // Reset form to ensure clean state
    setNewUser({
      username: '',
      email: '',
      password: '',
      role: 'employee',
      first_name: '',
      last_name: ''
    });
    setShowCreateUserModal(true);
  };

  // Copy password to clipboard
  const handleCopyPassword = () => {
    if (newUser.password) {
      navigator.clipboard.writeText(newUser.password).then(() => {
        alert('Password copied to clipboard!');
      }).catch(() => {
        alert('Failed to copy password');
      });
    }
  };

  // Form submit handler wired to the Create User modal
  const handleCreateUser = async (e) => {
    e.preventDefault();
    // Basic client-side validation to prevent avoidable server errors
    if (!newUser.username || !newUser.email || !newUser.password || !newUser.first_name || !newUser.last_name) {
      alert('Please complete all required fields.');
      return;
    }
    const emailOk = /.+@.+\..+/.test(String(newUser.email));
    if (!emailOk) {
      alert('Please enter a valid email address.');
      return;
    }
    
    // Validate password using dynamic requirements
    const passwordLength = String(newUser.password).length;
    const passwordErrors = [];
    
    if (passwordLength < passwordRequirements.min_length) {
      passwordErrors.push(`Password must be at least ${passwordRequirements.min_length} characters long`);
    }
    
    if (passwordRequirements.max_length && passwordLength > passwordRequirements.max_length) {
      passwordErrors.push(`Password must be no more than ${passwordRequirements.max_length} characters long`);
    }
    
    if (passwordRequirements.require_uppercase && !/[A-Z]/.test(newUser.password)) {
      passwordErrors.push('Password must contain at least one uppercase letter');
    }
    
    if (passwordRequirements.require_lowercase && !/[a-z]/.test(newUser.password)) {
      passwordErrors.push('Password must contain at least one lowercase letter');
    }
    
    if (passwordRequirements.require_numbers && !/\d/.test(newUser.password)) {
      passwordErrors.push('Password must contain at least one number');
    }
    
    if (passwordRequirements.require_special && !/[^A-Za-z0-9]/.test(newUser.password)) {
      passwordErrors.push('Password must contain at least one special character');
    }
    
    if (passwordErrors.length > 0) {
      alert(passwordErrors.join('\n'));
      return;
    }
    const roleMap = {
      'employee': 'Employee',
      'admin': 'Admin'
    };
    const selectedRole = roleMap[String(newUser.role || '').toLowerCase()] || 'Employee';
    await createUser({
      username: newUser.username,
      email: newUser.email,
      password: newUser.password,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
      role: selectedRole
    });
    setShowCreateUserModal(false);
    // Reset form
    setNewUser({
      username: '',
      email: '',
      password: '',
      role: 'employee',
      first_name: '',
      last_name: ''
    });
    // Refresh users list from backend to ensure UI reflects role and flags
    try {
      const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=get_users`);
      const data = await res.json();
      if (data && data.success) setUsers(data.data || []);
    } catch {}
  };

  // Handler for toggling inventory access
  const handleToggleInventoryAccess = async (userId, currentValue) => {
    try {
      const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=update_inventory_access`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId, can_access_inventory: currentValue ? 0 : 1 })
      });
      const result = await response.json();
      if (result.success) {
        // Optimistically update local state
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, can_access_inventory: currentValue ? 0 : 1 } : u));
        // Refresh users list from backend to ensure consistency
        try {
          const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=get_users`);
          const data = await res.json();
          if (data && data.success) setUsers(data.data || []);
        } catch {}
      } else {
        alert(result.error || 'Failed to update inventory access');
      }
    } catch (e) {
      alert('Error updating inventory access');
    }
  };

  // Handler for toggling order access
  const handleToggleOrderAccess = async (userId, currentValue) => {
    try {
      const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=update_order_access`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId, can_access_orders: currentValue ? 0 : 1 })
      });
      const result = await response.json();
      if (result.success) {
        // Optimistically update local state
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, can_access_orders: currentValue ? 0 : 1 } : u));
        // Refresh users list from backend to ensure consistency
        try {
          const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=get_users`);
          const data = await res.json();
          if (data && data.success) setUsers(data.data || []);
        } catch {}
      } else {
        alert(result.error || 'Failed to update order access');
      }
    } catch (e) {
      alert('Error updating order access');
    }
  };

  // Handler for toggling chat support access
  const handleToggleChatSupportAccess = async (userId, currentValue) => {
    try {
      const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=update_chat_support_access`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId, can_access_chat_support: currentValue ? 0 : 1 })
      });
      const result = await response.json();
      if (result.success) {
        // Optimistically update local state
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, can_access_chat_support: currentValue ? 0 : 1 } : u));
        // Refresh users list from backend to ensure consistency
        try {
          const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=get_users`);
          const data = await res.json();
          if (data && data.success) setUsers(data.data || []);
        } catch {}
      } else {
        alert(result.error || 'Failed to update chat support access');
      }
    } catch (e) {
      alert('Error updating chat support access');
    }
  };

  // Handler for deleting users
  const handleDeleteUser = async (userId) => {
    try {
      const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=delete_user`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      });
      const result = await response.json();
      if (result.success) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        alert('User deleted successfully');
      } else {
        alert(result.error || 'Failed to delete user');
      }
    } catch (e) {
      alert('Error deleting user');
    }
  };

  const UserManagement = (props) => {
    // ... rest of the code remains the same ...

    const handleCreateUser = async (e) => {
      e.preventDefault();
      try {
        const response = await authorizedFetch(`${API_BASE}/auth/register.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...newUser,
            is_active: true
          })
        });

        const result = await response.json();

        if (result.success) {
          // Refresh users list
          fetchData();
          setShowCreateUserModal(false);
          setNewUser({
            username: '',
            email: '',
            password: '',
            role: 'employee',
            first_name: '',
            last_name: ''
          });
          alert(`Successfully created ${newUser.role} account!`);
        } else {
          throw new Error(result.error || 'Failed to create user');
        }
      } catch (error) {
        console.error('Error creating user:', error);
        alert(`Error creating user: ${error.message}`);
      }
    };

  // Temporarily return null for UserManagement to keep compile integrity
  return null;
  };

  // Main render (replacing temporary fallback)
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'notifications':
        return <SuperAdminNotifications />;
      case 'system-reports':
        return <SystemReports reports={adminReports} />;
      case 'inventory':
        return <InventoryManagement inventory={inventory} categories={categories} user={user} setInventory={setInventory} branch={branch} setBranch={setBranch} />;
      case 'orders-management':
        return <OrdersManagement orders={orders} inventory={inventory} categories={categories} onRefetch={() => { /* quick refetch */ authorizedFetch(`${API_BASE}/index.php?endpoint=orders`).then(r=>r.json()).then(d=>{ if(d&&d.success) setOrders(d.data||[]) }).catch(()=>{}); }} />;
      // case 'supplier-management':
      //   return <SupplierManagement user={user} />;
      case 'pc-assembly':
        return (
          <SuperAdminPCAssembly
            user={user}
            setUser={() => {}}
          />
        );
      case 'prebuilt-management':
        return <SuperAdminPrebuiltPCs />;
      case 'user-management':
        // Placeholder until full UserManagement UI is wired back
        return (
          <div className="p-6 space-y-6">
            {/* Header styled like Supplier Management */}
            <div className="flex items-center gap-4">
              <Users className="h-10 w-10 text-green-500" />
              <div>
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Users</h2>
                <p className="text-gray-500 text-base mt-1">Create and manage users, roles, status, and access permissions.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Total users: {Array.isArray(users) ? users.length : 0}</div>
              <button className="bg-green-600 text-white px-5 py-2.5 rounded-xl hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2 font-semibold" onClick={handleOpenCreateUserModal}>
                <UserPlus className="h-4 w-4" />
                Create User
              </button>
            </div>

            {/* Users Table */}
            <div className="card overflow-x-auto">
              <table className="table-ui">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Roles</th>
                    <th>Online</th>
                    <th>Status</th>
                    <th>Inventory</th>
                    <th>Orders</th>
                    <th>Chat Support</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(users) && users.length > 0 ? users.map((u) => (
                    <tr key={u.id}>
                      <td className="text-sm font-medium text-gray-900">
                        {u.username || `User #${u.id}`}
                        <div className="text-xs text-gray-500">{[u.first_name, u.last_name].filter(Boolean).join(' ')}</div>
                      </td>
                      <td className="text-sm text-gray-900">{u.email}</td>
                      <td className="text-sm text-gray-900">
                        {(Array.isArray(u.roles) ? u.roles : (typeof u.roles === 'string' ? u.roles.split(',') : []))
                          .map(r => r.trim()).filter(Boolean).map((r, idx) => (
                            <span key={idx} className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-semibold mr-1 mb-1">{r}</span>
                          ))}
                      </td>
                      <td>
                        {(() => {
                          const last = u.last_login ? new Date(u.last_login) : null;
                          const isOnline = !!(last && (Date.now() - last.getTime()) <= 30 * 60 * 1000);
                          return (
                            <span className={`chip ${isOnline ? 'chip-green' : 'chip-gray'}`}>{isOnline ? 'Online' : 'Offline'}</span>
                          );
                        })()}
                      </td>
                      <td>
                        <span className={`chip ${u.is_active ? 'chip-green' : 'chip-red'}`}>{u.is_active ? 'Active' : 'Disabled'}</span>
                      </td>
                      <td>
                        {(() => {
                          const active = Number(u.can_access_inventory) === 1;
                          return (
                            <button
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${active ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' : 'bg-green-600 text-white hover:bg-green-700'}`}
                              onClick={() => {
                                const action = active ? 'disable' : 'enable';
                                const name = u.username || `User #${u.id}`;
                                if (typeof window === 'undefined' || window.confirm(`Are you sure you want to ${action} Inventory access for ${name}?`)) {
                                  handleToggleInventoryAccess(u.id, active);
                                }
                              }}
                              title={active ? 'Disable Inventory Access' : 'Enable Inventory Access'}
                            >
                              {active ? 'Disable' : 'Enable'}
                            </button>
                          );
                        })()}
                      </td>
                      <td>
                        {(() => {
                          const active = Number(u.can_access_orders) === 1;
                          return (
                            <button
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${active ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' : 'bg-green-600 text-white hover:bg-green-700'}`}
                              onClick={() => {
                                const action = active ? 'disable' : 'enable';
                                const name = u.username || `User #${u.id}`;
                                if (typeof window === 'undefined' || window.confirm(`Are you sure you want to ${action} Orders access for ${name}?`)) {
                                  handleToggleOrderAccess(u.id, active);
                                }
                              }}
                              title={active ? 'Disable Orders Access' : 'Enable Orders Access'}
                            >
                              {active ? 'Disable' : 'Enable'}
                            </button>
                          );
                        })()}
                      </td>
                      <td>
                        {(() => {
                          const active = Number(u.can_access_chat_support) === 1;
                          return (
                            <button
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${active ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' : 'bg-green-600 text-white hover:bg-green-700'}`}
                              onClick={() => {
                                const action = active ? 'disable' : 'enable';
                                const name = u.username || `User #${u.id}`;
                                if (typeof window === 'undefined' || window.confirm(`Are you sure you want to ${action} Chat Support access for ${name}?`)) {
                                  handleToggleChatSupportAccess(u.id, active);
                                }
                              }}
                              title={active ? 'Disable Chat Support' : 'Enable Chat Support'}
                            >
                              {active ? 'Disable' : 'Enable'}
                            </button>
                          );
                        })()}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          {(() => {
                            // Only allow deletion of Admin and Employee accounts, not Super Admin
                            const userRoles = Array.isArray(u.roles) ? u.roles : (typeof u.roles === 'string' ? u.roles.split(',') : []);
                            const canDelete = userRoles.some(role => ['Admin', 'Employee'].includes(role.trim()));
                            
                            return canDelete ? (
                              <button
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                                onClick={() => {
                                  const name = u.username || `User #${u.id}`;
                                  if (window.confirm(`Are you sure you want to delete user "${name}"? This action cannot be undone.`)) {
                                    handleDeleteUser(u.id);
                                  }
                                }}
                                title="Delete User"
                              >
                                Delete
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm px-3 py-1.5">Protected</span>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="8" className="empty-state">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Create User Modal */}
            {showCreateUserModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
                setShowCreateUserModal(false);
                // Reset form when closing
                setNewUser({
                  username: '',
                  email: '',
                  password: '',
                  role: 'employee',
                  first_name: '',
                  last_name: ''
                });
              }}>
                <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Create User</h3>
                    <button className="text-gray-500 hover:text-gray-800 text-2xl" onClick={() => {
                      setShowCreateUserModal(false);
                      // Reset form when closing
                      setNewUser({
                        username: '',
                        email: '',
                        password: '',
                        role: 'employee',
                        first_name: '',
                        last_name: ''
                      });
                    }}>×</button>
                  </div>
                  <form onSubmit={handleCreateUser} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Username <span className="text-red-600">*</span>
                        </label>
                        <input 
                          required 
                          value={newUser.username} 
                          onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))} 
                          className="mt-1 block w-full border-2 border-blue-300 rounded px-3 py-2 focus:border-blue-500" 
                          placeholder="e.g., john.doe"
                        />
                        <p className="text-xs text-blue-600 mt-1">👆 Use this to login, not email</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Email <span className="text-red-600">*</span>
                        </label>
                        <input 
                          required 
                          type="email" 
                          value={newUser.email} 
                          onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))} 
                          className="mt-1 block w-full border rounded px-3 py-2" 
                          placeholder="e.g., john.doe@company.com"
                        />
                        <p className="text-xs text-gray-500 mt-1">For notifications only</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">First name</label>
                        <input value={newUser.first_name} onChange={(e) => setNewUser(prev => ({ ...prev, first_name: e.target.value }))} className="mt-1 block w-full border rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last name</label>
                        <input value={newUser.last_name} onChange={(e) => setNewUser(prev => ({ ...prev, last_name: e.target.value }))} className="mt-1 block w-full border rounded px-3 py-2" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Role</label>
                      <select value={newUser.role} onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))} className="mt-1 block w-full border rounded px-3 py-2">
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Password</label>
                      <div className="flex gap-2 mt-1">
                        <div className="flex-1">
                          <PasswordInput
                            required
                            value={newUser.password || ''}
                            onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                            className="block w-full border rounded px-3 py-2"
                            placeholder="Click Generate to create password"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleGeneratePassword}
                          disabled={generatingPassword}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 whitespace-nowrap"
                        >
                          {generatingPassword ? 'Generating...' : 'Generate'}
                        </button>
                        {newUser.password && (
                          <button
                            type="button"
                            onClick={handleCopyPassword}
                            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 whitespace-nowrap"
                            title="Copy password"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                      {newUser.password && (
                        <div className="mt-2 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                          <p className="text-xs font-semibold text-green-800 mb-2 flex items-center gap-2">
                            <span>🔑</span>
                            <span>Generated Password (SAVE THIS!):</span>
                          </p>
                          <p className="text-lg font-mono font-bold text-green-700 break-all bg-white p-2 rounded border border-green-200">{newUser.password}</p>
                          <p className="text-xs text-green-700 mt-2">⚠️ You cannot retrieve this password later!</p>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => {
                        setShowCreateUserModal(false);
                        // Reset form when canceling
                        setNewUser({
                          username: '',
                          email: '',
                          password: '',
                          role: 'employee',
                          first_name: '',
                          last_name: ''
                        });
                      }} className="px-4 py-2 border rounded">Cancel</button>
                      <button type="submit" className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700">Create</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      case 'dashboard':
      default: {
        const totalSales = adminReports?.monthly_sales?.[0]?.total_sales || 0;
        const deadstockCount = adminReports?.deadstock?.length || 0;
        const topSeller = adminReports?.top_selling_products?.[0]?.name || 'N/A';
        const deadstockTotalValue = adminReports?.deadstock_total_value ?? 0;
        return (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Super Admin Dashboard</h2>
              <p className="text-gray-600">Overview of key metrics and recent activity.</p>
            </div>

            {/* Stats Cards (consistent with Employee) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-lg border">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl font-extrabold text-green-600">₱</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Sales This Month</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrencyPHP(totalSales)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-lg border">
                <div className="flex items-center">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <Package className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Deadstock Items</p>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{deadstockCount}</p>
                      <p className="text-sm text-gray-600">
                        Total: {formatCurrencyPHP(deadstockTotalValue)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-lg border">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-600">Top Seller</p>
                    <p className="text-base font-bold text-gray-900 break-words leading-tight" title={topSeller}>{topSeller}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sales Chart Dropdown */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <label htmlFor="dashboard-sales-chart-type" className="block text-sm font-medium text-gray-700 mb-1">Select Sales Chart:</label>
                <select
                  id="dashboard-sales-chart-type"
                  className="border rounded px-4 py-2 text-base focus:ring-2 focus:ring-green-400 focus:border-green-400 transition"
                  value={dashboardSalesChartType}
                  onChange={e => setDashboardSalesChartType(e.target.value)}
                >
                  <option value="monthly">Monthly Sales</option>
                  <option value="weekly">Weekly Sales</option>
                  <option value="daily">Daily Sales</option>
                </select>
              </div>
              <div className="flex-1 flex items-end justify-end">
                <span className="text-gray-500 text-sm italic">Showing: <span className="font-semibold text-gray-800">{dashboardSalesChartTitle}</span></span>
              </div>
            </div>

            {/* Sales Chart */}
            <div className="card p-6 mb-8">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">{dashboardSalesChartTitle}</h4>
              {dashboardSalesChartComponent}
            </div>

            {/* Recent orders */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h3>
              <div className="overflow-x-auto">
                <table className="table-ui">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orders && orders.length > 0) ? orders.slice(0, 5).map((order) => (
                      <tr key={order.id}>
                        <td className="whitespace-nowrap text-sm font-medium text-gray-900">#{order.id}</td>
                        <td className="whitespace-nowrap text-sm text-gray-900">{order.user_id}</td>
                        <td className="whitespace-nowrap text-sm text-gray-900">₱{order.total_price}</td>
                        <td className="whitespace-nowrap text-sm text-gray-900">{order.status}</td>
                        <td className="whitespace-nowrap text-sm text-gray-900">{order.order_date}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="5" className="text-center py-4">No recent orders.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div className="min-h-[70vh]">
      {renderContent()}
    </div>
  );
};

export default SuperAdminDashboard;

// Minimal CreateOrderForm (reused shape from Admin)
function CreateOrderForm({ inventory = [], categories = [], editingOrder = null, onCancel = () => {}, onCreated = () => {} }) {
  const [items, setItems] = React.useState([{ component_id: '', quantity: 1 }])
  const [status, setStatus] = React.useState('pending')
  const [creating, setCreating] = React.useState(false)
  const [notes, setNotes] = React.useState('')
  const [purchaseDate, setPurchaseDate] = React.useState('')
  const [customerName, setCustomerName] = React.useState('')
  const [customerPhone, setCustomerPhone] = React.useState('')

  const addLine = () => setItems(prev => [...prev, { component_id: '', quantity: 1 }])
  const updateLine = (idx, patch) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  const removeLine = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  // Populate form when editing an existing order
  React.useEffect(() => {
    if (editingOrder) {
      setStatus(editingOrder.status || 'pending')
      setNotes(editingOrder.notes || '')
      setPurchaseDate(editingOrder.purchase_date || '')
      setCustomerName(editingOrder.customer_name || '')
      setCustomerPhone(editingOrder.customer_phone || '')
      
      // Validate order ID before fetching
      if (!editingOrder.id) {
        console.error('Cannot fetch order details: order ID is missing', editingOrder)
        alert('Error: Order ID is missing. Cannot load order details.')
        setItems([{ component_id: '', quantity: 1 }])
        return
      }
      
      // Fetch order details with items
      const fetchOrderDetails = async () => {
        try {
          const url = `${API_BASE}/index.php?endpoint=orders&id=${editingOrder.id}`
          console.log('Fetching order details from:', url)
          
          const res = await authorizedFetch(url)
          
          // Check response status before parsing JSON
          if (!res.ok) {
            const errorText = await res.text()
            let errorData
            try {
              errorData = JSON.parse(errorText)
            } catch {
              errorData = { error: errorText || `HTTP ${res.status}` }
            }
            console.error('Failed to fetch order details:', res.status, errorData)
            alert(`Failed to load order details: ${errorData.error || `HTTP ${res.status}`}`)
            setItems([{ component_id: '', quantity: 1 }])
            return
          }
          
          const data = await res.json()
          
          if (data.success && data.data) {
            // Populate items from the order
            if (data.data.items && Array.isArray(data.data.items) && data.data.items.length > 0) {
              const orderItems = data.data.items.map(item => ({
                component_id: item.component_id ? item.component_id.toString() : '',
                quantity: item.quantity || 1
              }))
              setItems(orderItems)
            } else {
              // Order exists but has no items
              console.warn('Order found but has no items')
              setItems([{ component_id: '', quantity: 1 }])
            }
            // Populate optional contact fields if present
            setCustomerName(data.data.customer_name || '')
            setCustomerPhone(data.data.customer_phone || '')
          } else {
            console.error('API returned unsuccessful response:', data)
            alert(`Failed to load order: ${data.error || 'Unknown error'}`)
            setItems([{ component_id: '', quantity: 1 }])
          }
        } catch (error) {
          console.error('Error fetching order details:', error)
          alert(`Error loading order details: ${error.message || 'Network error'}`)
          setItems([{ component_id: '', quantity: 1 }])
        }
      }
      
      fetchOrderDetails()
    } else {
      // Reset form when not editing
      setItems([{ component_id: '', quantity: 1 }])
      setStatus('pending')
      setNotes('')
      setPurchaseDate('')
    }
  }, [editingOrder])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Check for empty component slots - user must either select a component or remove the slot
    const emptySlots = items.filter(it => !it.component_id || it.component_id === '')
    if (emptySlots.length > 0) {
      alert('Please select a component for all items or remove empty slots using the "Remove" button.')
      return
    }
    
    // Validate purchase date
    if (!purchaseDate) {
      alert('Please select a purchase date.')
      return
    }
    if (customerPhone && !/^63\d{10}$/.test(String(customerPhone).replace(/[^\d]/g, ''))) {
      alert('Customer phone must start with 63 followed by 10 digits.')
      return
    }
    
    const normalized = items
      .filter(it => it.component_id && Number(it.quantity) > 0)
      .map(it => ({ component_id: Number(it.component_id), quantity: Number(it.quantity) }))
    if (normalized.length === 0) { alert('Add at least one item.'); return }
    setCreating(true)
    try {
      const isEdit = !!editingOrder
      const endpoint = isEdit ? `${API_BASE}/index.php?endpoint=orders&id=${editingOrder.id}` : `${API_BASE}/index.php?endpoint=orders`
      const method = isEdit ? 'PUT' : 'POST'
      
      const res = await authorizedFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: normalized, 
          status, 
          notes: notes ? String(notes).toUpperCase() : undefined,
          purchase_date: purchaseDate,
          customer_name: customerName || undefined,
          customer_phone: customerPhone || undefined
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        alert(data.error || `Failed to ${isEdit ? 'update' : 'create'} order`)
      } else {
        onCreated(data.order_id || editingOrder?.id)
      }
    } catch (err) {
      console.error(err)
      alert(`Network error ${editingOrder ? 'updating' : 'creating'} order`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Component Selection Section */}
      <div className="bg-gray-50 rounded-2xl p-6">
        <h4 className="text-lg font-semibold text-gray-800 mb-6">Component Selection</h4>
        <div className="space-y-6">
          {items.map((it, idx) => (
            <div key={idx} className={`bg-white rounded-xl p-6 shadow-sm border-2 ${!it.component_id || it.component_id === '' ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
              <div className="grid grid-cols-12 gap-4 items-end">
                <div className="col-span-7">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Component</label>
                  <ComponentSearchInput
                    value={it.component_id}
                    onChange={(componentId) => updateLine(idx, { component_id: componentId })}
                    inventory={inventory}
                    categories={categories}
                    placeholder="Search components..."
                    className={`w-full ${!it.component_id || it.component_id === '' ? 'border-red-300' : ''}`}
                  />
                  {(!it.component_id || it.component_id === '') && (
                    <p className="text-red-600 text-sm mt-2 font-medium">Please select a component or remove this item</p>
                  )}
                </div>
                <div className="col-span-3">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                    value={it.quantity}
                    onChange={e => updateLine(idx, { quantity: e.target.value })}
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <button 
                    type="button" 
                    className="text-red-600 hover:text-red-800 font-semibold text-sm py-3 px-4 border-2 border-red-300 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap" 
                    onClick={() => removeLine(idx)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button 
            type="button" 
            className="w-full text-green-600 hover:text-green-800 font-semibold flex items-center justify-center gap-3 py-4 px-6 border-2 border-dashed border-green-300 rounded-xl hover:bg-green-50 transition-colors" 
            onClick={addLine}
          >
            <Plus className="h-5 w-5" />
            Add Another Component
          </button>
        </div>
      </div>

      {/* Order Details Section */}
      <div className="bg-gray-50 rounded-2xl p-6">
        <h4 className="text-lg font-semibold text-gray-800 mb-6">Order Details</h4>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Status</label>
            <select className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Purchase Date *</label>
            <input 
              type="date" 
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors" 
              value={purchaseDate} 
              onChange={e => setPurchaseDate(e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Notes (COMMENTS)</label>
            <input 
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors" 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="OPTIONAL" 
            />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Customer Full Name</label>
            <input 
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors" 
              value={customerName} 
              onChange={e => setCustomerName(e.target.value)} 
              placeholder="Juan Dela Cruz" 
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Customer Contact Number</label>
            <input 
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors" 
              value={customerPhone} 
              onChange={e => setCustomerPhone(e.target.value)} 
              placeholder="639XXXXXXXXX" 
            />
            <p className="text-xs text-gray-500 mt-1">PH format: 63 + 10 digits</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-6 border-t-2 border-gray-200">
        <button 
          type="button" 
          onClick={onCancel} 
          className="px-8 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-semibold text-gray-700"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          className="px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg" 
          disabled={creating}
        >
          {creating ? (editingOrder ? 'Updating...' : 'Creating...') : (editingOrder ? 'Update Order' : 'Create Order')}
        </button>
      </div>
    </form>
  )
}