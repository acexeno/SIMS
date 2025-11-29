import React from 'react'
import { Shield } from 'lucide-react'
import PCAssembly from './PCAssembly.jsx'

const EmployeePCAssembly = (props) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="bg-white shadow-sm border-b border-gray-200 mb-4 sm:mb-6">
        <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">PC Assembly - Employee</h1>
                <p className="text-xs sm:text-sm text-gray-600">Create prebuilts directly</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-2 sm:px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm font-medium">Employee Access</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-2 sm:px-4 lg:px-6 pb-4 sm:pb-6 lg:pb-8">
        <PCAssembly {...props} saveToPrebuilts={true} hideCompleteButton={true} />
      </div>
    </div>
  )
}

export default EmployeePCAssembly