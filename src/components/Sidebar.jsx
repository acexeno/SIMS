import React from 'react'
import { Home, Settings, Monitor, Bell, Cpu, BarChart3, Users, Package, Wrench, FileText, TrendingUp } from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'

const Sidebar = ({ currentPage, onPageChange, user, onLogout, onSuperAdminTabChange, activeSuperAdminTab }) => {
  // Safely get unread count with fallback
  let unreadCount = 0
  try {
    const { unreadCount: count } = useNotifications()
    unreadCount = count || 0
  } catch (error) {
    // If notification context is not available, use 0
    unreadCount = 0
  }

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      onLogout();
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
    
    if (roleArray.includes('Super Admin')) return 'bg-green-500';
    if (roleArray.includes('Admin')) return 'bg-green-500';
    if (roleArray.includes('Employee')) return 'bg-green-500';
    return 'bg-green-500';
  };

  const menuItems = [
    { id: 'home', name: 'Home', icon: <Home className="w-6 h-6" /> }
  ]

  // Robust role extraction
  const roles = Array.isArray(user?.roles)
    ? user.roles
    : typeof user?.roles === 'string'
      ? user.roles.split(',').map(r => r.trim())
      : [];

  return (
    <div className="w-72 xl:w-80 bg-white shadow-lg flex flex-col h-screen sticky top-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">SIMS</h1>
            <p className="text-sm text-gray-500">PC Building Platform</p>
          </div>
        </div>
      </div>

      {/* User Profile */}
      {user ? (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
              {user?.profile_image ? (
                <img 
                  src={user.profile_image} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-gray-500 truncate">@{user?.username}</p>
              <div className="flex items-center mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getRoleColor()}`}>
                  {getUserRoleDisplay()}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Notifications Tab - Only for authenticated users */}
      {/* Removed duplicate notifications button for Super Admin */}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
        {/* Home for all except admin roles */}
        <button
          onClick={() => onPageChange('home')}
          className={`w-full flex items-center px-5 py-2 text-sm font-medium rounded-md transition-colors truncate ${
            currentPage === 'home'
              ? 'bg-green-100 text-green-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Home
        </button>

        {/* Prebuilt PCs & Community for all authenticated users */}
        {user && (
          <button
            onClick={() => onPageChange('prebuilt-pcs')}
            className={`w-full flex items-center px-5 py-2 text-sm font-medium rounded-md transition-colors truncate ${
              currentPage === 'prebuilt-pcs'
                ? 'bg-green-100 text-green-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Prebuilt PCs & PC Build Sharing
          </button>
        )}

        {/* Prebuilt PCs for non-authenticated users */}
        {!user && (
          <button
            onClick={() => onPageChange('prebuilt-pcs')}
            className={`w-full flex items-center px-5 py-2 text-sm font-medium rounded-md transition-colors truncate ${
              currentPage === 'prebuilt-pcs'
                ? 'bg-green-100 text-green-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Prebuilt PCs
          </button>
        )}

        {/* Public menu items for non-logged-in users */}
        {!user && (
          <>
            <button
              onClick={() => onPageChange('pc-assembly')}
              className={`w-full flex items-center px-5 py-2 text-sm font-medium rounded-md transition-colors truncate ${
                currentPage === 'pc-assembly'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              PC Assembly
            </button>
            {/* <button
              onClick={() => onPageChange('chat-support')}
              className={`w-full flex items-center px-5 py-2 text-sm font-medium rounded-md transition-colors truncate ${
                currentPage === 'chat-support'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat Support
            </button> */}
          </>
        )}

        {/* Client-only menu items */}
        {user?.roles?.includes('Client') && (
          <>
            <button
              onClick={() => onPageChange('my-builds')}
              className={`w-full flex items-center px-5 py-2 text-sm font-medium rounded-md transition-colors truncate ${
                currentPage === 'my-builds'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              My Builds
            </button>


            <button
              onClick={() => onPageChange('my-orders')}
              className={`w-full flex items-center px-5 py-2 text-sm font-medium rounded-md transition-colors truncate ${
                currentPage === 'my-orders'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              My Orders
            </button>

            <button
              onClick={() => onPageChange('pc-assembly')}
              className={`w-full flex items-center px-5 py-2 text-sm font-medium rounded-md transition-colors truncate ${
                currentPage === 'pc-assembly'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              PC Assembly
            </button>

            {/* Admin/Employee Chat Support - Only for Admin and Employee, not Super Admin or Client */}
            {roles.includes('Admin') || roles.includes('Employee') ? (
              !roles.includes('Super Admin') && (
                <button
                  onClick={() => onPageChange('chat-support')}
                  className={`w-full flex items-center px-5 py-2 text-sm font-medium rounded-md transition-colors truncate ${
                    currentPage === 'chat-support'
                      ? 'bg-green-100 text-green-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Chat Support
                </button>
              )
            ) : null}
            <button
              onClick={() => onPageChange('notifications')}
              className={`w-full flex items-center px-5 py-2 text-sm font-medium rounded-md transition-colors truncate ${
                currentPage === 'notifications'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Bell className="mr-3 h-5 w-5" />
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-500 text-white">{unreadCount}</span>
              )}
            </button>
          </>
        )}

        {/* Public/Auth buttons */}
        {!user && (
          <>
            <div className="pt-4 border-t border-gray-200">
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Account
              </h3>
            </div>
            <button
              onClick={() => onPageChange('login')}
              className={`w-full flex items-center px-5 py-2 text-sm font-medium rounded-md transition-colors truncate ${
                currentPage === 'login'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Login
            </button>
            <button
              onClick={() => onPageChange('register')}
              className={`w-full flex items-center px-5 py-2 text-sm font-medium rounded-md transition-colors truncate ${
                currentPage === 'register'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Register
            </button>
          </>
        )}
      </nav>

      {/* Footer */}
      {user && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all duration-300 transform hover:scale-[1.02] shadow hover:shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      )}
    </div>
  )
}

export default Sidebar 