import React from 'react';
import PCAssembly from './PCAssembly.jsx';

// This component wraps the client PCAssembly and will be customized for Super Admin
const SuperAdminPCAssembly = (props) => {
  // You can add Super Admin-specific logic, props, or UI customizations here
  // For now, render the client PCAssembly and add a subtle placeholder action using shared utilities
  return (
    <div className="page-container">
      {/* Super Admin-specific actions can go here */}
      <div className="mb-4 flex justify-end">
        {/* Example: Placeholder for Super Admin-only button */}
        <button className="btn btn-outline">Super Admin Action</button>
      </div>
      <PCAssembly {...props} />
    </div>
  );
};

export default SuperAdminPCAssembly; 