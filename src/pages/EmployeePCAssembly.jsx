import React from 'react';
import { Shield, Users } from 'lucide-react';
import PCAssembly from './PCAssembly.jsx';

// Enhanced Employee PC Assembly component with proper styling and spacing
const EmployeePCAssembly = (props) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Employee Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 mb-6">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PC Assembly - Employee</h1>
                <p className="text-sm text-gray-600">PC building interface for employee use</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                Employee Access
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

export default EmployeePCAssembly;
