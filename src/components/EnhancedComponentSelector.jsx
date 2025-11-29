import React, { useState, useMemo } from 'react'
import { Search, Plus, CheckCircle, AlertTriangle, ArrowRight, Package } from 'lucide-react'
import { getComponentImage } from '../utils/componentImages'
import { formatCurrencyPHP } from '../utils/currency'

// Helper function to determine component type from component data
const getComponentType = (component) => {
  if (component.socket) return 'cpu'
  if (component.chipset || component.ram_type || component.form_factor) return 'motherboard'
  if (component.chipset && component.memory) return 'gpu'
  if (component.type && component.speed) return 'ram'
  if (component.capacity && component.type && (component.type.toLowerCase().includes('ssd') || component.type.toLowerCase().includes('hdd'))) return 'storage'
  if (component.wattage && component.efficiency) return 'psu'
  if (component.form_factor && component.fans) return 'case'
  if (component.type && component.tdp) return 'cooler'
  return 'default'
}

// Map frontend categories to database categories
const categoryMapping = {
  'cpu': 'CPU',
  'motherboard': 'Motherboard',
  'gpu': 'GPU',
  'ram': 'RAM',
  'storage': 'Storage',
  'psu': 'PSU',
  'case': 'Case',
  'cooler': 'Cooler'
}

/**
 * EnhancedComponentSelector - Displays components for selection with prefetched data
 */
const EnhancedComponentSelector = ({
  selectedComponents = {},
  onComponentSelect = () => {},
  onComponentRemove = () => {},
  activeCategory = '',
  prefetchedComponents = [],
  recommendations = [],
  loadingRecommendations = false,
  compatibilityIssues = [],
  branch = null
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('name')

  // Filter components by active category
  // Note: prefetchedComponents are already filtered by category from PCAssembly API call
  // The API endpoint filters by category_id, so we can use all prefetchedComponents directly
  const categoryComponents = useMemo(() => {
    if (!prefetchedComponents || prefetchedComponents.length === 0) return []
    
    // Since PCAssembly already fetches components filtered by activeCategory,
    // we can use all prefetchedComponents directly - they're already filtered
    return prefetchedComponents
  }, [prefetchedComponents])

  // Filter and sort components
  const filteredComponents = useMemo(() => {
    return categoryComponents.filter(component =>
      component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (component.brand && component.brand.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [categoryComponents, searchTerm])

  const sortedComponents = useMemo(() => {
    return [...filteredComponents].sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return (a.price || 0) - (b.price || 0)
        case 'name':
          return (a.name || '').localeCompare(b.name || '')
        default:
          return 0
      }
    })
  }, [filteredComponents, sortBy])

  const selectedComponent = selectedComponents[activeCategory]

  // If no components, show empty state
  if (!prefetchedComponents || prefetchedComponents.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No components available</h3>
          <p className="text-gray-600">Components are being loaded...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder={`Search ${activeCategory || 'components'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="name">Sort by Name</option>
            <option value="price">Sort by Price</option>
          </select>
        </div>
      </div>

      {/* Compatibility Warnings */}
      {compatibilityIssues.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h3 className="text-sm font-semibold text-orange-900">Compatibility Warnings</h3>
          </div>
          <div className="space-y-2">
            {compatibilityIssues.map((issue, idx) => (
              <p key={idx} className="text-sm text-orange-800">{issue.message}</p>
            ))}
          </div>
        </div>
      )}

      {/* Currently Selected Component */}
      {selectedComponent && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">Currently Selected</h3>
                <p className="text-green-700">{selectedComponent.name}</p>
                <p className="text-sm text-green-600">{formatCurrencyPHP(selectedComponent.price)}</p>
              </div>
            </div>
            <button
              onClick={() => onComponentRemove(activeCategory)}
              className="px-3 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Recommended Components</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommendations.slice(0, 3).map((rec) => (
              <div key={rec.id} className="bg-white rounded-lg p-3 border border-blue-200 hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <img 
                      src={getComponentImage(rec.name, getComponentType(rec))} 
                      alt={rec.name} 
                      className="w-10 h-10 rounded object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = 'flex'
                        }
                      }}
                    />
                    <div className="hidden w-10 h-10 bg-gray-200 rounded items-center justify-center">
                      <Package className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-semibold text-gray-900 truncate">{rec.name}</h5>
                    <span className="text-sm font-bold text-blue-600">{formatCurrencyPHP(rec.price)}</span>
                  </div>
                  <button
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    onClick={() => onComponentSelect(activeCategory, rec)}
                  >
                    <ArrowRight className="w-3 h-3" />
                    Select
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Component Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedComponents.map((component) => (
          <div
            key={component.id}
            className={`bg-white rounded-lg border-2 transition-all duration-200 hover:shadow-lg ${
              selectedComponent?.id === component.id
                ? 'border-green-500 shadow-lg'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="p-6">
              {/* Component Image */}
              <div className="w-full h-32 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                <img
                  src={getComponentImage(component.name, getComponentType(component))}
                  alt={component.name}
                  className="w-full h-full object-cover rounded-lg"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    if (e.target.nextSibling) {
                      e.target.nextSibling.style.display = 'flex'
                    }
                  }}
                />
                <div className="hidden w-full h-full items-center justify-center text-gray-400">
                  <Package className="w-12 h-12" />
                </div>
              </div>

              {/* Component Info */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg mb-1">{component.name}</h3>
                  {component.brand && <p className="text-sm text-gray-600 mb-2">{component.brand}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-green-600">{formatCurrencyPHP(component.price)}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => onComponentSelect(activeCategory, component)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedComponent?.id === component.id
                        ? 'bg-green-600 text-white'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {selectedComponent?.id === component.id ? (
                      <>
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                        Selected
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 inline mr-1" />
                        Select
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* No Results */}
      {sortedComponents.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No components found</h3>
          <p className="text-gray-600">Try adjusting your search terms.</p>
        </div>
      )}
    </div>
  )
}

export default EnhancedComponentSelector
