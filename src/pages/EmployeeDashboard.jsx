import React, { useState, useEffect } from 'react'
import { API_BASE } from '../utils/apiBase'
import { authorizedFetch } from '../utils/auth'
import { 
  BarChart3, 
  Package, 
  Users, 
  MessageSquare, 
  Settings, 
  Plus,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  TrendingUp,
  Monitor,
  FileText
} from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { formatCurrencyPHP } from '../utils/currency';
import { getComponentImage } from '../utils/componentImages';
// EmployeeSidebar is now handled by App.jsx, so we don't need to import it here
import AdminPCAssembly from './AdminPCAssembly';
import SuperAdminPrebuiltPCs from './SuperAdminPrebuiltPCs.jsx';
import DynamicChatAccess from '../components/DynamicChatAccess';
import { useNotifications } from '../contexts/NotificationContext';
import Notifications from './Notifications.jsx';
import NotificationToast from '../components/NotificationToast';
import PCAssembly from './PCAssembly.jsx';
import AdminReports from '../components/AdminReports';
import SystemReports from '../components/SystemReports';

// Helper: check JWT expiry (base64url safe)
function isTokenExpired(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return true;
    let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payload = JSON.parse(atob(b64));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

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

const EmployeeDashboard = ({ initialTab, user, setUser }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'employee-dashboard')
  
  // sync the activeTab with the current page from App.jsx
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab, activeTab])
  const [inventory, setInventory] = useState([])
  const [orders, setOrders] = useState([])
  const [reports, setReports] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboardSalesChartType, setDashboardSalesChartType] = useState('monthly')
  const [categories, setCategories] = useState([])
  const [modalItem, setModalItem] = useState(null)
  const [editItem, setEditItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  // Branch filter: null = All (global), or 'BULACAN' / 'MARIKINA'
  const [branch, setBranch] = useState(null);
  const { unreadCount, notifications, markAsRead } = useNotifications();
  const [showToast, setShowToast] = useState(true);
  const [initialInventoryAccess, setInitialInventoryAccess] = useState(user?.can_access_inventory);



  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/index.php?endpoint=dashboard${branch ? `&branch=${branch}` : ''}` , {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (jsonErr) {
          setError('Server returned invalid JSON.');
          return;
        }
        if (result.success) {
          const data = result.data;
          setInventory(data.inventory || []);
          setOrders(data.orders || []);
          setReports(data.reports || {});
        } else {
          setError(result.error || 'API call was not successful');
        }
      } catch (error) {
        setError('Error fetching dashboard data.');
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [branch]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_BASE}/index.php?endpoint=categories`);
        const result = await response.json();
        if (result.success) {
          setCategories(result.data);
        }
      } catch (e) {}
    };
    fetchCategories();
  }, []);

  // Helper for InventoryTab
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
  const categoryKeyToIds = {};
  mainCategories.forEach(cat => {
    categoryKeyToIds[cat.key] = categories
      .filter(c => cat.names.includes(c.name))
      .map(c => String(c.id));
  });
  const getMainCategoryKey = (item) => {
    const cat = categories.find(c => c.id === Number(item.category_id));
    if (!cat) return null;
    for (const mainCat of mainCategories) {
      if (mainCat.names.includes(cat.name)) return mainCat.key;
    }
    return null;
  };
  const filteredComponentItems = inventory.filter(item => getMainCategoryKey(item));
  const allBrands = Array.from(new Set(
    filteredComponentItems
      .map(item => (item.brand || '').trim())
      .filter(Boolean)
      .map(b => b.toLowerCase())
  ));
  const displayBrands = allBrands.map(b => b.charAt(0).toUpperCase() + b.slice(1));
  const brandOptions = ['all'];
  if (allBrands.includes('amd')) brandOptions.push('AMD');
  if (allBrands.includes('intel')) brandOptions.push('Intel');
  brandOptions.push(...displayBrands.filter(b => b !== 'Amd' && b !== 'Intel'));

  // InventoryTab filtering
  let filtered = inventory.filter(item => {
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

  // DashboardOverview
  const DashboardOverview = () => {
    const totalSales = reports?.monthly_sales?.[0]?.total_sales || 0;
    const deadstockCount = reports?.deadstock?.length || 0;
    const topSeller = reports?.top_selling_products?.[0]?.name || 'N/A';
    let dashboardSalesChartData = [];
    let dashboardSalesChartTitle = '';
    let dashboardSalesChartComponent = null;
    if (dashboardSalesChartType === 'monthly') {
      dashboardSalesChartData = reports?.monthly_sales || [];
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
    } else if (dashboardSalesChartType === 'daily') {
      dashboardSalesChartData = reports?.daily_sales || [];
      dashboardSalesChartTitle = 'Daily Sales (Last 30 Days)';
      dashboardSalesChartComponent = (
        <ResponsiveContainer width="100%" height={200}>
          {dashboardSalesChartData.length > 0 ? (
            <ReBarChart data={dashboardSalesChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" label={{ value: 'Day', position: 'insideBottomRight', offset: 0 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total_sales" fill="#36A2EB" />
            </ReBarChart>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-lg">No data available</div>
          )}
        </ResponsiveContainer>
      );
    }
    return (
      <div className="space-y-6">
        {/* Stats Cards */}
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
                    Total: {formatCurrencyPHP(reports?.deadstock_total_value || 0)}
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
        {/* Sales Chart Dropdown */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <label htmlFor="dashboard-sales-chart-type" className="block text-sm font-medium text-gray-700 mb-1">Select Sales Chart:</label>
            <select
              id="dashboard-sales-chart-type"
              className="border rounded px-4 py-2 text-base focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
              value={dashboardSalesChartType}
              onChange={e => setDashboardSalesChartType(e.target.value)}
            >
              <option value="monthly">Monthly Sales</option>
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
        {/* Recent Orders */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h3>
          <div className="overflow-x-auto">
            <table className="table-ui">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer ID</th>
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
                    <td className="whitespace-nowrap text-sm text-gray-900">{formatCurrencyPHP(order.total_price)}</td>
                    <td className="whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        order.status === 'Completed' ? 'bg-green-100 text-green-800' :
                        order.status === 'Processing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-sm text-gray-900">{order.order_date}</td>
                  </tr>
                )) : <tr><td colSpan="5" className="text-center py-4">No order data available.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // InventoryTab
  const InventoryTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="page-title">Inventory Management</h2>
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
        {/* Employee should NOT create or delete products per requirements; only view and modify.
            Show Add button only if user is admin or superadmin. */}
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <button
            className="bg-indigo-600 text-white px-5 py-2 rounded-xl hover:bg-indigo-700 flex items-center gap-2 shadow-lg"
            onClick={() => setEditItem({})}
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        )}
      </div>
      {/* Search, Filter, Sort Controls */}
      <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between mb-2">
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
      <div className="bg-white rounded-2xl shadow-lg border overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-20 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Image</th>
              <th className="w-1/5 px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="w-1/6 px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="w-1/6 px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand</th>
              <th className="w-1/12 px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
              <th className="w-1/12 px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
              <th className="w-1/12 px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(filtered && filtered.length > 0) ? filtered.map((item) => {
              const cat = categories.find(c => String(c.id) === String(item.category_id));
              const displayCat = cat ? (formalCategoryNames[cat.name] || cat.name) : item.category_id;
              const imgSrc = getComponentImage(item.name);
              return (
                <tr key={item.id}>
                  <td className="w-20 px-4 py-4 whitespace-nowrap align-middle">
                    <img
                      src={imgSrc}
                      alt={item.name}
                      className="w-14 h-14 object-contain rounded border cursor-pointer hover:shadow-lg transition duration-150"
                      onClick={() => setModalItem(item)}
                      onError={e => { e.target.onerror = null; e.target.src = '/images/components/default.png'; }}
                    />
                  </td>
                  <td className="px-2 py-4 whitespace-normal text-sm font-medium text-gray-900 break-words max-w-md flex items-center gap-3 truncate" style={{ maxWidth: '320px' }} title={item.name}>
                    {item.name}
                  </td>
                  <td className="w-1/6 px-2 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-xs" title={displayCat}>{displayCat}</td>
                  <td className="w-1/6 px-2 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-[80px]" title={item.brand}>{item.brand}</td>
                  <td className="w-1/12 px-2 py-4 whitespace-nowrap text-sm text-gray-900 max-w-[80px]">{formatCurrencyPHP(item.price)}</td>
                  <td className="w-1/12 px-2 py-4 whitespace-nowrap text-sm text-gray-900">{item.stock_quantity || item.stock}</td>
                  <td className="w-1/12 px-2 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      className="text-blue-600 hover:text-blue-900"
                      onClick={() => setEditItem(item)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    {/* Employees can't delete; only admins/superadmins can. */}
                    {(user?.role === 'admin' || user?.role === 'superadmin') && (
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={async () => {
                          if (!window.confirm(`Delete '${item.name}'?`)) return;
                          try {
                            const token = localStorage.getItem('token');
                            // Assumption: backend supports delete_component via POST
                            const res = await fetch(`${API_BASE}/index.php?endpoint=delete_component`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                              body: JSON.stringify({ id: item.id })
                            });
                            const result = await res.json();
                            if (result.success) {
                              setInventory(prev => prev.filter(i => i.id !== item.id));
                              setModalItem(null);
                              alert('Deleted successfully');
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
                    )}
                  </td>
                </tr>
              );
            }) : <tr><td colSpan="7" className="text-center py-4">No inventory data available.</td></tr>}
          </tbody>
        </table>
      </div>
      {/* Modal for enlarged image and details */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setModalItem(null)}>
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-2xl w-full relative flex flex-col md:flex-row gap-8">
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
                <span className="inline-block bg-blue-100 text-blue-700 rounded px-3 py-1 text-base font-semibold">
                  {(() => {
                    const cat = categories.find(c => String(c.id) === String(modalItem.category_id));
                    return cat ? (formalCategoryNames[cat.name] || cat.name) : modalItem.category_id;
                  })()}
                </span>
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
                  <ul className="list-disc list-inside text-base text-gray-600">
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
      {/* Edit / Create Modal (used by Employee to modify only; Admin/Superadmin can create) */}
      {editItem !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setEditItem(null)}>
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-2xl w-full relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" onClick={() => setEditItem(null)}>×</button>
            <h3 className="text-xl font-bold mb-4">{editItem.id ? 'Edit Product' : 'Add Product'}</h3>
            <EditForm
              item={editItem}
              categories={categories}
              onCancel={() => setEditItem(null)}
              onSave={async (saved) => {
                // saved is the returned/updated item from API
                if (saved) {
                  setInventory(prev => {
                    if (editItem.id) {
                      return prev.map(p => p.id === saved.id ? saved : p);
                    }
                    return [saved, ...prev];
                  });
                }
                setEditItem(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  // OrdersTab
  const OrdersTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="page-title">Orders Management</h2>
        <button className="bg-indigo-600 text-white px-5 py-2 rounded-xl hover:bg-indigo-700 flex items-center gap-2 shadow-lg">
          <Plus className="h-4 w-4" />
          Add Order
        </button>
      </div>
      <div className="bg-white rounded-2xl shadow-lg border overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Order ID</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(orders && orders.length > 0) ? orders.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{order.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.user_id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrencyPHP(order.total_price)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    order.status === 'Completed' ? 'bg-green-100 text-green-800' :
                    order.status === 'Processing' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.order_date}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button className="text-blue-600 hover:text-blue-900">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button className="text-red-600 hover:text-red-900">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            )) : <tr><td colSpan="6" className="text-center py-4">No order data available.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  // EmployeePCAssembly wraps PCAssembly for employee use
  const EmployeePCAssembly = (props) => {
    return (
      <div>
        <PCAssembly {...props} />
      </div>
    );
  };

  // EmployeePrebuiltPCs wraps SuperAdminPrebuiltPCs for employee use
  const EmployeePrebuiltPCs = (props) => {
    return (
      <div>
        <SuperAdminPrebuiltPCs {...props} />
      </div>
    );
  };

  // Main renderContent
  const renderContent = () => {
    switch (activeTab) {
      case 'employee-dashboard':
        return <DashboardOverview />
      case 'inventory':
        if (user.can_access_inventory === 0 || user.can_access_inventory === '0' || user.can_access_inventory === false || user.can_access_inventory === 'false') {
          return (
            <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-6 py-4 rounded-2xl text-center max-w-lg mx-auto mt-24">
              <h2 className="text-2xl font-bold mb-2">Inventory Access Disabled</h2>
              <p className="text-lg">Your access to Inventory Management has been disabled by a Super Admin. If you believe this is a mistake, please contact your administrator.</p>
            </div>
          );
        }
        return <InventoryTab />
      case 'orders-management':
        return <OrdersTab />
      case 'admin-chat-support':
        return <DynamicChatAccess user={user} fullScreen={true} />;
      case 'notifications':
        return <Notifications user={user} />
      case 'pc-assembly':
        return <EmployeePCAssembly user={user} />
      case 'prebuilt-management':
        return <EmployeePrebuiltPCs user={user} />
      case 'sales-reports':
        return <AdminReports reports={reports} orders={orders} />
      case 'system-reports':
        return <SystemReports reports={reports} inventory={inventory} categories={categories} formalCategoryNames={formalCategoryNames} />;
      default:
        return <DashboardOverview />
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user'); // In case user info is stored
    window.location.href = '/'; // Redirect to landing page
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/'; // Redirect to landing page if not logged in
    }
  }, []);

  useEffect(() => {
    // Fetch the latest user profile on every tab change
    const fetchProfile = async () => {
      try {
        const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=profile`, { method: 'GET' });
        if (res.status === 401) return;
        const data = await res.json().catch(() => ({}));
        if (data.success && data.user) {
          if (setUser) setUser(data.user);
        }
      } catch {}
    };
    fetchProfile();
  }, [activeTab, setUser]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await authorizedFetch(`${API_BASE}/index.php?endpoint=profile`, { method: 'GET' });
        if (res.status === 401) return;
        const data = await res.json().catch(() => ({}));
        if (data.success && data.user) {
          if (typeof initialInventoryAccess !== 'undefined' && data.user.can_access_inventory !== initialInventoryAccess) {
            window.location.reload();
          }
          if (setUser) setUser(data.user);
        }
      } catch (e) {
        // Optionally handle error
      }
    }, 10000); // every 10 seconds
    return () => clearInterval(interval);
  }, [setUser, initialInventoryAccess]);

  // Find the latest unread notification for toast
  const latestUnread = notifications && notifications.length > 0 ? notifications.find(n => !n.read) : null;

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  // If inventory access is disabled, show message if user tries to access it
  const inventoryAccessDisabled = user.can_access_inventory === 0;
  if (inventoryAccessDisabled && (activeTab === 'inventory')) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-6 py-4 rounded-2xl text-center max-w-lg mx-auto">
          <h2 className="text-2xl font-bold mb-2">Inventory Access Disabled</h2>
          <p className="text-lg">Your access to Inventory Management has been disabled by a Super Admin. If you believe this is a mistake, please contact your administrator.</p>
        </div>
      </div>
    );
  }

  // Special handling for chat support to render without padding wrapper
  if (activeTab === 'admin-chat-support') {
    return (
      <>
        {renderContent()}
        {/* Notification Toast */}
        {latestUnread && showToast && (
          <NotificationToast
            notification={latestUnread}
            onClose={() => setShowToast(false)}
            onMarkAsRead={() => markAsRead(latestUnread.id)}
          />
        )}
      </>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="text-center text-red-600 py-8">{error}</div>
      ) : renderContent()}
      {/* Notification Toast */}
      {latestUnread && showToast && (
        <NotificationToast
          notification={latestUnread}
          onClose={() => setShowToast(false)}
          onMarkAsRead={() => markAsRead(latestUnread.id)}
        />
      )}
    </div>
  )
}

export default EmployeeDashboard 

// Small reusable form component used by dashboards for creating/updating components
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
  const [branchStocks, setBranchStocks] = React.useState({ BULACAN: '', MARIKINA: '' });
  const [loadingBranch, setLoadingBranch] = React.useState(false);

  const handleChange = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const endpoint = form.id ? 'update_component' : 'create_component';
      // NOTE: backend endpoints are assumed (create_component/update_component). If they differ, adapt accordingly.
      const res = await fetch(`${API_BASE}/index.php?endpoint=${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const result = await res.json();
      if (!result.success) {
        alert(result.error || 'Save failed');
        setSaving(false);
        return;
      }
      // Update per-branch stocks if provided
      let saved = result.data || { ...form, id: form.id || (result.data && result.data.id) };
      const compId = saved.id || form.id;
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
      const toInt = v => (v === '' || v === null || v === undefined) ? null : parseInt(v, 10);
      const bul = toInt(branchStocks.BULACAN);
      const mar = toInt(branchStocks.MARIKINA);
      const calls = [];
      if (compId) {
        if (bul !== null && !Number.isNaN(bul)) {
          calls.push(fetch(`${API_BASE}/update_component_stock.php`, { method: 'POST', headers, body: JSON.stringify({ component_id: compId, branch: 'BULACAN', stock_quantity: bul }) }));
        }
        if (mar !== null && !Number.isNaN(mar)) {
          calls.push(fetch(`${API_BASE}/update_component_stock.php`, { method: 'POST', headers, body: JSON.stringify({ component_id: compId, branch: 'MARIKINA', stock_quantity: mar }) }));
        }
      }
      if (calls.length) {
        await Promise.allSettled(calls);
        const total = (Number.isFinite(bul) ? bul : 0) + (Number.isFinite(mar) ? mar : 0);
        saved = { ...saved, stock_quantity: total };
      }
      onSave(saved);
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
      {form.id && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Bulacan Stock</label>
            <input type="number" value={branchStocks.BULACAN} onChange={e => setBranchStocks(s => ({ ...s, BULACAN: e.target.value }))} className="mt-1 block w-full border rounded px-3 py-2" disabled={loadingBranch} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Marikina Stock</label>
            <input type="number" value={branchStocks.MARIKINA} onChange={e => setBranchStocks(s => ({ ...s, MARIKINA: e.target.value }))} className="mt-1 block w-full border rounded px-3 py-2" disabled={loadingBranch} />
          </div>
        </div>
      )}
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