import React, { useState, useEffect, useCallback } from 'react'
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
  Check
} from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'
import { getComponentImage } from '../utils/componentImages'
import { formatCurrencyPHP } from '../utils/currency'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import SuperAdminPrebuiltPCs from './SuperAdminPrebuiltPCs.jsx'
import SuperAdminPCAssembly from './SuperAdminPCAssembly.jsx'
import AdminReports from '../components/AdminReports';
// SupplierManagement temporarily disabled
import SystemReports from '../components/SystemReports';

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
    category_id: item.category_id || (categories[0] && categories[0].id) || ''
  });
  const [saving, setSaving] = React.useState(false);

  const handleChange = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const endpoint = form.id ? 'update_component' : 'create_component';
      const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
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

const InventoryManagement = ({ inventory, categories, user }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [modalItem, setModalItem] = useState(null);
  const [editItem, setEditItem] = useState(null);

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

  return (
    <div className="page-container space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Inventory Management</h2>
        <button className="btn btn-primary shadow">
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>
      {/* Search, Filter, Sort Controls */}
      <div className="card flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
        <div className="flex gap-2 flex-1">
          <input
            type="text"
            placeholder="Search by name or brand..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-4 py-2 border rounded-lg w-full md:w-64"
            style={{ minHeight: '42px' }}
          />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border rounded-lg"
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
            className="px-4 py-2 border rounded-lg"
            style={{ minHeight: '42px' }}
          >
            <option value="all">All Brands</option>
            {brandOptions.filter(b => b !== 'all').map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-4 py-2 border rounded-lg"
            style={{ minHeight: '42px' }}
          >
            <option value="name">Sort by Name</option>
            <option value="price">Sort by Price</option>
            <option value="stock">Sort by Stock</option>
            <option value="category">Sort by Category</option>
          </select>
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((item) => {
              const imgSrc = getComponentImage(item.name);
              return (
                <tr key={item.id}>
                  <td className="text-sm font-medium text-gray-900 break-words max-w-xs flex items-center gap-3" style={{ maxWidth: '320px' }} title={item.name}>
                    <img
                      src={imgSrc}
                      alt={item.name}
                      className="w-12 h-12 object-contain rounded border cursor-pointer hover:shadow-lg transition duration-150"
                      onClick={() => setModalItem(item)}
                      onError={e => { e.target.onerror = null; e.target.src = '/images/components/default.png'; }}
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
                          const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=delete_component`, {
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
            }) : <tr><td colSpan="6" className="empty-state">No inventory data available.</td></tr>}
          </tbody>
        </table>
      </div>
      {/* Modal for enlarged image and details */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setModalItem(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-0 relative w-full max-w-4xl flex flex-col md:flex-row items-stretch" onClick={e => e.stopPropagation()}>
            {/* Close Button */}
            <button className="absolute top-4 right-4 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded-full p-3 transition-colors shadow text-2xl" onClick={() => setModalItem(null)} aria-label="Close modal">
              <span className="sr-only">Close</span>
              &times;
            </button>
            {/* Image Section */}
            <div className="flex-shrink-0 flex items-center justify-center bg-gray-50 rounded-l-2xl md:rounded-l-2xl md:rounded-r-none p-10 md:w-1/2 w-full border-b md:border-b-0 md:border-r">
              <div className="flex items-center justify-center w-full max-w-[500px] max-h-[400px] bg-white rounded border overflow-hidden">
                <img src={getComponentImage(modalItem.name)} alt={modalItem.name} className="max-w-full max-h-[400px] object-contain" />
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
                  <ul className="list-disc list-inside text-xs text-gray-700 bg-red-50 rounded p-2 border border-red-100 mt-1">
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

const OrdersManagement = ({ orders }) => (
  <div className="page-container space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Orders Management</h2>
      <button className="btn btn-primary shadow">
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
                <button className="btn btn-outline btn-icon">
                  <Edit className="h-4 w-4" />
                </button>
                <button className="btn btn-outline btn-icon text-red-600 border-red-200 hover:bg-red-50">
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
  </div>
);

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

  // Helper to parse component list from grouped message
  const parseComponentList = (message) => {
    // Extract the part between ':' and '.'
    const match = message.match(/: (.+?)\./);
    if (match && match[1]) {
      return match[1].split(',').map(s => s.trim());
    }
    return [];
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
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
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
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
      <div className="space-y-3">
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
            const components = grouped ? parseComponentList(n.message) : [];
            return (
              <div
                key={n.id}
                className={`bg-white rounded-2xl shadow-lg border p-4 transition-all duration-200 hover:shadow-2xl ${
                  !n.read ? 'border-l-4 border-red-500 bg-red-50' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <Bell className={`w-5 h-5 ${n.read ? 'text-gray-400' : 'text-red-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className={`text-sm font-medium ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>{n.title}</h3>
                        {!grouped && <p className="text-sm text-gray-600 mt-1">{n.message}</p>}
                        {grouped && components.length > 0 && (
                          <ul className="mt-2 list-disc list-inside text-xs text-gray-700 bg-red-50 rounded p-2 border border-red-100">
                            {components.map((comp, idx) => (
                              <li key={idx}>{comp}</li>
                            ))}
                          </ul>
                        )}
                        <div className="flex items-center mt-2 text-xs text-gray-500">
                          {n.timestamp && (new Date(n.timestamp)).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {!n.read && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(n.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete notification"
                        >
                          <Trash2 className="w-4 h-4" />
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
  const [orders, setOrders] = useState([])
  const [adminReports, setAdminReports] = useState({})
  const [categories, setCategories] = useState([]);
  const [dashboardSalesChartType, setDashboardSalesChartType] = useState('monthly');
  let dashboardSalesChartData = [];
  let dashboardSalesChartTitle = '';
  let dashboardSalesChartComponent = null;
  if (dashboardSalesChartType === 'monthly') {
    dashboardSalesChartData = adminReports?.monthly_sales || [];
    dashboardSalesChartTitle = 'Monthly Sales';
    dashboardSalesChartComponent = (
      <ResponsiveContainer width="100%" height={200}>
        {dashboardSalesChartData.length > 0 ? (
          <LineChart data={dashboardSalesChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" label={{ value: 'Month', position: 'insideBottomRight', offset: 0 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="total_sales" stroke="#A020F0" strokeWidth={3} />
          </LineChart>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-lg">No data available</div>
        )}
      </ResponsiveContainer>
    );
  } else if (dashboardSalesChartType === 'weekly') {
    dashboardSalesChartData = adminReports?.weekly_sales || [];
    dashboardSalesChartTitle = 'Weekly Sales';
    dashboardSalesChartComponent = (
      <ResponsiveContainer width="100%" height={200}>
        {dashboardSalesChartData.length > 0 ? (
          <LineChart data={dashboardSalesChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" label={{ value: 'Week', position: 'insideBottomRight', offset: 0 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="total_sales" stroke="#36A2EB" strokeWidth={3} />
          </LineChart>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-lg">No data available</div>
        )}
      </ResponsiveContainer>
    );
  } else if (dashboardSalesChartType === 'daily') {
    dashboardSalesChartData = adminReports?.daily_sales || [];
    dashboardSalesChartTitle = 'Daily Sales (Last 30 Days)';
    dashboardSalesChartComponent = (
      <ResponsiveContainer width="100%" height={250}>
        {dashboardSalesChartData.length > 0 ? (
          <BarChart data={dashboardSalesChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" label={{ value: 'Day', position: 'insideBottomRight', offset: 0 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="total_sales" fill="#36A2EB" />
          </BarChart>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-lg">No data available</div>
        )}
      </ResponsiveContainer>
    );
  }

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  
  useEffect(() => {
    const fetchData = async (showLoading = false) => {
      if (showLoading) setIsLoading(true);
      try {
        const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=dashboard`, {
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

    // Polling every 10 seconds (no loading spinner)
    const interval = setInterval(() => {
      fetchData(false);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

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

  const createDefaultAdmin = async () => {
    if (!window.confirm('This will create a default admin account with username "Admin" and password "password". Continue?')) {
      return;
    }

    try {
      // First, create the user
      const userResponse = await authorizedFetch(`${API_BASE}/auth/register.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'Admin',
          email: 'admin@example.com',
          password: 'password',
          first_name: 'System',
          last_name: 'Administrator',
          phone: '1234567890',
          country: 'Philippines'
        })
      });

      const userResult = await userResponse.json();
      
      if (!userResult.success) {
        throw new Error(userResult.error || 'Failed to create admin account');
      }

      // Then, assign admin role
      const roleResponse = await authorizedFetch(`${API_BASE}/index.php?endpoint=assign_role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userResult.user.id,
          role: 'Admin'
        })
      });

      const roleResult = await roleResponse.json();
      
      if (!roleResult.success) {
        throw new Error(roleResult.error || 'Failed to assign admin role');
      }

      alert('Admin account created successfully!\nUsername: Admin\nPassword: password\n\nPlease change the password after first login.');
      fetchData(); // Refresh the user list
    } catch (error) {
      console.error('Error creating admin account:', error);
      alert(`Error creating admin account: ${error.message}\n\n${error.response?.statusText || ''}`);
    }
  };

  // ... rest of the code remains the same ...

  const UserManagement = (props) => {
    // ... rest of the code remains the same ...

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
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, can_access_inventory: currentValue ? 0 : 1 } : u));
        } else {
          alert(result.error || 'Failed to update inventory access');
        }
      } catch (e) {
        alert('Error updating inventory access');
      }
    };

    // In UserManagement, add the handler:
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
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, can_access_orders: currentValue ? 0 : 1 } : u));
        } else {
          alert(result.error || 'Failed to update order access');
        }
      } catch (e) {
        alert('Error updating order access');
      }
    };

    // In UserManagement, add handler for chat support access
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
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, can_access_chat_support: currentValue ? 0 : 1 } : u));
        } else {
          alert(result.error || 'Failed to update chat support access');
        }
      } catch (e) {
        alert('Error updating chat support access');
      }
    };

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
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
        return <InventoryManagement inventory={inventory} categories={categories} user={user} />;
      case 'orders-management':
        return <OrdersManagement orders={orders} />;
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
              <Users className="h-10 w-10 text-indigo-500" />
              <div>
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">User Management</h2>
                <p className="text-gray-500 text-base mt-1">Create and manage users, roles, status, and access permissions.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Total users: {Array.isArray(users) ? users.length : 0}</div>
              <button className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2 font-semibold" onClick={() => setShowCreateUserModal(true)}>
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
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${active ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' : 'bg-green-600 text-white hover:bg-green-700'}`}
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
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${active ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' : 'bg-green-600 text-white hover:bg-green-700'}`}
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
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${active ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' : 'bg-green-600 text-white hover:bg-green-700'}`}
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
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="7" className="empty-state">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Create User Modal */}
            {showCreateUserModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCreateUserModal(false)}>
                <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Create User</h3>
                    <button className="text-gray-500 hover:text-gray-800" onClick={() => setShowCreateUserModal(false)}>×</button>
                  </div>
                  <form onSubmit={handleCreateUser} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Username</label>
                        <input required value={newUser.username} onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))} className="mt-1 block w-full border rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input required type="email" value={newUser.email} onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))} className="mt-1 block w-full border rounded px-3 py-2" />
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <PasswordInput
                          required
                          value={newUser.password}
                          onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                          className="mt-1 block w-full border rounded px-3 py-2"
                          placeholder="Enter password"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Role</label>
                        <select value={newUser.role} onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))} className="mt-1 block w-full border rounded px-3 py-2">
                          <option value="client">Client</option>
                          <option value="employee">Employee</option>
                          <option value="admin">Admin</option>
                          <option value="super admin">Super Admin</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setShowCreateUserModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                      <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Create</button>
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
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Top Seller</p>
                    <p className="text-base font-bold text-gray-900 truncate max-w-xs" title={topSeller}>{topSeller}</p>
                  </div>
                </div>
              </div>
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