import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  Shield, 
  Zap, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Monitor, 
  Thermometer, 
  Server, 
  Package,
  ArrowRight,
  ArrowLeft,
  Filter,
  Search
} from 'lucide-react';
import { getComponentImage } from '../utils/componentImages';
import { extractComponentSpecs, checkCompatibility } from '../utils/compatibilityService';

const CompatibilityComparisonModal = ({ 
  isOpen, 
  onClose, 
  selectedComponents, 
  currentCategory, 
  allComponents = [],
  onComponentSelect 
}) => {
  const [activeTab, setActiveTab] = useState('compatible');
  const [showIncompatible, setShowIncompatible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filteredComponents, setFilteredComponents] = useState({ compatible: [], incompatible: [] });

  const categories = [
    { id: 'cpu', name: 'CPU', icon: Cpu, description: 'Brain of your PC' },
    { id: 'motherboard', name: 'Motherboard', icon: Server, description: 'Connects everything' },
    { id: 'gpu', name: 'Graphics Card', icon: Monitor, description: 'Handles graphics' },
    { id: 'ram', name: 'RAM', icon: MemoryStick, description: 'System memory' },
    { id: 'storage', name: 'Storage', icon: HardDrive, description: 'Data storage' },
    { id: 'psu', name: 'Power Supply', icon: Zap, description: 'Powers everything' },
    { id: 'case', name: 'Case', icon: Package, description: 'Houses components' },
    { id: 'cooler', name: 'Cooler', icon: Thermometer, description: 'Keeps it cool' }
  ];

  // Filter and sort components
  useEffect(() => {
    if (allComponents.length > 0) {
      const compatible = [];
      const incompatible = [];

      allComponents.forEach(component => {
        // Check compatibility with current selections
        const compatibility = checkComponentCompatibility(component);
        
        if (compatibility.compatible) {
          compatible.push({ ...component, compatibility });
        } else {
          incompatible.push({ ...component, compatibility });
        }
      });

      // Apply search filter
      const filterBySearch = (components) => {
        if (!searchTerm) return components;
        return components.filter(component => 
          component.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          component.brand?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      };

      // Apply sorting
      const sortComponents = (components) => {
        return [...components].sort((a, b) => {
          switch (sortBy) {
            case 'price':
              return (a.price || 0) - (b.price || 0);
            case 'name':
              return (a.name || '').localeCompare(b.name || '');
            case 'brand':
              return (a.brand || '').localeCompare(b.brand || '');
            default:
              return 0;
          }
        });
      };

      setFilteredComponents({
        compatible: sortComponents(filterBySearch(compatible)),
        incompatible: sortComponents(filterBySearch(incompatible))
      });
    }
  }, [allComponents, searchTerm, sortBy, selectedComponents, currentCategory]);

  // Check component compatibility
  const checkComponentCompatibility = (component) => {
    const issues = [];
    let overallCompatible = true;

    // Check compatibility based on current category
    switch (currentCategory) {
      case 'motherboard':
        if (selectedComponents.cpu) {
          const cpuMoboCheck = checkCompatibility(selectedComponents.cpu, component, 'cpu_motherboard');
          if (!cpuMoboCheck.compatible) {
            issues.push(cpuMoboCheck.reason);
            overallCompatible = false;
          }
        }
        break;
        
      case 'ram':
        if (selectedComponents.motherboard) {
          const ramMoboCheck = checkCompatibility(component, selectedComponents.motherboard, 'ram_motherboard');
          if (!ramMoboCheck.compatible) {
            issues.push(ramMoboCheck.reason);
            overallCompatible = false;
          }
        }
        break;
        
      case 'case':
        if (selectedComponents.motherboard) {
          const caseMoboCheck = checkCompatibility(component, selectedComponents.motherboard, 'case_motherboard');
          if (!caseMoboCheck.compatible) {
            issues.push(caseMoboCheck.reason);
            overallCompatible = false;
          }
        }
        break;
        
      case 'psu':
        const psuCheck = checkCompatibility(component, selectedComponents, 'psu_power');
        if (!psuCheck.compatible) {
          issues.push(psuCheck.reason);
          overallCompatible = false;
        }
        break;
        
      case 'gpu':
        if (selectedComponents.case) {
          const gpuCaseCheck = checkCompatibility(component, selectedComponents.case, 'gpu_case');
          if (!gpuCaseCheck.compatible) {
            issues.push(gpuCaseCheck.reason);
            overallCompatible = false;
          }
        }
        break;
        
      case 'cooler':
        if (selectedComponents.case) {
          const coolerCaseCheck = checkCompatibility(component, selectedComponents.case, 'cooler_case');
          if (!coolerCaseCheck.compatible) {
            issues.push(coolerCaseCheck.reason);
            overallCompatible = false;
          }
        }
        break;
    }

    return {
      compatible: overallCompatible,
      issues,
      reason: issues.length > 0 ? issues.join('; ') : 'Compatible with current selections'
    };
  };

  // Get compatibility details
  const getCompatibilityDetails = (component) => {
    if (!component.compatibility) return null;

    const details = [];
    
    // Add socket information for CPUs and motherboards
    if (currentCategory === 'cpu' || currentCategory === 'motherboard') {
      const socket = extractComponentSpecs(component, 'socket');
      if (socket) {
        details.push({ label: 'Socket', value: socket });
      }
    }

    // Add RAM type for RAM and motherboards
    if (currentCategory === 'ram' || currentCategory === 'motherboard') {
      const ramType = extractComponentSpecs(component, 'ram_type');
      if (ramType) {
        details.push({ label: 'RAM Type', value: ramType });
      }
    }

    // Add form factor for cases and motherboards
    if (currentCategory === 'case' || currentCategory === 'motherboard') {
      const formFactor = extractComponentSpecs(component, 'form_factor');
      if (formFactor) {
        details.push({ label: 'Form Factor', value: formFactor });
      }
    }

    // Add wattage for PSUs
    if (currentCategory === 'psu') {
      const wattage = extractComponentSpecs(component, 'wattage');
      if (wattage) {
        details.push({ label: 'Wattage', value: `${wattage}W` });
      }
    }

    // Add dimensions for GPUs and coolers
    if (currentCategory === 'gpu') {
      const length = extractComponentSpecs(component, 'length');
      if (length) {
        details.push({ label: 'Length', value: `${length}mm` });
      }
    }

    if (currentCategory === 'cooler') {
      const height = extractComponentSpecs(component, 'height');
      if (height) {
        details.push({ label: 'Height', value: `${height}mm` });
      }
    }

    return details;
  };

  // Render component card
  const renderComponentCard = (component, isCompatible) => {
    const compatibilityDetails = getCompatibilityDetails(component);
    const isSelected = selectedComponents[currentCategory]?.id === component.id;

    return (
      <div 
        key={component.id}
        className={`bg-white rounded-lg border-2 p-4 transition-all duration-200 hover:shadow-lg ${
          isSelected 
            ? 'border-green-500 bg-green-50' 
            : isCompatible 
              ? 'border-gray-200 hover:border-green-300' 
              : 'border-red-200 bg-red-50'
        }`}
      >
        {/* Component Image */}
        <div className="flex justify-center mb-4">
          <img
            src={getComponentImage(component, currentCategory)}
            alt={component.name}
            className="w-20 h-20 object-contain"
            onError={(e) => {
              e.target.src = '/images/components/default.png';
            }}
          />
        </div>

        {/* Component Info */}
        <div className="text-center mb-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
            {component.name}
          </h3>
          {component.brand && (
            <p className="text-gray-600 text-xs mb-2">
              {component.brand}{component.model ? ` • ${component.model}` : ''}
            </p>
          )}
          {component.price !== undefined && component.price !== null && (
            <p className="text-green-600 font-bold text-lg">
              ₱{component.price.toLocaleString()}
            </p>
          )}
        </div>

        {/* Compatibility Details */}
        {compatibilityDetails && compatibilityDetails.length > 0 && (
          <div className="mb-4 space-y-2">
            {compatibilityDetails.map((detail, index) => (
              <div key={index} className="flex justify-between text-xs">
                <span className="text-gray-600">{detail.label}:</span>
                <span className="font-medium text-gray-900">{detail.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Compatibility Status */}
        <div className="mb-4 p-3 rounded-lg bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">Status:</span>
            {isCompatible ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
          <p className="text-xs text-gray-600">
            {component.compatibility?.reason || 'Compatibility unknown'}
          </p>
          {component.compatibility?.issues && component.compatibility.issues.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-red-600 mb-1">Issues:</p>
              <ul className="text-xs text-red-600 space-y-1">
                {component.compatibility.issues.map((issue, index) => (
                  <li key={index} className="flex items-start">
                    <XCircle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            if (isCompatible) {
              onComponentSelect(currentCategory, component);
              onClose();
            }
          }}
          disabled={!isCompatible}
          className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            isCompatible
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isCompatible ? 'Select Component' : 'Incompatible'}
        </button>
      </div>
    );
  };

  if (!isOpen) return null;

  const currentCategoryInfo = categories.find(cat => cat.id === currentCategory);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {currentCategoryInfo && (
              <>
                <currentCategoryInfo.icon className="w-8 h-8 text-green-600" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {currentCategoryInfo.name} Compatibility Comparison
                  </h2>
                  <p className="text-sm text-gray-600">
                    Compare compatible and incompatible components
                  </p>
                </div>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="name">Sort by Name</option>
              <option value="price">Sort by Price</option>
              <option value="brand">Sort by Brand</option>
            </select>
            <div className="flex items-center gap-2 ml-auto">
              <input
                id="toggle-incompatible"
                type="checkbox"
                checked={showIncompatible}
                onChange={(e) => setShowIncompatible(e.target.checked)}
              />
              <label htmlFor="toggle-incompatible" className="text-sm text-gray-700 select-none">
                Show Incompatible
              </label>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('compatible')}
              className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
                activeTab === 'compatible'
                  ? 'text-green-600 border-b-2 border-green-500 bg-green-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Compatible ({filteredComponents.compatible.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('incompatible')}
              className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
                activeTab === 'incompatible'
                  ? 'text-red-600 border-b-2 border-red-500 bg-red-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <XCircle className="w-5 h-5" />
                Incompatible ({filteredComponents.incompatible.length})
              </div>
            </button>
          </div>

          {/* Components Grid */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {activeTab === 'compatible' ? (
              filteredComponents.compatible.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredComponents.compatible.map(component => 
                    renderComponentCard(component, true)
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Compatible Components</h3>
                  <p className="text-gray-600">
                    {searchTerm ? 'Try adjusting your search terms.' : 'No compatible components found for your current selections.'}
                  </p>
                </div>
              )
            ) : (
              showIncompatible ? (
                filteredComponents.incompatible.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredComponents.incompatible.map(component => 
                      renderComponentCard(component, false)
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <XCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Incompatible Components</h3>
                    <p className="text-gray-600">
                      {searchTerm ? 'Try adjusting your search terms.' : 'All components are compatible with your current selections.'}
                    </p>
                  </div>
                )
              ) : (
                <div className="text-center py-12">
                  <XCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Show Incompatible</h3>
                  <p className="text-gray-600">Toggle "Show Incompatible" to view incompatible options</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield className="w-4 h-4" />
              <span>Compatibility is checked against your current component selections</span>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompatibilityComparisonModal;
