import React, { useState, useEffect } from 'react';
import { formatCurrencyPHP } from '../utils/currency';
import { ShoppingCart, Trash2, Plus, Minus, X, Package, AlertCircle, CheckCircle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE } from '../utils/apiBase';
import { getComponentImage } from '../utils/componentImages';

const Cart = ({ setCurrentPage, user, onShowAuth }) => {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [total, setTotal] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  const [expandedPrebuilts, setExpandedPrebuilts] = useState(new Set());
  const [prebuiltComponents, setPrebuiltComponents] = useState({});
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactFullName, setContactFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [contactError, setContactError] = useState('');

  // Robust base64url JWT expiry check
  const isTokenExpired = (token) => {
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
  };

  // Load cart from backend
  const fetchCart = async (showCleanupMessage = false) => {
    try {
      const token = localStorage.getItem('token');
      if (!token || isTokenExpired(token)) {
        setCartItems([]);
        setLoading(false);
        if (!user && onShowAuth) {
          onShowAuth();
        }
        return;
      }

      const res = await fetch(`${API_BASE}/index.php?endpoint=cart`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401) {
        setCartItems([]);
        setLoading(false);
        if (onShowAuth) {
          onShowAuth();
        }
        return;
      }

      const data = await res.json();
      if (data && data.success) {
        const items = data.data || [];
        setCartItems(items);
        setTotal(data.total || 0);
        setItemCount(data.item_count || 0);
        
        // Auto-select all items when cart is loaded
        const allItemIds = new Set(items.map(item => item.id));
        setSelectedItems(allItemIds);
        
        // Show message if cleanup was triggered manually
        if (showCleanupMessage && data.cleanup_message) {
          alert(data.cleanup_message);
        }
        
        // Fetch components for prebuilts
        const prebuiltItems = items.filter(item => item.item_type === 'prebuilt' || item.prebuilt_id);
        if (prebuiltItems.length > 0) {
          const componentPromises = prebuiltItems.map(async (item) => {
            if (!item.component_ids) return { prebuiltId: item.prebuilt_id, components: [] };
            
            let componentIds = item.component_ids;
            if (typeof componentIds === 'string') {
              try {
                componentIds = JSON.parse(componentIds);
              } catch (e) {
                return { prebuiltId: item.prebuilt_id, components: [] };
              }
            }
            
            const ids = Object.values(componentIds)
              .map(v => typeof v === 'string' ? parseInt(v, 10) : v)
              .filter(v => Number.isFinite(v) && v > 0);
            
            if (ids.length === 0) {
              return { prebuiltId: item.prebuilt_id, components: [] };
            }
            
            try {
              const url = `${API_BASE}/get_components_by_ids.php?ids=${ids.join(',')}`;
              const response = await fetch(url);
              const result = await response.json();
              if (result.success && result.data) {
                return { prebuiltId: item.prebuilt_id, components: result.data };
              }
            } catch (e) {
              console.error('Error fetching prebuilt components:', e);
            }
            return { prebuiltId: item.prebuilt_id, components: [] };
          });
          
          const results = await Promise.all(componentPromises);
          const componentsMap = {};
          results.forEach(({ prebuiltId, components }) => {
            if (prebuiltId) {
              componentsMap[prebuiltId] = components;
            }
          });
          setPrebuiltComponents(componentsMap);
        }
      } else {
        setCartItems([]);
        setTotal(0);
        setItemCount(0);
      }
    } catch (e) {
      console.error('Error loading cart:', e);
      setCartItems([]);
      setTotal(0);
      setItemCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [user]);

  // Update quantity
  const handleUpdateQuantity = async (cartItemId, newQuantity) => {
    if (newQuantity < 1) return;

    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token)) {
      if (onShowAuth) {
        onShowAuth();
      }
      return;
    }

    setUpdating(cartItemId);
    try {
      const res = await fetch(`${API_BASE}/index.php?endpoint=cart`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cart_item_id: cartItemId,
          quantity: newQuantity
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchCart(); // Refresh cart
      } else {
        alert(data.error || 'Failed to update quantity');
      }
    } catch (e) {
      console.error('Error updating quantity:', e);
      alert('Failed to update quantity');
    } finally {
      setUpdating(null);
    }
  };

  // Remove item from cart
  const handleRemoveItem = async (cartItemId) => {
    if (!window.confirm('Remove this item from cart?')) return;

    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token)) {
      if (onShowAuth) {
        onShowAuth();
      }
      return;
    }

    setUpdating(cartItemId);
    try {
      const res = await fetch(`${API_BASE}/index.php?endpoint=cart&id=${cartItemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchCart(); // Refresh cart
      } else {
        alert(data.error || 'Failed to remove item');
      }
    } catch (e) {
      console.error('Error removing item:', e);
      alert('Failed to remove item');
    } finally {
      setUpdating(null);
    }
  };

  // Clear entire cart
  const handleClearCart = async () => {
    if (!window.confirm('Clear entire cart? This action cannot be undone.')) return;

    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token)) {
      if (onShowAuth) {
        onShowAuth();
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/index.php?endpoint=cart&action=clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCartItems([]);
        setTotal(0);
        setItemCount(0);
        setSelectedItems(new Set()); // Clear selections
        alert('Cart cleared successfully');
      } else {
        alert(data.error || 'Failed to clear cart');
      }
    } catch (e) {
      console.error('Error clearing cart:', e);
      alert('Failed to clear cart');
    }
  };

  // Manual cleanup of old prebuilt components
  const handleCleanupCart = async () => {
    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token)) {
      if (onShowAuth) {
        onShowAuth();
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/index.php?endpoint=cart&action=cleanup`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.cleaned > 0) {
          alert(`Cart cleaned! Converted ${data.cleaned} prebuilt(s) from individual components:\n${data.prebuilts?.join(', ') || ''}`);
          await fetchCart(); // Refresh cart
        } else {
          alert('No prebuilts found to convert. Your cart is already up to date!');
        }
      } else {
        alert(data.error || 'Failed to cleanup cart');
      }
    } catch (e) {
      console.error('Error cleaning up cart:', e);
      alert('Failed to cleanup cart');
    }
  };

  // Toggle item selection
  const handleToggleItem = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Select all items
  const handleSelectAll = () => {
    const allItemIds = new Set(cartItems.map(item => item.id));
    setSelectedItems(allItemIds);
  };

  // Deselect all items
  const handleDeselectAll = () => {
    setSelectedItems(new Set());
  };

  // Calculate totals for selected items only
  const calculateSelectedTotals = () => {
    const selected = cartItems.filter(item => selectedItems.has(item.id));
    const selectedTotal = selected.reduce((sum, item) => {
      return sum + (parseFloat(item.price) * parseInt(item.quantity));
    }, 0);
    const selectedCount = selected.length;
    return { selectedTotal, selectedCount, selectedItems: selected };
  };

  // Checkout - convert cart to order
  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      alert('Cart is empty');
      return;
    }

    const { selectedTotal, selectedCount, selectedItems: itemsToCheckout } = calculateSelectedTotals();
    
    if (itemsToCheckout.length === 0) {
      alert('Please select at least one item to checkout');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token) || !user) {
      if (onShowAuth) {
        onShowAuth();
      }
      return;
    }

    // Show required contact info modal first
    setContactError('');
    setShowContactModal(true);
    return;
  };

  const isValidPhilippineNumber = (value) => {
    if (!value) return false;
    const digits = value.replace(/[^\d]/g, '');
    // Must start with 63 and have 12 total digits: 63 + 10 digits
    return /^63\d{10}$/.test(digits);
  };

  const proceedAfterContact = async () => {
    // Validate inputs
    const name = contactFullName.trim();
    const phone = contactNumber.trim();
    if (name.length < 2) {
      setContactError('Full name is required.');
      return;
    }
    if (!isValidPhilippineNumber(phone)) {
      setContactError('Enter a valid PH number starting with 63 and 10 digits after.');
      return;
    }

    // Close modal before continuing
    setShowContactModal(false);
    setContactError('');

    const { selectedTotal, selectedCount, selectedItems: itemsToCheckout } = calculateSelectedTotals();

    if (!window.confirm(`Checkout ${selectedCount} item(s) for ${formatCurrencyPHP(selectedTotal)}?\n\nContact: ${name} • ${phone}`)) {
      return;
    }

    try {
      // Retrieve token within this scope
      const token = localStorage.getItem('token');
      if (!token || isTokenExpired(token) || !user) {
        if (onShowAuth) {
          onShowAuth();
        }
        return;
      }
      // First, ensure all prebuilt components are loaded for selected items only
      const prebuiltItems = itemsToCheckout.filter(item => item.item_type === 'prebuilt' || item.prebuilt_id);
      const missingPrebuilts = prebuiltItems.filter(item => {
        if (!item.prebuilt_id) return false;
        const components = prebuiltComponents[item.prebuilt_id] || [];
        return components.length === 0 && item.component_ids;
      });

      // Fetch missing prebuilt components if needed
      const loadedComponents = { ...prebuiltComponents };
      if (missingPrebuilts.length > 0) {
        const fetchPromises = missingPrebuilts.map(async (item) => {
          if (!item.component_ids) return null;
          
          let componentIds = item.component_ids;
          if (typeof componentIds === 'string') {
            try {
              componentIds = JSON.parse(componentIds);
            } catch (e) {
              return null;
            }
          }
          
          const ids = Object.values(componentIds)
            .map(v => typeof v === 'string' ? parseInt(v, 10) : v)
            .filter(v => Number.isFinite(v) && v > 0);
          
          if (ids.length === 0) return null;
          
          try {
            const url = `${API_BASE}/get_components_by_ids.php?ids=${ids.join(',')}`;
            const response = await fetch(url);
            const result = await response.json();
            if (result.success && result.data) {
              // Store in local variable for immediate use
              loadedComponents[item.prebuilt_id] = result.data;
              // Also update state for UI
              setPrebuiltComponents(prev => ({
                ...prev,
                [item.prebuilt_id]: result.data
              }));
              return result.data;
            }
          } catch (e) {
            console.error('Error fetching prebuilt components:', e);
          }
          return null;
        });
        
        await Promise.all(fetchPromises);
      }

      // Convert selected cart items to order items
      // For prebuilts, expand them into individual component order items
      const orderItems = [];
      
      for (const item of itemsToCheckout) {
        const isPrebuilt = item.item_type === 'prebuilt' || item.prebuilt_id;
        
        if (isPrebuilt && item.prebuilt_id) {
          // Expand prebuilt into its component order items
          const components = loadedComponents[item.prebuilt_id] || [];
          const prebuiltQuantity = parseInt(item.quantity) || 1;
          
          if (components.length === 0) {
            alert(`Cannot checkout: Prebuilt "${item.name || 'Unknown'}" has no components loaded. Please refresh the page and try again.`);
            return;
          }
          
          // For each prebuilt, add all its components to the order
          for (let i = 0; i < prebuiltQuantity; i++) {
            components.forEach(component => {
              if (component && component.id) {
                orderItems.push({
                  component_id: component.id,
                  quantity: 1,
                  unit_price: parseFloat(component.price) || 0
                });
              }
            });
          }
        } else if (item.component_id) {
          // Regular component - add directly
          orderItems.push({
            component_id: item.component_id,
            quantity: parseInt(item.quantity) || 1,
            unit_price: parseFloat(item.price) || 0
          });
        }
      }

      // Validate that we have order items
      if (orderItems.length === 0) {
        alert('No valid items to checkout. Please ensure prebuilts have components loaded.');
        return;
      }

      const res = await fetch(`${API_BASE}/index.php?endpoint=orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          status: 'pending',
          items: orderItems,
          // Pass along contact info and structured fields
          notes: `Contact: ${name} | Phone: ${phone}`,
          customer_name: name,
          customer_phone: phone
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Remove only selected items from cart after successful checkout
        const token = localStorage.getItem('token');
        if (token && !isTokenExpired(token)) {
          // Remove each selected item from cart
          const removePromises = itemsToCheckout.map(async (item) => {
            try {
              const res = await fetch(`${API_BASE}/index.php?endpoint=cart&id=${item.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              return res.ok;
            } catch (e) {
              console.error('Error removing item from cart:', e);
              return false;
            }
          });
          
          await Promise.all(removePromises);
          // Refresh cart to update UI
          await fetchCart();
        }
        
        alert(`Order placed successfully! Order ID: #${data.order_id}`);
        // Navigate to orders page
        if (setCurrentPage) {
          setCurrentPage('my-orders');
        }
      } else {
        if (data.out_of_stock_items && Array.isArray(data.out_of_stock_items)) {
          const outOfStockList = data.out_of_stock_items.map(item => {
            if (item.available === 0) {
              return `  • ${item.name} - Out of stock`;
            } else {
              return `  • ${item.name} - Requested: ${item.requested}, Available: ${item.available}`;
            }
          }).join('\n');
          alert(`${data.error || 'Insufficient stock'}\n\nOut of stock components:\n${outOfStockList}`);
        } else {
          alert(data.error || 'Failed to place order');
        }
      }
    } catch (e) {
      console.error('Error checking out:', e);
      alert(`Failed to checkout: ${e.message}`);
    }
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <ShoppingCart className="w-12 h-12 text-gray-400" />
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h3>
      <p className="text-gray-600 text-center max-w-md mb-8">
        Start building your PC by selecting components and adding them to your cart.
      </p>
      
      <button 
        onClick={() => setCurrentPage('pc-assembly')}
        className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
      >
        <Package className="w-5 h-5" />
        Build a PC
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your cart...</p>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Shopping Cart</h1>
          <p className="text-gray-600">Manage your selected components</p>
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">Shopping Cart</h1>
            <p className="text-gray-600">{itemCount} item(s) in your cart</p>
          </div>
          
          {cartItems.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCleanupCart}
                className="px-4 py-2 text-blue-600 border border-blue-300 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2"
                title="Convert individual prebuilt components to prebuilt items"
              >
                <Package className="w-4 h-4" />
                Fix Prebuilts
              </button>
              <button
                onClick={handleClearCart}
                className="px-4 py-2 text-red-600 border border-red-300 rounded-lg font-semibold hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear Cart
              </button>
            </div>
          )}
        </div>
        
        {/* Selection Controls */}
        {cartItems.length > 0 && (
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Select All
            </button>
            <button
              onClick={handleDeselectAll}
              className="text-sm text-gray-600 hover:text-gray-700 font-medium"
            >
              Deselect All
            </button>
            <span className="text-sm text-gray-500">
              {selectedItems.size} of {cartItems.length} item(s) selected
            </span>
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => {
            // More robust prebuilt identification: check item_type, prebuilt_id, or if component_id is null (prebuilts don't have component_id)
            const isPrebuilt = item.item_type === 'prebuilt' || 
                              (item.prebuilt_id && item.prebuilt_id > 0) || 
                              (!item.component_id && item.prebuilt_id);
            const components = isPrebuilt && item.prebuilt_id ? prebuiltComponents[item.prebuilt_id] || [] : [];
            const isExpanded = expandedPrebuilts.has(item.id);
            const isSelected = selectedItems.has(item.id);
            
            if (isPrebuilt) {
              return (
                <div
                  key={item.id}
                  className={`bg-gradient-to-br from-white to-green-50 border-2 rounded-xl p-6 hover:shadow-lg transition-all shadow-sm ${
                    isSelected ? 'border-green-600 ring-2 ring-green-200' : 'border-green-400'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Checkbox */}
                    <div className="flex items-start pt-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleItem(item.id)}
                        className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
                      />
                    </div>
                    {/* Prebuilt Image */}
                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {(item.image || item.image_url) ? (
                        <img
                          src={item.image || item.image_url}
                          alt={item.name || 'Prebuilt PC'}
                          className="w-full h-full object-cover rounded-lg"
                          onError={(e) => {
                            e.target.src = '/placeholder-component.png';
                          }}
                        />
                      ) : (
                        <Package className="w-12 h-12 text-gray-400" />
                      )}
                    </div>

                    {/* Prebuilt Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-bold uppercase tracking-wide shadow-sm">
                              <Package className="w-3 h-3 mr-1" />
                              PREBUILT PC
                            </span>
                            <h3 className="text-xl font-bold text-gray-900">{item.name}</h3>
                          </div>
                          {item.category && (
                            <p className="text-sm text-gray-500 mb-1">Category: {item.category}</p>
                          )}
                          {item.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.description}</p>
                          )}
                          <p className="text-lg font-bold text-green-600 mt-2">
                            {formatCurrencyPHP(item.price)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={updating === item.id}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Remove from cart"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Components List Toggle - More Prominent Button */}
                      <div className="mt-3 mb-3">
                        {components.length > 0 ? (
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedPrebuilts);
                              if (isExpanded) {
                                newExpanded.delete(item.id);
                              } else {
                                newExpanded.add(item.id);
                              }
                              setExpandedPrebuilts(newExpanded);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-medium transition-colors"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-5 h-5" />
                                <span>Hide Components ({components.length})</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-5 h-5" />
                                <span>View Components ({components.length})</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-500 border border-gray-200 rounded-lg text-sm">
                            <Package className="w-4 h-4" />
                            <span>Loading components...</span>
                          </div>
                        )}
                      </div>

                      {/* Expanded Components List */}
                      {isExpanded && components.length > 0 && (
                        <div className="mt-3 mb-3 p-4 bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg border-2 border-blue-200 shadow-sm">
                          <h4 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <Package className="w-5 h-5 text-blue-600" />
                            Included Components ({components.length})
                          </h4>
                          <div className="space-y-2.5">
                            {components.map((comp, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-md border border-gray-200 hover:border-blue-300 transition-colors">
                                <div className="flex-1">
                                  <span className="font-semibold text-blue-700 text-xs uppercase tracking-wide">{comp.category || 'Component'}:</span>
                                  <span className="text-sm text-gray-800 ml-2">{comp.name}</span>
                                </div>
                                <span className="text-sm font-semibold text-gray-700 ml-4">{formatCurrencyPHP(comp.price || 0)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3 mt-4">
                        <span className="text-sm text-gray-600">Quantity:</span>
                        <div className="flex items-center gap-2 border border-gray-300 rounded-lg">
                          <button
                            onClick={() => handleUpdateQuantity(item.id, parseInt(item.quantity) - 1)}
                            disabled={updating === item.id || parseInt(item.quantity) <= 1}
                            className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="px-4 py-1 min-w-[3rem] text-center font-semibold">
                            {updating === item.id ? '...' : item.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateQuantity(item.id, parseInt(item.quantity) + 1)}
                            disabled={updating === item.id}
                            className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Item Total */}
                    <div className="text-right">
                      <p className="text-sm text-gray-500 mb-1">Subtotal</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrencyPHP(parseFloat(item.price) * parseInt(item.quantity))}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            
            // Regular component item
            return (
            <div
              key={item.id}
              className={`bg-white border rounded-xl p-6 hover:shadow-md transition-shadow ${
                isSelected ? 'border-green-600 ring-2 ring-green-200' : 'border-gray-200'
              }`}
            >
              <div className="flex gap-4">
                {/* Checkbox */}
                <div className="flex items-start pt-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleItem(item.id)}
                    className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
                  />
                </div>
                {/* Component Image */}
                <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <img
                    src={getComponentImage(item, item.component_id)}
                    alt={item.name || 'Component'}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      e.target.src = '/placeholder-component.png';
                    }}
                  />
                </div>

                {/* Item Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{item.name}</h3>
                      {(item.brand || item.model) && (
                        <p className="text-sm text-gray-500">
                          {[item.brand, item.model].filter(Boolean).join(' • ')}
                        </p>
                      )}
                      <p className="text-lg font-bold text-green-600 mt-2">
                        {formatCurrencyPHP(item.price)}
                      </p>
                        {item.stock_quantity && parseInt(item.stock_quantity) < parseInt(item.quantity) && (
                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          Only {item.stock_quantity} available
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={updating === item.id}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      title="Remove from cart"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-3 mt-4">
                    <span className="text-sm text-gray-600">Quantity:</span>
                    <div className="flex items-center gap-2 border border-gray-300 rounded-lg">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, parseInt(item.quantity) - 1)}
                        disabled={updating === item.id || parseInt(item.quantity) <= 1}
                        className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="px-4 py-1 min-w-[3rem] text-center font-semibold">
                        {updating === item.id ? '...' : item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.id, parseInt(item.quantity) + 1)}
                          disabled={updating === item.id || (item.stock_quantity && parseInt(item.stock_quantity) < parseInt(item.quantity) + 1)}
                        className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Item Total */}
                <div className="text-right">
                  <p className="text-sm text-gray-500 mb-1">Subtotal</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrencyPHP(parseFloat(item.price) * parseInt(item.quantity))}
                  </p>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200 sticky top-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>
            
            <div className="space-y-4 mb-6">
              {(() => {
                const { selectedTotal, selectedCount } = calculateSelectedTotals();
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Items ({selectedCount} of {itemCount} selected)</span>
                      <span className="font-semibold text-gray-900">{formatCurrencyPHP(selectedTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-gray-700">{formatCurrencyPHP(selectedTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Shipping</span>
                      <span className="text-gray-700">Calculated at checkout</span>
                    </div>
                    <div className="border-t border-gray-300 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-gray-900">Total</span>
                        <span className="text-2xl font-bold text-green-600">{formatCurrencyPHP(selectedTotal)}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <button
              onClick={handleCheckout}
              disabled={selectedItems.size === 0}
              className={`w-full px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-2 ${
                selectedItems.size === 0
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              Proceed to Checkout
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => setCurrentPage('pc-assembly')}
              className="w-full mt-4 border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Package className="w-5 h-5" />
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
      {/* Contact Information Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50"></div>
          <div className="relative bg-white w-full max-w-md mx-4 rounded-xl shadow-2xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Contact Information</h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="p-2 rounded-md hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                <input
                  type="text"
                  value={contactFullName}
                  onChange={(e) => setContactFullName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number (PH, starts with 63)</label>
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="639XXXXXXXXX"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="mt-1 text-xs text-gray-500">Example: 639171234567</p>
              </div>
              {contactError && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{contactError}</span>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowContactModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={proceedAfterContact}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;

