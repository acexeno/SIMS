import React from 'react';
import { Settings, Monitor, Bell, Cpu, BarChart3, Users, Package, Wrench, FileText, TrendingUp, Lock, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';

const SuperAdminSidebar = ({ currentPage, onPageChange, user, onLogout, onSuperAdminTabChange, activeSuperAdminTab, notificationsCount, isCollapsed, onToggleCollapse }) => {
  // handle user logout (no native confirm to avoid blocked dialogs in embedded browsers)
  const handleLogout = (e) => {
    try { e && e.preventDefault && e.preventDefault(); } catch {}
    if (typeof onLogout === 'function') {
      onLogout();
    } else {
      // Fallback: ensure token cleared and hard reload
      try { localStorage.removeItem('token'); } catch {}
      try { sessionStorage && sessionStorage.clear && sessionStorage.clear(); } catch {}
      try { window.location.reload(); } catch {}
    }
  };

  // get the user's role display text
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

  // pick the right color based on user role
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

  // Debug: Log user roles
  console.log('🚀 SUPERADMINSIDEBAR LOADED - This should show for Super Admin users only!');
  console.log('SuperAdminSidebar - User object:', user);
  console.log('SuperAdminSidebar - User roles:', user?.roles);
  console.log('SuperAdminSidebar - Is Super Admin:', user?.roles?.includes('Super Admin'));

  // Super Admin navigation tabs
  const superAdminTabs = [
    { id: 'dashboard', name: 'Dashboard', icon: <BarChart3 className="mr-3 h-4 w-4 lg:h-5 lg:w-5" /> },
    { id: 'notifications', name: 'Notifications', icon: <Bell className="mr-3 h-4 w-4 lg:h-5 lg:w-5" /> },
    { id: 'system-reports', name: 'Sales Reports', icon: <FileText className="mr-3 h-4 w-4 lg:h-5 lg:w-5" /> },
    { id: 'inventory', name: 'Inventory', icon: <Package className="mr-3 h-4 w-4 lg:h-5 lg:w-5" /> },
    { id: 'orders-management', name: 'Orders', icon: <FileText className="mr-3 h-4 w-4 lg:h-5 lg:w-5" /> },
    { id: 'pc-assembly', name: 'PC Assembly', icon: <Cpu className="mr-3 h-4 w-4 lg:h-5 lg:w-5" /> },
    { id: 'prebuilt-management', name: 'Prebuilt', icon: <Monitor className="mr-3 h-4 w-4 lg:h-5 lg:w-5" /> },
    { id: 'admin-chat-support', name: 'Chat Support', icon: <MessageSquare className="mr-3 h-4 w-4 lg:h-5 lg:w-5" /> },
    { id: 'user-management', name: 'User', icon: <Users className="mr-3 h-4 w-4 lg:h-5 lg:w-5" /> }
  ];

  return (
    <>
      {/* Sidebar */}
      <div className={`
        sticky top-0 z-40
        bg-white shadow-lg flex flex-col h-screen flex-shrink-0 relative
        ${isCollapsed ? 'w-[88px] xl:w-[104px]' : 'w-[288px] xl:w-[320px]'}
        transition-[width] duration-300 ease-in-out
      `}>
        {/* Collapse toggle */}
        <div className={`absolute ${isCollapsed ? 'top-1/2 -translate-y-1/2' : 'top-4'} right-2 lg:right-3 z-50 transition-all`}>
          <button
            onClick={onToggleCollapse}
            className="bg-white p-2 rounded-md shadow-lg border"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>
        {/* header with logo */}
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="text-lg lg:text-xl font-bold text-gray-900">SIMS</h1>
                <p className="text-xs lg:text-sm text-gray-500">PC Building Platform</p>
              </div>
            )}
          </div>
        </div>

        {/* user profile section */}
        {user && (
          <div className="p-3 lg:p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gray-300 rounded-full flex items-center justify-center">
                {user?.profile_image ? (
                  <img 
                    src={user.profile_image} 
                    alt="Profile" 
                    className="w-8 h-8 lg:w-10 lg:h-10 rounded-full object-cover"
                  />
                ) : (
                  <svg className="w-4 h-4 lg:w-6 lg:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-gray-900 truncate">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">@{user?.username}</p>
                  <div className="flex items-center mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getRoleColor()}`}>
                      {getUserRoleDisplay()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* navigation menu */}
        <nav className="flex-1 p-3 lg:p-4 space-y-1 lg:space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
          {/* Super Admin menu items */}
          {user?.roles?.includes('Super Admin') && (
            <>
              {!isCollapsed && (
                <div className="pt-2 lg:pt-4 border-t border-gray-200">
                  <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Super Admin
                  </h3>
                </div>
              )}
              {superAdminTabs.map(tab => {
                // Pages that should navigate directly (not dashboard tabs)
                const directNavPages = ['admin-chat-support', 'inventory', 'orders-management', 'pc-assembly', 'prebuilt-management', 'system-reports', 'notifications', 'user-management'];
                const shouldNavigateDirectly = directNavPages.includes(tab.id);
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (shouldNavigateDirectly) {
                        onPageChange(tab.id);
                      } else {
                        onSuperAdminTabChange(tab.id);
                      }
                    }}
                    className={`w-full flex items-center px-3 lg:px-5 py-2 text-xs lg:text-sm font-medium rounded-md transition-colors ${isCollapsed ? 'justify-center' : 'truncate'} ${
                      (currentPage === 'super-admin-dashboard' && activeSuperAdminTab === tab.id) || 
                      (currentPage === tab.id)
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title={tab.name}
                    aria-label={tab.name}
                  >
                    {tab.icon}
                    {!isCollapsed && tab.name}
                    {!isCollapsed && tab.id === 'notifications' && (typeof notificationsCount !== 'undefined' && notificationsCount > 0) && (
                      <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-green-600 rounded-full">
                        {notificationsCount}
                      </span>
                    )}
                    {/* Chat Support badge removed - no badge should be displayed */}
                  </button>
                );
              })}
            </>
          )}
        </nav>

        {/* logout button */}
        <div className="p-3 lg:p-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleLogout}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleLogout(e); }}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-center gap-2'} px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg font-semibold transition-colors duration-200`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!isCollapsed && 'Logout'}
          </button>
        </div>
      </div>
    </>
  );
};

export default SuperAdminSidebar;
