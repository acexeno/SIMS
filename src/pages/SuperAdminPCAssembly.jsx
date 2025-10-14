import React from 'react';
import { Shield, Settings, Users } from 'lucide-react';
import PCAssembly from './PCAssembly.jsx';

// Enhanced Super Admin PC Assembly component with proper styling and spacing
const SuperAdminPCAssembly = (props) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Super Admin Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 mb-6">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PC Assembly - Super Admin</h1>
                <p className="text-sm text-gray-600">Advanced PC building interface with administrative privileges</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                Super Admin Access
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with proper spacing for sidebar */}
      <div className="px-6 pb-8">
        <PCAssembly {...props} />
      </div>
    </div>
  );
};

export default SuperAdminPCAssembly; 