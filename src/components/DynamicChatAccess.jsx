import React, { useState, useEffect } from 'react';
import { MessageSquare, Shield, Users, AlertTriangle } from 'lucide-react';
import ChatSupport from '../pages/ChatSupport';
import AdminChatSupport from '../pages/AdminChatSupport';
import { API_BASE } from '../utils/apiBase';

const DynamicChatAccess = ({ user, fullScreen = false, customStyles = {}, hideHeader = false }) => {
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check user permissions
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Check chat permissions
        const permRes = await fetch(`${API_BASE}/chat.php?check_permissions`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!permRes.ok) {
          throw new Error(`HTTP error! status: ${permRes.status}`);
        }
        
        const permData = await permRes.json();
        
        if (permData.success) {
          setPermissions(permData);
        } else {
          // If permissions check returns but not successful, still set it to avoid infinite loading
          setPermissions({ hasPermission: false, canRead: false, canWrite: false });
        }
        
      } catch (err) {
        console.error('Error checking permissions:', err);
        // Set permissions to deny access on error to prevent white screen
        setPermissions({ hasPermission: false, canRead: false, canWrite: false });
        setError('Failed to load chat support');
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <MessageSquare className="w-8 h-8 animate-pulse text-green-600 mx-auto mb-2" />
          <div className="text-gray-600">Loading chat support...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <div>{error}</div>
        </div>
      </div>
    );
  }

  // Determine chat interface based on user role and permissions
  const getChatInterface = () => {
    // Super Admin/Admin/Employee interface - can view and manage all chats
    if (permissions?.canRead && (user?.roles?.includes('Super Admin') || user?.roles?.includes('Admin') || user?.roles?.includes('Employee'))) {
      return (
        <div className={fullScreen ? 'h-screen' : 'h-full'}>
          <AdminChatSupport user={user} />
        </div>
      );
    }
    
    // Regular user interface - can create and view their own chats
    return (
      <div className={fullScreen ? 'h-screen' : 'h-full'}>
        <ChatSupport 
          user={user} 
          customStyles={customStyles}
          hideHeader={hideHeader}
        />
      </div>
    );
  };

  // Show access denied for users without permissions (Super Admin always has access)
  if (permissions && !permissions.hasPermission && user && !user.roles?.includes('Super Admin') && (user.roles?.includes('Admin') || user.roles?.includes('Employee'))) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Access Restricted</h3>
          <p className="text-gray-600 mb-6 text-lg">
            You don't have permission to access chat support management.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Your access to this feature has been disabled by a Super Admin.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              <strong>Need access?</strong> Contact your Super Administrator to enable chat support permissions for your account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied if permissions failed to load and user is Admin/Employee
  if (!loading && !permissions && user && (user.roles?.includes('Admin') || user.roles?.includes('Employee'))) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Unable to Load Chat Support</h3>
          <p className="text-gray-600 mb-6 text-lg">
            There was an error loading your chat support permissions.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Please try refreshing the page or contact your administrator.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Ensure we have something to render - fallback to regular chat if no permissions data
  if (!loading && permissions === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-600">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <div>Loading chat support...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {getChatInterface()}
    </div>
  );
};

export default DynamicChatAccess;
