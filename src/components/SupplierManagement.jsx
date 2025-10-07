import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/apiBase';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  AlertTriangle, 
  Package, 
  Users, 
  FileText, 
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  Archive,
  Bell,
  Send,
  History,
  RefreshCw,
  Check
} from 'lucide-react';

const SupplierManagement = ({ user }) => {
  const [activeTab, setActiveTab] = useState('suppliers');
  const [suppliers, setSuppliers] = useState([]);
  const [supplierOrders, setSupplierOrders] = useState([]);
  const [inventoryAlerts, setInventoryAlerts] = useState([]);
  const [lowStockComponents, setLowStockComponents] = useState([]);
  const [supplierNotifications, setSupplierNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [modalData, setModalData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [notificationForm, setNotificationForm] = useState({
    subject: '',
    message: '',
    type: 'general'
  });

  const token = localStorage.getItem('token');

  // Check if token is expired
  const isTokenExpired = (token) => {
    try {
      const part = token.split('.')[1];
      if (!part) return true;
      // base64url -> base64 with padding
      let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const payload = JSON.parse(atob(b64));
      if (!payload.exp) return false;
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  };

  // Fetch data functions
  const fetchSuppliers = async () => {
    try {
      if (!token || isTokenExpired(token)) {
        console.error('Token expired or missing');
        return;
      }
      
      const response = await fetch(`${API_BASE}/suppliers.php?endpoint=suppliers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 401) {
        console.error('Unauthorized - token may be invalid');
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setSuppliers(data.suppliers);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchSupplierOrders = async () => {
    try {
      if (!token || isTokenExpired(token)) {
        console.error('Token expired or missing');
        return;
      }
      
      const response = await fetch(`${API_BASE}/suppliers.php?endpoint=supplier-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 401) {
        console.error('Unauthorized - token may be invalid');
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setSupplierOrders(data.orders);
      }
    } catch (error) {
      console.error('Error fetching supplier orders:', error);
    }
  };

  const fetchInventoryAlerts = async () => {
    try {
      if (!token || isTokenExpired(token)) {
        console.error('Token expired or missing');
        return;
      }
      
      const response = await fetch(`${API_BASE}/suppliers.php?endpoint=inventory-alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 401) {
        console.error('Unauthorized - token may be invalid');
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setInventoryAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Error fetching inventory alerts:', error);
    }
  };

  const fetchLowStockComponents = async () => {
    try {
      if (!token || isTokenExpired(token)) {
        console.error('Token expired or missing');
        return;
      }
      
      const response = await fetch(`${API_BASE}/suppliers.php?endpoint=low-stock-components`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 401) {
        console.error('Unauthorized - token may be invalid');
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setLowStockComponents(data.components);
      }
    } catch (error) {
      console.error('Error fetching low stock components:', error);
    }
  };

  // Load data on component mount and when activeTab changes
  useEffect(() => {
    fetchSuppliers();
    
    if (activeTab === 'orders') {
      fetchSupplierOrders();
    } else if (activeTab === 'alerts') {
      fetchInventoryAlerts();
    } else if (activeTab === 'low-stock') {
      fetchLowStockComponents();
    } else if (activeTab === 'notifications') {
      fetchSupplierNotifications();
    }
  }, [activeTab]);

  // Handler functions
  const handleCreateSupplier = async (supplierData) => {
    try {
      if (!token || isTokenExpired(token)) {
        console.error('Token expired or missing');
        return;
      }
      
      const response = await fetch(`${API_BASE}/suppliers.php?endpoint=suppliers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(supplierData)
      });
      
      if (response.status === 401) {
        console.error('Unauthorized - token may be invalid');
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        fetchSuppliers();
        setShowModal(false);
        setModalData({});
      }
    } catch (error) {
      console.error('Error creating supplier:', error);
    }
  };

  const handleUpdateSupplier = async (id, supplierData) => {
    try {
      if (!token || isTokenExpired(token)) {
        console.error('Token expired or missing');
        return;
      }
      
      const response = await fetch(`${API_BASE}/suppliers.php?endpoint=supplier&id=${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(supplierData)
      });
      
      if (response.status === 401) {
        console.error('Unauthorized - token may be invalid');
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        fetchSuppliers();
        setShowModal(false);
        setModalData({});
      }
    } catch (error) {
      console.error('Error updating supplier:', error);
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (confirm('Are you sure you want to delete this supplier?')) {
      try {
        if (!token || isTokenExpired(token)) {
          console.error('Token expired or missing');
          return;
        }
        
        const response = await fetch(`${API_BASE}/suppliers.php?endpoint=supplier&id=${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 401) {
          console.error('Unauthorized - token may be invalid');
          return;
        }
        
        const data = await response.json();
        if (data.success) {
          fetchSuppliers();
        }
      } catch (error) {
        console.error('Error deleting supplier:', error);
      }
    }
  };

  const handleResolveAlert = async (alertId, notes) => {
    try {
      if (!token || isTokenExpired(token)) {
        console.error('Token expired or missing');
        return;
      }
      
      const response = await fetch(`${API_BASE}/suppliers.php?endpoint=resolve-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ alert_id: alertId, notes })
      });
      
      if (response.status === 401) {
        console.error('Unauthorized - token may be invalid');
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        fetchInventoryAlerts();
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const openModal = (type, data = {}) => {
    setModalType(type);
    setModalData(data);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setModalData({});
  };

  // Helper functions
  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'in_transit': return 'bg-yellow-100 text-yellow-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertTypeColor = (alertType) => {
    switch (alertType) {
      case 'low_stock': return 'bg-yellow-100 text-yellow-800';
      case 'out_of_stock': return 'bg-red-100 text-red-800';
      case 'reorder_point': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter data based on search and status
  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrders = supplierOrders.filter(order => {
    const matchesSearch = order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredAlerts = inventoryAlerts.filter(alert =>
    alert.component_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    alert.alert_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs = [
    { id: 'suppliers', name: 'Suppliers', icon: <Users className="h-4 w-4" /> },
    { id: 'orders', name: 'Orders', icon: <FileText className="h-4 w-4" /> },
    { id: 'alerts', name: 'Inventory Alerts', icon: <AlertTriangle className="h-4 w-4" /> },
    { id: 'low-stock', name: 'Low Stock', icon: <Package className="h-4 w-4" /> }
  ];

  return (
    <div>
      <div className="space-y-10 px-2 md:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Package className="h-10 w-10 text-indigo-500" />
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Supplier Management</h2>
            <p className="text-gray-500 text-base mt-1">Manage suppliers, orders, and inventory alerts efficiently.</p>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-lg border p-6 transition hover:shadow-2xl">
          {/* Tabs Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {tab.icon}
                    {tab.name}
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
              {activeTab === 'orders' && (
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              )}
            </div>
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === 'suppliers' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Users className="h-5 w-5 text-indigo-500" />
                      Suppliers
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Manage your supplier relationships and partnerships</p>
                  </div>
                  <button
                    onClick={() => openModal('supplier')}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors duration-200 flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl"
                  >
                    <Plus className="h-4 w-4" />
                    Add Supplier
                  </button>
                </div>
                <SuppliersTab
                  suppliers={filteredSuppliers}
                  onEdit={openModal}
                  onDelete={handleDeleteSupplier}
                  onView={openModal}
                />
              </div>
            )}

            {activeTab === 'orders' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-green-500" />
                      Supplier Orders
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Track and manage supplier orders and deliveries</p>
                  </div>
                  <button
                    onClick={() => openModal('order')}
                    className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-colors duration-200 flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl"
                  >
                    <Plus className="h-4 w-4" />
                    New Order
                  </button>
                </div>
                <OrdersTab
                  orders={filteredOrders}
                  onView={openModal}
                  onEdit={openModal}
                />
              </div>
            )}

            {activeTab === 'alerts' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Inventory Alerts
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Monitor and resolve inventory alerts proactively</p>
                  </div>
                </div>
                <AlertsTab
                  alerts={filteredAlerts}
                  onResolve={handleResolveAlert}
                />
              </div>
            )}

            {activeTab === 'low-stock' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Package className="h-5 w-5 text-orange-500" />
                      Low Stock Components
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Components that need immediate restocking</p>
                  </div>
                </div>
                <LowStockTab
                  components={lowStockComponents}
                  onOrder={(component) => {
                    setModalType('order-component');
                    setModalData({ component });
                    setShowModal(true);
                  }}
                />
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold mb-4">Send Notification to Supplier</h2>
                  <form onSubmit={sendNotificationToSupplier} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                      <select
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={notificationForm.supplierId || ''}
                        onChange={(e) => setNotificationForm({...notificationForm, supplierId: e.target.value})}
                        required
                      >
                        <option value="">Select a supplier</option>
                        {suppliers.map(supplier => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name} ({supplier.contact_person || 'No contact'})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notification Type</label>
                      <select
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={notificationForm.type}
                        onChange={(e) => setNotificationForm({...notificationForm, type: e.target.value})}
                      >
                        <option value="general">General Message</option>
                        <option value="order_placed">Order Placed</option>
                        <option value="payment_reminder">Payment Reminder</option>
                        <option value="inventory_alert">Inventory Alert</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Notification subject"
                        value={notificationForm.subject}
                        onChange={(e) => setNotificationForm({...notificationForm, subject: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                      <textarea
                        className="w-full p-2 border border-gray-300 rounded-md h-32"
                        placeholder="Type your message here..."
                        value={notificationForm.message}
                        onChange={(e) => setNotificationForm({...notificationForm, message: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Notification
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
                
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900 flex items-center">
                      <History className="w-5 h-5 mr-2 text-gray-500" />
                      Notification History
                    </h2>
                  </div>
                  
                  {loading ? (
                    <div className="p-8 text-center text-gray-500">
                      <RefreshCw className="w-8 h-8 mx-auto animate-spin" />
                      <p className="mt-2">Loading notifications...</p>
                    </div>
                  ) : supplierNotifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <p>No notifications found</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {supplierNotifications.map((notification) => (
                        <div key={notification.id} className="p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium text-gray-900">
                                {notification.subject}
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">
                                {new Date(notification.created_at).toLocaleString()}
                                {notification.communication_type && (
                                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                                    {notification.communication_type}
                                  </span>
                                )}
                              </p>
                              <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">
                                {notification.message}
                              </p>
                            </div>
                            <div className="flex items-center">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                notification.status === 'delivered' 
                                  ? 'bg-green-100 text-green-800' 
                                  : notification.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {notification.status}
                              </span>
                            </div>
                          </div>
                          {notification.notes && (
                            <div className="mt-2 p-2 bg-gray-50 text-sm text-gray-600 rounded">
                              <span className="font-medium">Notes:</span> {notification.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <Modal
            type={modalType}
            data={modalData}
            onClose={closeModal}
            onSubmit={modalType === 'supplier' ? handleCreateSupplier : null}
            onUpdate={modalType === 'supplier' ? handleUpdateSupplier : null}
            suppliers={suppliers}
            lowStockComponents={lowStockComponents}
            getStatusColor={getStatusColor}
          />
        )}
      </div>
    </div>
  );
};

// Tab Components
const SuppliersTab = ({ suppliers, onEdit, onDelete, onView }) => (
  <div className="bg-white rounded-2xl shadow-lg border overflow-hidden transition hover:shadow-2xl">
    {suppliers.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Supplier
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Contact Info
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Communication
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{supplier.name}</div>
                    <div className="text-sm text-gray-500">{supplier.address}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{supplier.contact_person}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {supplier.phone}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {supplier.email}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {supplier.communication_method === 'email' && <Mail className="h-4 w-4 text-blue-500" />}
                    {supplier.communication_method === 'phone' && <Phone className="h-4 w-4 text-green-500" />}
                    {supplier.communication_method === 'messenger' && <MessageSquare className="h-4 w-4 text-blue-600" />}
                    {supplier.communication_method === 'sms' && <Phone className="h-4 w-4 text-green-500" />}
                    <span className="text-sm text-gray-900">{supplier.communication_handle}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                    supplier.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {supplier.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onView('supplier-view', supplier)}
                      className="text-indigo-600 hover:text-indigo-900 p-2 rounded-lg hover:bg-indigo-50 transition-colors duration-150"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onEdit('supplier', supplier)}
                      className="text-green-600 hover:text-green-900 p-2 rounded-lg hover:bg-green-50 transition-colors duration-150"
                      title="Edit Supplier"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(supplier.id)}
                      className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors duration-150"
                      title="Delete Supplier"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="text-center py-16">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Package className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No suppliers found</h3>
        <p className="text-gray-500 mb-4">Get started by adding your first supplier to manage your inventory effectively.</p>
        <button 
          onClick={() => onEdit('supplier', {})}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors duration-200 font-semibold shadow-lg hover:shadow-xl"
        >
          Add First Supplier
        </button>
      </div>
    )}
  </div>
);

const OrdersTab = ({ orders, onView, onEdit }) => (
  <div className="bg-white rounded-2xl shadow-lg border overflow-hidden transition hover:shadow-2xl">
    {orders.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Order
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Supplier
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{order.order_number}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(order.order_date).toLocaleDateString()}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm text-gray-900">{order.supplier_name}</div>
                    <div className="text-sm text-gray-500">{order.contact_person}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                    order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    order.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                    order.status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' :
                    order.status === 'sent' ? 'bg-purple-100 text-purple-800' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.status?.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                  ₱{parseFloat(order.total_amount || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onView('order-view', order)}
                      className="text-indigo-600 hover:text-indigo-900 p-2 rounded-lg hover:bg-indigo-50 transition-colors duration-150"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onEdit('order', order)}
                      className="text-green-600 hover:text-green-900 p-2 rounded-lg hover:bg-green-50 transition-colors duration-150"
                      title="Edit Order"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No orders</h3>
        <p className="mt-1 text-sm text-gray-500">Create your first supplier order.</p>
        <button 
          onClick={() => onEdit('order', {})}
          className="mt-4 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-colors duration-200 font-semibold shadow-lg hover:shadow-xl"
        >
          Create First Order
        </button>
      </div>
    )}
  </div>
);

const AlertsTab = ({ alerts, onResolve }) => {
  const getAlertTypeColor = (alertType) => {
    switch (alertType) {
      case 'low_stock': return 'bg-yellow-100 text-yellow-800';
      case 'out_of_stock': return 'bg-red-100 text-red-800';
      case 'reorder_point': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border overflow-hidden transition hover:shadow-2xl">
      {alerts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Component
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Alert Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Current Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{alert.component_name}</div>
                      <div className="text-sm text-gray-500">Category: {alert.category_id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getAlertTypeColor(alert.alert_type)}`}>
                      {alert.alert_type?.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-gray-900 font-semibold">{alert.current_stock}</div>
                      <div className="text-sm text-gray-500">Threshold: {alert.threshold_level}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                      alert.is_resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {alert.is_resolved ? 'Resolved' : 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {!alert.is_resolved && (
                      <button
                        onClick={() => onResolve(alert.id, 'Resolved by admin')}
                        className="text-green-600 hover:text-green-900 p-2 rounded-lg hover:bg-green-50 transition-colors duration-150"
                        title="Resolve Alert"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No alerts</h3>
          <p className="mt-1 text-sm text-gray-500">All inventory levels are adequate.</p>
        </div>
      )}
    </div>
  );
};

const LowStockTab = ({ components, onOrder }) => (
  <div className="bg-white rounded-2xl shadow-lg border overflow-hidden transition hover:shadow-2xl">
    {components.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Component
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Stock Level
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {components.map((component) => (
              <tr key={component.id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{component.name}</div>
                    <div className="text-sm text-gray-500">{component.brand} {component.model}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {component.category_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm text-gray-900 font-semibold">{component.stock_quantity}</div>
                    <div className="text-sm text-gray-500">Min: {component.min_stock_level}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                    component.stock_status === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                    component.stock_status === 'low_stock' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {component.stock_status?.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => onOrder('order', { component_id: component.id })}
                    className="text-orange-600 hover:text-orange-900 p-2 rounded-lg hover:bg-orange-50 transition-colors duration-150"
                    title="Create Order"
                  >
                    <ShoppingCart className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No low stock components</h3>
        <p className="mt-1 text-sm text-gray-500">All inventory levels are adequate.</p>
      </div>
    )}
  </div>
);

// Modal Component
const Modal = ({ type, data, onClose, onSubmit, onUpdate, suppliers, lowStockComponents, getStatusColor }) => {
  const [formData, setFormData] = useState(data || {});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData(data || {});
  }, [data]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (type === 'supplier') {
        if (data?.id) {
          await onUpdate(data.id, formData);
        } else {
          await onSubmit(formData);
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderModalContent = () => {
    switch (type) {
      case 'supplier':
        return (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Company Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  placeholder="Enter company name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Person</label>
                <input
                  type="text"
                  value={formData.contact_person || ''}
                  onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  placeholder="Enter contact person name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  placeholder="Enter phone number"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
              <textarea
                value={formData.address || ''}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                placeholder="Enter complete address"
              />
            </div>
          </form>
        );

      case 'supplier-view':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="mt-1 text-sm text-gray-900">{data?.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Person</label>
                <p className="mt-1 text-sm text-gray-900">{data?.contact_person}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{data?.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <p className="mt-1 text-sm text-gray-900">{data?.phone}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <p className="mt-1 text-sm text-gray-900">{data?.address}</p>
            </div>
          </div>
        );

      case 'order-view':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Order Number</label>
                <p className="mt-1 text-sm text-gray-900">{data?.order_number}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Supplier</label>
                <p className="mt-1 text-sm text-gray-900">{data?.supplier_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Order Date</label>
                <p className="mt-1 text-sm text-gray-900">
                  {data?.order_date ? new Date(data.order_date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor ? getStatusColor(data?.status) : 'bg-gray-100 text-gray-800'}`}>
                  {data?.status?.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Total Amount</label>
              <p className="mt-1 text-sm text-gray-900">₱{parseFloat(data?.total_amount || 0).toFixed(2)}</p>
            </div>
          </div>
        );

      default:
        return <div>Modal content not available</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transition hover:shadow-3xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-900">
              {type === 'supplier' && data?.id ? 'Edit Supplier' : 
               type === 'supplier' ? 'Add New Supplier' :
               type === 'supplier-view' ? 'Supplier Details' :
               type === 'order-view' ? 'Order Details' : 'Modal'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-150"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {renderModalContent()}
        </div>
        
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-2xl">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors duration-200"
            >
              Cancel
            </button>
            {type === 'supplier' && (
              <button
                type="submit"
                disabled={loading}
                onClick={handleSubmit}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {data?.id ? 'Update Supplier' : 'Create Supplier'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierManagement;
