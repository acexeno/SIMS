import React, { useState, useEffect } from 'react'
import { Home, Settings, Monitor, Bell, Cpu, BarChart3, Users, Package, Wrench, FileText, TrendingUp, Menu, X, User, LogOut, ChevronDown, MessageSquare, ShoppingCart } from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'
import { API_BASE } from '../utils/apiBase'

const TopNavigation = ({ currentPage, onPageChange, user, onLogout, onSuperAdminTabChange, activeSuperAdminTab }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  // Safely get unread count with fallback
  let unreadCount = 0
  try {
    const { unreadCount: count } = useNotifications()
    unreadCount = count || 0
  } catch (error) {
    unreadCount = 0
  }

  // Fetch cart count
  useEffect(() => {
    const fetchCartCount = async () => {
      if (!user) {
        setCartCount(0);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setCartCount(0);
          return;
        }

        const res = await fetch(`${API_BASE}/index.php?endpoint=cart&count`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            setCartCount(data.total_items || 0);
          }
        }
      } catch (e) {
        console.error('Error fetching cart count:', e);
      }
    };

    fetchCartCount();
    // Refresh cart count every 30 seconds
    const interval = setInterval(fetchCartCount, 30000);
    
    // Also refresh when navigating away from cart page (to reflect changes)
    if (currentPage === 'cart') {
      const timeout = setTimeout(fetchCartCount, 500);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
    
    return () => clearInterval(interval);
  }, [user, currentPage]);

  const handleLogout = (e) => {
    try { e && e.preventDefault && e.preventDefault(); } catch {}
    const ok = typeof window !== 'undefined' ? window.confirm('Are you sure you want to logout?') : true;
    if (!ok) return;
    if (typeof onLogout === 'function') {
      onLogout();
    } else {
      try { localStorage.removeItem('token'); } catch {}
      try { sessionStorage && sessionStorage.clear && sessionStorage.clear(); } catch {}
      try { window.location.reload(); } catch {}
    }
  };

  const getUserRoleDisplay = () => {
    if (!user?.roles) return 'User';
    
    // Handle both string and array formats
    const roleArray = Array.isArray(user.roles)
      ? user.roles
      : typeof user.roles === 'string'
        ? user.roles.split(',').map(r => r.trim()).filter(r => r.length > 0)
        : [];
    
    // Remove duplicates and join
    const uniqueRoles = [...new Set(roleArray)];
    return uniqueRoles.join(', ');
  };

  const getRoleColor = () => {
    if (!user?.roles) return 'bg-gray-500';
    
    // Use the same robust role extraction logic
    const roleArray = Array.isArray(user.roles)
      ? user.roles
      : typeof user.roles === 'string'
        ? user.roles.split(',').map(r => r.trim()).filter(r => r.length > 0)
        : [];
    
    if (roleArray.includes('Super Admin')) return 'bg-red-500';
    if (roleArray.includes('Admin')) return 'bg-purple-500';
    if (roleArray.includes('Employee')) return 'bg-blue-500';
    return 'bg-green-500';
  };

  // Robust role extraction
  const roles = Array.isArray(user?.roles)
    ? user.roles
    : typeof user?.roles === 'string'
      ? user.roles.split(',').map(r => r.trim())
      : [];

  const navigationItems = [
    { id: 'home', name: 'HOME', icon: <Home className="w-4 h-4" /> },
    { id: 'prebuilt-pcs', name: 'PREBUILT PCS', icon: <Package className="w-4 h-4" /> },
    { id: 'pc-assembly', name: 'BUILD A PC', icon: <Cpu className="w-4 h-4" /> },
  ]

  const userMenuItems = user ? [
    // Show dashboard link for Admin/Employee/Super Admin users
    ...(roles.includes('Super Admin') ? [
      { id: 'super-admin-dashboard', name: 'Super Admin Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
    ] : roles.includes('Admin') && !roles.includes('Super Admin') ? [
      { id: 'admin-dashboard', name: 'Admin Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
    ] : roles.includes('Employee') && !roles.includes('Admin') && !roles.includes('Super Admin') ? [
      { id: 'employee-dashboard', name: 'Employee Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
    ] : []),
    // Only show menu items for Client users - Admin/Employee/Super Admin use sidebar navigation
    ...(roles.includes('Client') && !roles.includes('Admin') && !roles.includes('Employee') && !roles.includes('Super Admin') ? [
      { id: 'my-builds', name: 'My Builds', icon: <Package className="w-4 h-4" /> },
      { id: 'cart', name: 'Shopping Cart', icon: <ShoppingCart className="w-4 h-4" />, badge: cartCount },
      { id: 'my-orders', name: 'My Orders', icon: <FileText className="w-4 h-4" /> },
      { id: 'pc-assembly', name: 'PC Assembly', icon: <Cpu className="w-4 h-4" /> },
      { id: 'notifications', name: 'Notifications', icon: <Bell className="w-4 h-4" />, badge: unreadCount },
    ] : []),
  ] : []

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <button 
            onClick={() => {
              if (user?.roles?.includes('Super Admin')) {
                onPageChange('super-admin-dashboard');
              } else if (user?.roles?.includes('Admin')) {
                onPageChange('admin-dashboard');
              } else if (user?.roles?.includes('Employee')) {
                onPageChange('employee-dashboard');
              } else {
                onPageChange('home');
              }
            }}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">SIMS</h1>
            </div>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  currentPage === item.id
                    ? 'text-green-600 bg-green-50'
                    : 'text-gray-700 hover:text-green-600 hover:bg-gray-50'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </button>
            ))}
          </div>

          {/* Right side - User menu or Auth buttons */}
          <div className="flex items-center space-x-4">
            {/* Cart for logged in users (Client only) */}
            {user && roles.includes('Client') && !roles.includes('Admin') && !roles.includes('Employee') && !roles.includes('Super Admin') && (
              <button
                onClick={() => onPageChange('cart')}
                className="relative p-2 text-gray-700 hover:text-green-600 transition-colors"
                title="Shopping Cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-green-500 text-white min-w-[1.25rem]">
                    {cartCount}
                  </span>
                )}
              </button>
            )}
            
            {/* Notifications for logged in users */}
            {user && (
              <button
                onClick={() => onPageChange('notifications')}
                className="relative p-2 text-gray-700 hover:text-green-600 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* User menu or Auth buttons */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 p-2 text-gray-700 hover:text-green-600 transition-colors rounded-md hover:bg-gray-50"
                >
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    {user?.profile_image ? (
                      <img 
                        src={user.profile_image} 
                        alt="Profile" 
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4 text-gray-600" />
                    )}
                  </div>
                  <span className="hidden sm:block text-sm font-medium">
                    {user?.first_name} {user?.last_name}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {/* User dropdown menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50">
                    {/* User info */}
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.first_name} {user?.last_name}
                      </p>
                      <p className="text-xs text-gray-500">@{user?.username}</p>
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getRoleColor()}`}>
                          {getUserRoleDisplay()}
                        </span>
                      </div>
                    </div>

                    {/* Menu items */}
                    {userMenuItems.length > 0 && (
                      <>
                        {userMenuItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              onPageChange(item.id)
                              setIsUserMenuOpen(false)
                            }}
                            className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <div className="flex items-center space-x-2">
                              {item.icon}
                              <span>{item.name}</span>
                            </div>
                            {item.badge && item.badge > 0 && (
                              <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white ${
                                item.id === 'cart' ? 'bg-green-500' : 'bg-red-500'
                              }`}>
                                {item.badge}
                              </span>
                            )}
                          </button>
                        ))}
                        {/* Separator before logout if there are menu items */}
                        <div className="border-t border-gray-200 my-1"></div>
                      </>
                    )}

                    {/* Logout */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleLogout()
                        setIsUserMenuOpen(false)
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200 group"
                    >
                      <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onPageChange('login')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-green-600 transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={() => onPageChange('register')}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                >
                  Register
                </button>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-700 hover:text-green-600 transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="space-y-2">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onPageChange(item.id)
                    setIsMobileMenuOpen(false)
                  }}
                  className={`w-full flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentPage === item.id
                      ? 'text-green-600 bg-green-50'
                      : 'text-gray-700 hover:text-green-600 hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </button>
              ))}
              
              {/* User menu items for mobile */}
              {user && userMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onPageChange(item.id)
                    setIsMobileMenuOpen(false)
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  <div className="flex items-center space-x-2">
                    {item.icon}
                    <span>{item.name}</span>
                  </div>
                  {item.badge && item.badge > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default TopNavigation 