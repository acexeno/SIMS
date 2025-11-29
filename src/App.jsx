/**
 * App root: routes between storefront and role-based dashboards, manages auth state,
 * and coordinates sidebars/layout. Public pages vs admin/employee areas are separated.
 */
import React, { useState, useCallback, useEffect } from 'react'
import { API_BASE } from './utils/apiBase'
import { ensureValidToken, authorizedFetch } from './utils/auth'
import Sidebar from './components/Sidebar'
import AdminSidebar from './components/AdminSidebar'
import SuperAdminSidebar from './components/SuperAdminSidebar'
import EmployeeSidebar from './components/EmployeeSidebar'
import TopNavigation from './components/TopNavigation'
import Home from './pages/Home'
import PCAssembly from './pages/PCAssembly'
import AdminPCAssembly from './pages/AdminPCAssembly'
import EmployeePCAssembly from './pages/EmployeePCAssembly'
import SuperAdminPCAssembly from './pages/SuperAdminPCAssembly'
import DynamicChatAccess from './components/DynamicChatAccess'
import MyBuilds from './pages/MyBuilds'
import MyOrders from './pages/MyOrders'
import Cart from './pages/Cart'
import PrebuiltPCs from './pages/PrebuiltPCs'
import Notifications from './pages/Notifications'
import AdminDashboard from './pages/AdminDashboard'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import EmployeeDashboard from './pages/EmployeeDashboard'
import ScrollTestPage from './pages/ScrollTestPage'
import About from './pages/About'
import Contact from './pages/Contact'
import FAQ from './pages/FAQ'
import CompatibilityGuide from './pages/CompatibilityGuide'
import Troubleshooting from './pages/Troubleshooting'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import ResetPassword from './components/auth/ResetPassword'
import { NotificationProvider } from './contexts/NotificationContext'
import NotificationManager from './components/NotificationManager'

import FloatingChatButton from './components/FloatingChatButton';
import './App.css'

// Protected pages require user session
const PROTECTED_PAGES = ['my-builds', 'my-orders', 'notifications', 'cart']

// Parse token locally to decide initial route; network verification follows
function isTokenExpired(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return true;
    // convert base64url -> base64
    let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payload = JSON.parse(atob(b64));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    // if we cannot parse, treat as expired to be safe
    return true;
  }
}

const token = localStorage.getItem('token');
if (token && isTokenExpired(token)) {
  localStorage.removeItem('token');
}

const AppContent = () => {
  // Debug: Test console logging
  useEffect(() => {
    console.log('[App] AppContent component mounted!');
    console.log('[App] Testing environment variable:', import.meta.env.VITE_RECAPTCHA_SITE_KEY ? 'SET' : 'NOT SET');
  }, []);

  // figure out which page to show first based on user role (admins and employees go to their dashboards)
  const getInitialPage = () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const part = token.split('.')[1];
        if (!part) throw new Error('invalid jwt');
        // base64url -> base64 with padding
        let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const payload = JSON.parse(atob(b64));
        const roles = payload.roles || [];
        if (typeof roles === 'string' && roles.includes('Super Admin')) return 'super-admin-dashboard';
        if (Array.isArray(roles) && roles.includes('Super Admin')) return 'super-admin-dashboard';
        if (typeof roles === 'string' && roles.includes('Admin')) return 'admin-dashboard';
        if (Array.isArray(roles) && roles.includes('Admin')) return 'admin-dashboard';
        if (typeof roles === 'string' && roles.includes('Employee')) return 'employee-dashboard';
        if (Array.isArray(roles) && roles.includes('Employee')) return 'employee-dashboard';
      } catch {}
    }
    return 'home';
  };
  const [currentPage, setCurrentPage] = useState(getInitialPage());
  const [selectedComponents, _setSelectedComponents] = useState({})
  const [prebuiltComponentIds, setPrebuiltComponentIds] = useState(null)
  const [user, setUser] = useState(null)
  const [showAuth, setShowAuth] = useState(null) // null, 'login', 'register', 'reset-password'
  const [isLoading, setIsLoading] = useState(true)
  const [superAdminTab, setSuperAdminTab] = useState('dashboard');
  // User preference for collapsing (persisted)
  const [isUserSidebarCollapsed, setIsUserSidebarCollapsed] = useState(() => {
    try {
      const v = localStorage.getItem('builditpc_sidebar_collapsed');
      return v === '1';
    } catch {
      return false;
    }
  });
  // Auto-collapse below a width threshold (soft rule)
  const [isAutoCollapsed, setIsAutoCollapsed] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('builditpc_sidebar_collapsed', isUserSidebarCollapsed ? '1' : '0');
    } catch {}
  }, [isUserSidebarCollapsed]);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth || document.documentElement.clientWidth || 0;
      // Collapse automatically below 1024px
      setIsAutoCollapsed(w < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isSidebarCollapsed = isUserSidebarCollapsed || isAutoCollapsed;

  const setSelectedComponents = useCallback((value) => {
    _setSelectedComponents(value)
  }, [])

  // check if the user's token is still valid when the app starts
  useEffect(() => {
    const verifyToken = async () => {
      try {
        // Check for reset password URL first
        const urlParams = new URLSearchParams(window.location.search)
        const resetToken = urlParams.get('token')
        if (resetToken) {
          setShowAuth('reset-password')
          setCurrentPage('reset-password')
          setIsLoading(false)
          return
        }
        
        // Only attempt refresh if an access token already exists.
        // This prevents silent sign-in using refresh_token on page reload.
        const existing = localStorage.getItem('token')
        if (!existing) {
          setUser(null)
          setIsLoading(false)
          return
        }
        const fresh = await ensureValidToken(false)
        if (!fresh) {
          localStorage.removeItem('token')
          setIsLoading(false)
          return
        }

        const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=verify`, { method: 'GET' })
        if (response.ok) {
          const data = await response.json().catch(() => ({}))
          if (data && data.success) {
            // Fetch profile via authorizedFetch (auto-refresh on 401)
            const profileResponse = await authorizedFetch(`${API_BASE}/index.php?endpoint=profile`, { method: 'GET' })
            if (profileResponse.ok) {
              const profileData = await profileResponse.json().catch(() => ({}))
              if (profileData && profileData.success) {
                setUser(profileData.user)
              } else {
                setUser(null)
                localStorage.removeItem('token')
              }
            } else if (profileResponse.status === 401) {
              setUser(null)
              localStorage.removeItem('token')
            }
          } else {
            setUser(null)
            localStorage.removeItem('token')
          }
        } else if (response.status === 401) {
          setUser(null)
          localStorage.removeItem('token')
        }
      } catch (error) {
        setUser(null)
        localStorage.removeItem('token')
      } finally {
        setIsLoading(false)
      }
    }

    verifyToken()
  }, [])

  // Global listener for forced logout on 401
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null)
      try {
        localStorage.removeItem('token')
        localStorage.removeItem('refresh_token')
      } catch {}
      // Optionally, you could navigate to login by setting the auth modal
      setShowAuth('login')
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [])

  // handle when user clicks on navigation items
  const handlePageChange = (page) => {
    // If non-user tries to access protected page, show login in main area
    if (!user && PROTECTED_PAGES.includes(page)) {
      setCurrentPage(page)
      setShowAuth('login')
    } else if (page === 'login' || page === 'register' || page === 'reset-password') {
      setCurrentPage(page)
      setShowAuth(page)
    } else if (page === 'admin-dashboard' && hasRoles.includes('Admin')) {
      setCurrentPage('admin-dashboard');
      setShowAuth(null);
    } else if (page === 'employee-dashboard' && hasRoles.includes('Employee')) {
      setCurrentPage('employee-dashboard');
      setShowAuth(null);
    } else {
      // For all other pages, just set the current page
      setCurrentPage(page)
      setShowAuth(null)
    }
  }

  // handle user logout
  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('token'); // Remove JWT token on logout
    localStorage.removeItem('refresh_token'); // Prevent silent re-login on reload
    localStorage.removeItem('user');
    localStorage.removeItem('builditpc_chat_session_id');
    localStorage.removeItem('builditpc_guest_name');
    localStorage.removeItem('builditpc_guest_email');
    setCurrentPage('home')
    setShowAuth(null)
    window.location.reload(); // Force reload to reset app state
  }

  // handle when user picks a prebuilt PC
  const handlePrebuiltSelect = (componentIds) => {
    setPrebuiltComponentIds(componentIds)
    setCurrentPage('pc-assembly')
  }

  // clear the prebuilt selection after the PC assembly page loads
  const handlePCAssemblyLoaded = () => {
    if (prebuiltComponentIds) setPrebuiltComponentIds(null)
  }

  // handle super admin tab switching
  const handleSuperAdminTabChange = (tab) => {
    setCurrentPage('super-admin-dashboard');
    setSuperAdminTab(tab);
  };

  // show a loading spinner while we check the token
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // figure out which dashboard the user should see based on their role
  const getUserDashboard = () => {
    if (!user?.roles) return null
    
    // Handle both string and array formats for roles
    const roleArray = Array.isArray(user.roles)
      ? user.roles
      : typeof user.roles === 'string'
        ? user.roles.split(',').map(r => r.trim()).filter(r => r.length > 0)
        : [];
    
    if (roleArray.includes('Super Admin')) {
      return 'super-admin-dashboard'
    } else if (roleArray.includes('Admin')) {
      return 'admin-dashboard'
    } else if (roleArray.includes('Employee')) {
      return 'employee-dashboard'
    }
    return null
  }

  // Determine whether we are on an admin/employee area page vs public storefront pages
  const hasRoles = Array.isArray(user?.roles)
    ? user.roles
    : typeof user?.roles === 'string'
      ? user.roles.split(',').map(r => r.trim()).filter(r => r.length > 0)
      : [];
  const isSuperAdmin = hasRoles.includes('Super Admin')
  const isAdmin = hasRoles.includes('Admin')
  const isEmployee = hasRoles.includes('Employee')
  const isAdminOrEmployee = isSuperAdmin || isAdmin || isEmployee
  
  // Helper function to check if user has any of the specified roles
  const hasAnyRole = (rolesToCheck) => {
    return rolesToCheck.some(role => hasRoles.includes(role));
  };
  
  const ADMIN_PAGES = new Set(['super-admin-dashboard','admin-dashboard','prebuilt-management','sales-reports','system-reports','notifications','inventory','orders-management','pc-assembly','admin-chat-support','user-management'])
  const EMPLOYEE_PAGES = new Set(['employee-dashboard','inventory','orders-management','prebuilt-management','sales-reports','system-reports','notifications','admin-chat-support','pc-assembly'])
  const isAdminAreaPage = (
    ((isSuperAdmin || isAdmin) && ADMIN_PAGES.has(currentPage)) ||
    (isEmployee && EMPLOYEE_PAGES.has(currentPage))
  )

  // the main app layout
  return (
    <>
      <NotificationProvider user={user}>
        {/* layout with conditional top navigation */}
        <div className="min-h-screen bg-gray-50">
          {/* Show header on public pages (home/storefront/etc.) even for admins; hide it inside admin area */}
          {!isAdminAreaPage && (
            <TopNavigation
              currentPage={currentPage}
              onPageChange={handlePageChange}
              user={user}
              onLogout={handleLogout}
              onSuperAdminTabChange={handleSuperAdminTabChange}
              activeSuperAdminTab={currentPage === 'super-admin-dashboard' ? superAdminTab : undefined}
            />
          )}
          
          {/* Admin/Employee sidebars visible only on admin area pages */}
          {(isAdminOrEmployee && isAdminAreaPage) ? (
            <div className={`grid ${isSidebarCollapsed ? 'grid-cols-[88px_1fr] md:grid-cols-[88px_1fr] xl:grid-cols-[104px_1fr]' : 'grid-cols-[288px_1fr] md:grid-cols-[288px_1fr] xl:grid-cols-[320px_1fr]'} h-screen w-full`}>
              {/* sidebar for Super Admin users */}
              {hasRoles.includes('Super Admin') && (
                <>
                  {console.log('🎯 APP.JSX - Using SuperAdminSidebar for Super Admin user!')}
                  <SuperAdminSidebar
                    currentPage={currentPage}
                    onPageChange={handlePageChange}
                    user={user}
                    onLogout={handleLogout}
                    onSuperAdminTabChange={handleSuperAdminTabChange}
                    activeSuperAdminTab={currentPage === 'super-admin-dashboard' ? superAdminTab : undefined}
                    isCollapsed={isSidebarCollapsed}
                    onToggleCollapse={() => setIsUserSidebarCollapsed(prev => !prev)}
                  />
                </>
              )}
              
              {/* sidebar for Admin users (not Super Admin) */}
              {hasRoles.includes('Admin') && !hasRoles.includes('Super Admin') && (
                <AdminSidebar
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                  user={user}
                  onLogout={handleLogout}
                  onSuperAdminTabChange={handleSuperAdminTabChange}
                  activeSuperAdminTab={currentPage === 'super-admin-dashboard' ? superAdminTab : undefined}
                  isCollapsed={isSidebarCollapsed}
                  onToggleCollapse={() => setIsUserSidebarCollapsed(prev => !prev)}
                />
              )}
              
              {/* sidebar for employee users */}
              {hasRoles.includes('Employee') && !hasRoles.includes('Admin') && !hasRoles.includes('Super Admin') && (
                <EmployeeSidebar
                  currentPage={currentPage}
                  onPageChange={(page) => {
                    // for employee users, we need to handle both page changes and internal tab changes
                    if (page === 'employee-dashboard' || ['inventory', 'orders-management', 'notifications', 'sales-reports', 'system-reports', 'pc-assembly', 'prebuilt-management', 'admin-chat-support'].includes(page)) {
                      handlePageChange(page);
                    }
                  }}
                  user={user}
                  onLogout={handleLogout}
                  isCollapsed={isSidebarCollapsed}
                  onToggleCollapse={() => setIsUserSidebarCollapsed(prev => !prev)}
                />
              )}
              
              {/* main content area with sidebar */}
              <main className="bg-gray-50 h-full relative overflow-y-auto">
                {/* show login/register forms in the main area when needed */}
                {showAuth === 'login' && (
              <Login onLogin={async (u) => {
                // clean up any guest chat data when user logs in
                localStorage.removeItem('builditpc_chat_session_id');
                localStorage.removeItem('builditpc_guest_name');
                setUser(u);
                
                // Add a small delay to ensure tokens are properly stored
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // grab the user's chat session if they have one
                if (u && u.id) {
                  try {
                    const token = localStorage.getItem('token');
                    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
                    const res = await fetch(`${API_BASE}/chat.php?user_sessions&user_id=${u.id}`, { headers });
                    const data = await res.json();
                    if (data.success && data.sessions && Array.isArray(data.sessions) && data.sessions.length > 0) {
                      // Get the most recent session
                      const userSession = data.sessions[0];
                      if (userSession && userSession.id) {
                        localStorage.setItem('builditpc_chat_session_id', userSession.id);
                      }
                    }
                  } catch (e) { /* fail silently */ }
                }
                setShowAuth(null);
                // figure out which dashboard to show based on user role
                const userRoleArray = Array.isArray(u?.roles)
                  ? u.roles
                  : typeof u?.roles === 'string'
                    ? u.roles.split(',').map(r => r.trim()).filter(r => r.length > 0)
                    : [];
                if (userRoleArray.includes('Super Admin')) {
                  setCurrentPage('super-admin-dashboard');
                } else if (userRoleArray.includes('Admin')) {
                  setCurrentPage('admin-dashboard');
                } else if (userRoleArray.includes('Employee')) {
                  setCurrentPage('employee-dashboard');
                } else {
                  setCurrentPage('home');
                }
              }} onSwitchToRegister={() => { setShowAuth('register'); setCurrentPage('register'); }} />
            )}
            {showAuth === 'register' && (
              <Register onRegister={() => { setShowAuth('login'); setCurrentPage('login'); }} onSwitchToLogin={() => { setShowAuth('login'); setCurrentPage('login'); }} />
            )}
            {showAuth === 'reset-password' && (
              <ResetPassword onSuccess={() => { setShowAuth('login'); setCurrentPage('login'); }} />
            )}
            {/* main content area - only show when not logging in/registering */}
            {!showAuth && (
              <>
                {/* show different dashboards based on user role */}
                {currentPage === 'super-admin-dashboard' && hasRoles.includes('Super Admin') && (
                  <SuperAdminDashboard initialTab={superAdminTab} user={user} setUser={setUser} />
                )}
                {currentPage === 'admin-dashboard' && hasRoles.includes('Admin') && (
                  <AdminDashboard user={user} />
                )}
                {currentPage === 'sales-reports' && hasRoles.includes('Admin') && (
                  <AdminDashboard initialTab="sales-reports" user={user} />
                )}
                {currentPage === 'system-reports' && hasRoles.includes('Admin') && (
                  <AdminDashboard initialTab="system-reports" user={user} />
                )}
                {currentPage === 'notifications' && hasRoles.includes('Admin') && (
                  <AdminDashboard initialTab="notifications" user={user} />
                )}
                {currentPage === 'inventory' && user?.roles?.includes('Admin') && (
                  <AdminDashboard initialTab="inventory" user={user} />
                )}
                {currentPage === 'orders-management' && user?.roles?.includes('Admin') && (
                  <AdminDashboard initialTab="orders" user={user} />
                )}
                {currentPage === 'prebuilt-management' && user?.roles?.includes('Admin') && (
                  <AdminDashboard initialTab="prebuilt-management" user={user} />
                )}
                                                 {currentPage === 'employee-dashboard' && user?.roles?.includes('Employee') && (
                  <EmployeeDashboard user={user} setUser={setUser} initialTab="employee-dashboard" />
                )}
                {/* Employee pages handled in the array below */}
                {/* Employee notifications handled in the array below */}
                
                {/* regular customer pages */}
                {currentPage === 'home' && <Home setCurrentPage={setCurrentPage} setSelectedComponents={setSelectedComponents} />}
                {currentPage === 'prebuilt-pcs' && (
                  <PrebuiltPCs user={user} setCurrentPage={setCurrentPage} setSelectedComponents={setSelectedComponents} onPrebuiltSelect={handlePrebuiltSelect} />
                )}
                {currentPage === 'pc-assembly' && user?.roles?.includes('Super Admin') && (
                  <SuperAdminPCAssembly 
                    setCurrentPage={setCurrentPage}
                    setSelectedComponents={setSelectedComponents} 
                    selectedComponents={prebuiltComponentIds || selectedComponents} 
                    onLoaded={handlePCAssemblyLoaded}
                    user={user}
                    setUser={setUser}
                    onShowAuth={(authType) => {
                      setShowAuth(authType)
                      setCurrentPage(authType)
                    }}
                  />
                )}
                {currentPage === 'pc-assembly' && user?.roles?.includes('Admin') && (
                  <AdminPCAssembly 
                    setCurrentPage={setCurrentPage}
                    setSelectedComponents={setSelectedComponents} 
                    selectedComponents={prebuiltComponentIds || selectedComponents} 
                    onLoaded={handlePCAssemblyLoaded}
                    user={user}
                    setUser={setUser}
                    onShowAuth={(authType) => {
                      setShowAuth(authType)
                      setCurrentPage(authType)
                    }}
                  />
                )}
                {currentPage === 'pc-assembly' && user?.roles?.includes('Employee') && (
                  <EmployeePCAssembly 
                    setCurrentPage={setCurrentPage}
                    setSelectedComponents={setSelectedComponents} 
                    selectedComponents={prebuiltComponentIds || selectedComponents} 
                    onLoaded={handlePCAssemblyLoaded}
                    user={user}
                    setUser={setUser}
                    onShowAuth={(authType) => {
                      setShowAuth(authType)
                      setCurrentPage(authType)
                    }}
                  />
                )}
                {currentPage === 'pc-assembly' && (!user?.roles || !hasAnyRole(['Super Admin', 'Admin', 'Employee'])) && (
                  <PCAssembly 
                    setCurrentPage={setCurrentPage}
                    setSelectedComponents={setSelectedComponents} 
                    selectedComponents={prebuiltComponentIds || selectedComponents} 
                    onLoaded={handlePCAssemblyLoaded}
                    user={user}
                    setUser={setUser}
                    onShowAuth={(authType) => {
                      setShowAuth(authType)
                      setCurrentPage(authType)
                    }}
                  />
                )}
                {currentPage === 'chat-support' && (user?.roles?.includes('Admin') || user?.roles?.includes('Employee')) && <DynamicChatAccess user={user} fullScreen={true} />}
                {currentPage === 'scroll-test' && <ScrollTestPage />}
                {currentPage === 'about' && <About setCurrentPage={setCurrentPage} />}
                {currentPage === 'contact' && <Contact setCurrentPage={setCurrentPage} />}
                {currentPage === 'faq' && <FAQ setCurrentPage={setCurrentPage} />}
                {currentPage === 'compatibility-guide' && <CompatibilityGuide setCurrentPage={setCurrentPage} />}
                {currentPage === 'troubleshooting' && <Troubleshooting setCurrentPage={setCurrentPage} />}
                {currentPage === 'my-builds' && user && <MyBuilds setCurrentPage={setCurrentPage} setSelectedComponents={setSelectedComponents} user={user} />}
                {currentPage === 'my-builds' && !user && (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">Sign in required</h3>
                      <p className="text-gray-600 mb-4">Log in to view and manage your builds.</p>
                      <div className="flex items-center gap-2 justify-center">
                        <button onClick={() => { setShowAuth('login'); setCurrentPage('login'); }} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md">Login</button>
                        <button onClick={() => { setShowAuth('register'); setCurrentPage('register'); }} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md">Register</button>
                      </div>
                    </div>
                  </div>
                )}
                {currentPage === 'my-orders' && user && <MyOrders setCurrentPage={setCurrentPage} />}
                {currentPage === 'cart' && user && <Cart setCurrentPage={setCurrentPage} user={user} onShowAuth={() => { setShowAuth('login'); setCurrentPage('login'); }} />}
                {currentPage === 'cart' && !user && (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">Sign in required</h3>
                      <p className="text-gray-600 mb-4">Log in to view and manage your cart.</p>
                      <div className="flex items-center gap-2 justify-center">
                        <button onClick={() => { setShowAuth('login'); setCurrentPage('login'); }} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md">Login</button>
                        <button onClick={() => { setShowAuth('register'); setCurrentPage('register'); }} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md">Register</button>
                      </div>
                    </div>
                  </div>
                )}
                {currentPage === 'notifications' && user && !user?.roles?.includes('Admin') && !user?.roles?.includes('Employee') && <Notifications user={user} />}
                {currentPage === 'admin-chat-support' && (user?.roles?.includes('Super Admin') || user?.roles?.includes('Admin') || user?.roles?.includes('Employee')) && (
                  // Super Admin has full access, no permission check needed
                  user?.roles?.includes('Super Admin') ? (
                    <DynamicChatAccess user={user} fullScreen={true} />
                  ) : (
                    user.can_access_chat_support === 0 || user.can_access_chat_support === '0' || user.can_access_chat_support === false || user.can_access_chat_support === 'false' ? (
                      <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-6 py-4 rounded-2xl text-center max-w-lg mx-auto mt-24">
                        <h2 className="text-2xl font-bold mb-2">Chat Support Access Disabled</h2>
                        <p className="text-lg">Your access to Chat Support Management has been disabled by a Super Admin. If you believe this is a mistake, please contact your administrator.</p>
                      </div>
                    ) : <DynamicChatAccess user={user} fullScreen={true} />
                  )
                )}
                
                {/* SupplierManagement temporarily disabled */}
                
                {/* admin/employee management pages */}
                {['inventory', 'orders-management', 'reports'].includes(currentPage) && user?.roles?.includes('Super Admin') && (
                  <SuperAdminDashboard initialTab={currentPage} user={user} setUser={setUser} />
                )}
                {['inventory', 'orders-management', 'prebuilt-management', 'sales-reports', 'system-reports', 'notifications'].includes(currentPage) && user?.roles?.includes('Employee') && (
                  // EmployeeDashboard now handles permission checks internally
                  <EmployeeDashboard initialTab={currentPage} user={user} setUser={setUser} />
                )}

                {/* super admin only pages */}
                {['user-management', 'system-settings', 'system-reports', 'prebuilt-management'].includes(currentPage) && user?.roles?.includes('Super Admin') && (
                  <SuperAdminDashboard initialTab={currentPage} user={user} setUser={setUser} />
                )}

                {/* super admin and admin prebuilt management */}
              </>
            )}
              </main>
            </div>
          ) : (
            /* Public/main content layout (no sidebar) */
            <main className="bg-gray-50">
              {/* show login/register forms in the main area when needed */}
              {showAuth === 'login' && (
                <Login onLogin={async (u) => {
                  // clean up any guest chat data when user logs in
                  localStorage.removeItem('builditpc_chat_session_id');
                  localStorage.removeItem('builditpc_guest_name');
                  setUser(u);
                  // grab the user's chat session if they have one
                  if (u && u.id) {
                    try {
                      const token = localStorage.getItem('token');
                      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
                      const res = await fetch(`${API_BASE}/chat.php?user_sessions&user_id=${u.id}`, {
                        headers
                      });
                      const data = await res.json();
                      if (data.success && data.sessions && data.sessions.length > 0) {
                        // Get the most recent session
                        const userSession = data.sessions[0];
                        if (userSession && userSession.id) {
                          localStorage.setItem('builditpc_chat_session_id', userSession.id);
                        }
                      }
                    } catch (e) { 
                      // Error fetching chat sessions
                    }
                  }
                  setShowAuth(null);
                  // figure out which dashboard to show based on user role
                  if (u?.roles?.includes('Super Admin')) {
                    setCurrentPage('super-admin-dashboard');
                  } else if (u?.roles?.includes('Admin')) {
                    setCurrentPage('admin-dashboard');
                  } else if (u?.roles?.includes('Employee')) {
                    setCurrentPage('employee-dashboard');
                  } else {
                    setCurrentPage('home');
                  }
                }} onSwitchToRegister={() => { setShowAuth('register'); setCurrentPage('register'); }} />
              )}
              {showAuth === 'register' && (
                <Register onRegister={() => { setShowAuth('login'); setCurrentPage('login'); }} onSwitchToLogin={() => { setShowAuth('login'); setCurrentPage('login'); }} />
              )}
              {showAuth === 'reset-password' && (
                <ResetPassword onSuccess={() => { setShowAuth('login'); setCurrentPage('login'); }} />
              )}
              {/* main content area - only show when not logging in/registering */}
              {!showAuth && (
                <>
                  {/* regular customer pages */}
                  {currentPage === 'home' && <Home setCurrentPage={setCurrentPage} setSelectedComponents={setSelectedComponents} />}
                  {currentPage === 'prebuilt-pcs' && (
                    <PrebuiltPCs user={user} setCurrentPage={setCurrentPage} setSelectedComponents={setSelectedComponents} onPrebuiltSelect={handlePrebuiltSelect} />
                  )}
                  {currentPage === 'pc-assembly' && (!user?.roles || !hasAnyRole(['Super Admin', 'Admin'])) && (
                    <PCAssembly 
                      setCurrentPage={setCurrentPage}
                      setSelectedComponents={setSelectedComponents} 
                      selectedComponents={prebuiltComponentIds || selectedComponents} 
                      onLoaded={handlePCAssemblyLoaded}
                      user={user}
                      setUser={setUser}
                      onShowAuth={(authType) => {
                        setShowAuth(authType)
                        setCurrentPage(authType)
                      }}
                    />
                  )}
                  {currentPage === 'chat-support' && (user?.roles?.includes('Admin') || user?.roles?.includes('Employee')) && <DynamicChatAccess user={user} fullScreen={true} />}
                  {currentPage === 'scroll-test' && <ScrollTestPage />}
                  {currentPage === 'about' && <About setCurrentPage={setCurrentPage} />}
                  {currentPage === 'contact' && <Contact setCurrentPage={setCurrentPage} />}
                  {currentPage === 'faq' && <FAQ setCurrentPage={setCurrentPage} />}
                  {currentPage === 'compatibility-guide' && <CompatibilityGuide setCurrentPage={setCurrentPage} />}
                  {currentPage === 'troubleshooting' && <Troubleshooting setCurrentPage={setCurrentPage} />}
                  {currentPage === 'my-builds' && user && <MyBuilds setCurrentPage={setCurrentPage} setSelectedComponents={setSelectedComponents} user={user} />}
                  {currentPage === 'my-builds' && !user && (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">Sign in required</h3>
                        <p className="text-gray-600 mb-4">Log in to view and manage your builds.</p>
                        <div className="flex items-center gap-2 justify-center">
                          <button onClick={() => { setShowAuth('login'); setCurrentPage('login'); }} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md">Login</button>
                          <button onClick={() => { setShowAuth('register'); setCurrentPage('register'); }} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md">Register</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {currentPage === 'my-orders' && user && <MyOrders setCurrentPage={setCurrentPage} />}
                  {currentPage === 'cart' && user && <Cart setCurrentPage={setCurrentPage} user={user} onShowAuth={() => { setShowAuth('login'); setCurrentPage('login'); }} />}
                  {currentPage === 'cart' && !user && (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">Sign in required</h3>
                        <p className="text-gray-600 mb-4">Log in to view and manage your cart.</p>
                        <div className="flex items-center gap-2 justify-center">
                          <button onClick={() => { setShowAuth('login'); setCurrentPage('login'); }} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md">Login</button>
                          <button onClick={() => { setShowAuth('register'); setCurrentPage('register'); }} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md">Register</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {currentPage === 'notifications' && user && !user?.roles?.includes('Admin') && !user?.roles?.includes('Employee') && <Notifications user={user} />}
                </>
              )}
            </main>
          )}
        </div>
        {/* notification popups - only for logged in users */}
        {/* {user && <NotificationManager />} */}
      </NotificationProvider>
  {/* floating chat button (visible for guests and clients only, not admin/employee/super admin) */}
  {/* Only show floating chat for guests and clients (not admin/employee/super admin) */}
  {(!user || (!user?.roles?.includes('Super Admin') && !user?.roles?.includes('Admin') && !user?.roles?.includes('Employee'))) && (
    <FloatingChatButton user={user} setCurrentPage={setCurrentPage} />
  )}
    </>
  )
}

function App() {
  return <AppContent />
}

export default App 