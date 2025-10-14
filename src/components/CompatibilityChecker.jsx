/**
 * CompatibilityChecker: visualizes build compatibility, prioritizing critical checks,
 * score, progress, and actionable recommendations.
 */
import React from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, Zap, Shield, Cpu, HardDrive, MemoryStick, Package, Thermometer, Monitor, ArrowRight, Lightbulb } from 'lucide-react'

const CompatibilityChecker = ({ compatibilityStatus, compatibilityScore, compatibilityDetails = {}, selectionProgress = 0 }) => {
  // Catalog of checks: define label, description, severity, and source fields
  const compatibilityChecks = [
    {
      id: 'cpu_motherboard',
      name: 'CPU & Motherboard',
      description: 'Socket compatibility check',
      status: compatibilityStatus.cpu_motherboard,
      detail: compatibilityDetails.cpu_motherboard,
      icon: <Cpu className="w-5 h-5" />,
      critical: true
    },
    {
      id: 'ram_motherboard',
      name: 'RAM & Motherboard',
      description: 'Memory type and speed compatibility',
      status: compatibilityStatus.ram_motherboard,
      detail: compatibilityDetails.ram_motherboard,
      icon: <MemoryStick className="w-5 h-5" />,
      critical: true
    },
    {
      id: 'ram_slots',
      name: 'RAM Slots',
      description: 'RAM modules vs motherboard slots',
      status: compatibilityStatus.ram_slots,
      detail: compatibilityDetails.ram_slots,
      icon: <MemoryStick className="w-5 h-5" />,
      critical: true
    },
    {
      id: 'ram_speed',
      name: 'RAM Speed',
      description: 'Memory speed vs motherboard support',
      status: compatibilityStatus.ram_speed,
      detail: compatibilityDetails.ram_speed,
      icon: <MemoryStick className="w-5 h-5" />,
      critical: false
    },
    {
      id: 'storage_interface',
      name: 'Storage Interface',
      description: 'Storage connection compatibility',
      status: compatibilityStatus.storage_interface,
      detail: compatibilityDetails.storage_interface,
      icon: <HardDrive className="w-5 h-5" />,
      critical: true
    },
    {
      id: 'psu_power',
      name: 'Power Supply',
      description: 'Adequate power for components',
      status: compatibilityStatus.psu_power,
      detail: compatibilityDetails.psu_power,
      icon: <Zap className="w-5 h-5" />,
      critical: true
    },
    {
      id: 'psu_form_factor',
      name: 'PSU Form Factor',
      description: 'PSU size vs case support',
      status: compatibilityStatus.psu_form_factor,
      detail: compatibilityDetails.psu_form_factor,
      icon: <Zap className="w-5 h-5" />,
      critical: true
    },
    {
      id: 'case_motherboard',
      name: 'Case & Motherboard',
      description: 'Form factor compatibility',
      status: compatibilityStatus.case_motherboard,
      detail: compatibilityDetails.case_motherboard,
      icon: <Package className="w-5 h-5" />,
      critical: true
    },
    {
      id: 'gpu_length',
      name: 'GPU & Case',
      description: 'Graphics card length fit',
      status: compatibilityStatus.gpu_length,
      detail: compatibilityDetails.gpu_length,
      icon: <Monitor className="w-5 h-5" />,
      critical: true
    },
    {
      id: 'cooler_height',
      name: 'CPU Cooler & Case',
      description: 'Cooler height clearance',
      status: compatibilityStatus.cooler_height,
      detail: compatibilityDetails.cooler_height,
      icon: <Thermometer className="w-5 h-5" />,
      critical: false
    },
    {
      id: 'cooler_socket',
      name: 'CPU Cooler Socket',
      description: 'Cooler socket compatibility',
      status: compatibilityStatus.cooler_socket,
      detail: compatibilityDetails.cooler_socket,
      icon: <Thermometer className="w-5 h-5" />,
      critical: true
    },
    {
      id: 'ram_cpu_speed',
      name: 'RAM & CPU Speed',
      description: 'Memory speed vs CPU support',
      status: compatibilityStatus.ram_cpu_speed,
      detail: compatibilityDetails.ram_cpu_speed,
      icon: <MemoryStick className="w-5 h-5" />,
      critical: false
    }
  ];

  // Only show evaluations that have a computed status
  const activeChecks = compatibilityChecks.filter(check => check.status !== undefined);
  const criticalChecks = activeChecks.filter(check => check.critical);
  const nonCriticalChecks = activeChecks.filter(check => !check.critical);

  // Score color helpers for quick visual parsing
  const getScoreColor = (score) => {
    if (score === 0) return 'text-gray-600'
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Background color scale for score bar
  const getScoreBg = (score) => {
    if (score === 0) return 'bg-gray-100'
    if (score >= 90) return 'bg-green-100'
    if (score >= 70) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  // Map boolean/undefined status to icons
  const getStatusIcon = (status) => {
    if (status === true) return <CheckCircle className="w-6 h-6 text-green-600" />
    if (status === false) return <XCircle className="w-6 h-6 text-red-600" />
    return <Info className="w-6 h-6 text-gray-400" />
  }

  // Human-readable status label
  const getStatusText = (status) => {
    if (status === true) return 'Compatible'
    if (status === false) return 'Incompatible'
    return 'Not checked'
  }

  // Status text color
  const getStatusColor = (status) => {
    if (status === true) return 'text-green-600'
    if (status === false) return 'text-red-600'
    return 'text-gray-500'
  }

  // Status background color
  const getStatusBg = (status) => {
    if (status === true) return 'bg-green-50 border-green-200'
    if (status === false) return 'bg-red-50 border-red-200'
    return 'bg-gray-50 border-gray-200'
  }

  // Progress bar color scale
  const getProgressColor = (score) => {
    if (score === 0) return 'bg-gray-400'
    if (score >= 90) return 'bg-green-500'
    if (score >= 70) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  // Get critical issues count
  const criticalIssues = criticalChecks.filter(check => check.status === false).length;
  const totalCriticalChecks = criticalChecks.length;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
      {/* Enhanced Header with Better Visual Hierarchy */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Compatibility Checker</h3>
              <p className="text-sm text-gray-600">Real-time compatibility validation for your PC build</p>
            </div>
          </div>
          {criticalIssues > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-800 font-semibold">
                {criticalIssues} Critical Issue{criticalIssues > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        
        {/* Enhanced Progress Section */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Component Selection</span>
                <span className="text-sm font-bold text-gray-900">{selectionProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-700 ${getProgressColor(selectionProgress)}`}
                  style={{ width: `${selectionProgress}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Compatibility Score</span>
                <span className={`text-sm font-bold ${getScoreColor(compatibilityScore)}`}>{compatibilityScore}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-700 ${getProgressColor(compatibilityScore)}`}
                  style={{ width: `${compatibilityScore}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {/* Status Message */}
          <div className={`p-3 rounded-lg border-l-4 ${
            selectionProgress === 0 
              ? 'bg-blue-50 border-blue-400' 
              : compatibilityScore === 100 
              ? 'bg-green-50 border-green-400'
              : criticalIssues > 0
              ? 'bg-red-50 border-red-400'
              : 'bg-yellow-50 border-yellow-400'
          }`}>
            <p className={`text-sm font-medium ${
              selectionProgress === 0 
                ? 'text-blue-800' 
                : compatibilityScore === 100 
                ? 'text-green-800'
                : criticalIssues > 0
                ? 'text-red-800'
                : 'text-yellow-800'
            }`}>
              {selectionProgress === 0
                ? "Start building by selecting components from the categories above"
                : selectionProgress < 100
                ? `${7 - Math.round(selectionProgress / 14.28)} more components needed to complete your build`
                : compatibilityScore === 100
                ? "Excellent! Your build is fully compatible and ready for assembly"
                : compatibilityScore > 0
                ? `${compatibilityScore}% compatibility - ${criticalIssues > 0 ? 'Fix critical issues below' : 'Minor optimizations available'}`
                : "Compatibility issues detected - review the checks below"
              }
            </p>
          </div>
        </div>
      </div>

      {/* Critical Compatibility Checks */}
      {criticalChecks.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-gray-900">Critical Compatibility Checks</h4>
                <p className="text-sm text-gray-600">These checks must pass for your build to work properly</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {criticalChecks.filter(c => c.status === true).length}/{criticalChecks.length}
              </div>
              <div className="text-sm text-gray-600">Passed</div>
            </div>
          </div>
          
          <div className="grid gap-4">
            {criticalChecks.map((check) => (
              <div
                key={check.id}
                className={`p-5 rounded-xl border-2 transition-all duration-300 hover:shadow-md ${
                  check.status === true 
                    ? 'bg-green-50 border-green-200' 
                    : check.status === false 
                    ? 'bg-red-50 border-red-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${
                    check.status === true 
                      ? 'bg-green-100' 
                      : check.status === false 
                      ? 'bg-red-100' 
                      : 'bg-gray-100'
                  }`}>
                    {check.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-lg font-semibold text-gray-900">{check.name}</h5>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(check.status)}
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          check.status === true 
                            ? 'bg-green-100 text-green-800' 
                            : check.status === false 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {getStatusText(check.status)}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 mb-3">{check.description}</p>
                    
                    {/* Enhanced detail display */}
                    {(check.status === false || (check.status === true && check.detail)) && check.detail && (
                      <div className={`p-3 rounded-lg border ${
                        check.status === false 
                          ? 'bg-red-50 border-red-200 text-red-800' 
                          : 'bg-blue-50 border-blue-200 text-blue-800'
                      }`}>
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <div className="font-medium mb-1">
                              {check.status === false ? 'Issue:' : 'Note:'}
                            </div>
                            <div>{check.detail}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-Critical Compatibility Checks */}
      {nonCriticalChecks.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Info className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-gray-900">Additional Optimizations</h4>
                <p className="text-sm text-gray-600">These checks improve performance and efficiency</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {nonCriticalChecks.filter(c => c.status === true).length}/{nonCriticalChecks.length}
              </div>
              <div className="text-sm text-gray-600">Optimized</div>
            </div>
          </div>
          
          <div className="grid gap-4">
            {nonCriticalChecks.map((check) => (
              <div
                key={check.id}
                className={`p-5 rounded-xl border-2 transition-all duration-300 hover:shadow-md ${
                  check.status === true 
                    ? 'bg-green-50 border-green-200' 
                    : check.status === false 
                    ? 'bg-yellow-50 border-yellow-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${
                    check.status === true 
                      ? 'bg-green-100' 
                      : check.status === false 
                      ? 'bg-yellow-100' 
                      : 'bg-gray-100'
                  }`}>
                    {check.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-lg font-semibold text-gray-900">{check.name}</h5>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(check.status)}
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          check.status === true 
                            ? 'bg-green-100 text-green-800' 
                            : check.status === false 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {getStatusText(check.status)}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 mb-3">{check.description}</p>
                    
                    {/* Enhanced detail display */}
                    {(check.status === false || (check.status === true && check.detail)) && check.detail && (
                      <div className={`p-3 rounded-lg border ${
                        check.status === false 
                          ? 'bg-yellow-50 border-yellow-200 text-yellow-800' 
                          : 'bg-blue-50 border-blue-200 text-blue-800'
                      }`}>
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <div className="font-medium mb-1">
                              {check.status === false ? 'Recommendation:' : 'Note:'}
                            </div>
                            <div>{check.detail}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Compatibility Tips */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Lightbulb className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-blue-900 mb-3">Build Tips & Best Practices</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium text-blue-800 mb-2">Essential Checks</h5>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• CPU socket matches motherboard (AM4, AM5, LGA1200, LGA1700)</li>
                    <li>• RAM type compatibility (DDR4/DDR5) and speed support</li>
                    <li>• PSU wattage with 20% buffer for efficiency</li>
                    <li>• Case supports motherboard form factor</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-blue-800 mb-2">Performance Tips</h5>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Check GPU length and CPU cooler height clearance</li>
                    <li>• Consider aftermarket cooler for better performance</li>
                    <li>• Match RAM speed to CPU and motherboard support</li>
                    <li>• Ensure adequate case airflow and cooling</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Overall Status Messages */}
      {compatibilityScore === 100 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-bold text-green-900 mb-2">Perfect Build Ready!</h4>
              <p className="text-green-800 mb-3">All components are fully compatible and your PC is ready for assembly.</p>
              <div className="flex items-center gap-4 text-sm text-green-700">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  All critical checks passed
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Build ready for assembly
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {compatibilityScore > 0 && compatibilityScore < 100 && criticalIssues === 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl border-2 border-yellow-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-full">
              <AlertTriangle className="w-8 h-8 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-bold text-yellow-900 mb-2">Good Build with Optimizations Available</h4>
              <p className="text-yellow-800 mb-3">Your build will work well, but consider the optimization recommendations above for better performance.</p>
              <div className="flex items-center gap-4 text-sm text-yellow-700">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  All critical checks passed
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Minor optimizations available
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {criticalIssues > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-xl border-2 border-red-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-full">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-bold text-red-900 mb-2">Critical Issues Must Be Fixed</h4>
              <p className="text-red-800 mb-3">
                {criticalIssues} critical compatibility issue{criticalIssues > 1 ? 's' : ''} detected. 
                Your build will not work properly until these issues are resolved.
              </p>
              <div className="flex items-center gap-4 text-sm text-red-700">
                <span className="flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  {criticalIssues} critical issue{criticalIssues > 1 ? 's' : ''} found
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Build not ready for assembly
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {compatibilityScore === 0 && Object.keys(compatibilityStatus).length === 0 && (
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border-2 border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 rounded-full">
              <Info className="w-8 h-8 text-gray-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-bold text-gray-900 mb-2">Start Building Your PC</h4>
              <p className="text-gray-800 mb-3">Select components from the categories above to begin checking compatibility and building your perfect PC.</p>
              <div className="flex items-center gap-4 text-sm text-gray-700">
                <span className="flex items-center gap-1">
                  <Info className="w-4 h-4" />
                  No components selected yet
                </span>
                <span className="flex items-center gap-1">
                  <ArrowRight className="w-4 h-4" />
                  Choose components to start
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompatibilityChecker 