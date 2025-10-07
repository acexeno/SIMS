import React from 'react'
import { X, Star, CheckCircle, Package, Zap, HardDrive, Cpu, Monitor, MemoryStick, Server, Thermometer } from 'lucide-react'
import { getComponentImage } from '../utils/componentImages'
import { formatCurrencyPHP } from '../utils/currency'

const categoryMapping = {
  cpu: 'CPU',
  motherboard: 'Motherboard',
  gpu: 'GPU',
  ram: 'RAM',
  storage: 'Storage',
  psu: 'PSU',
  case: 'Case',
  cooler: 'Cooler',
}

const getComponentType = (component) => {
  if (component.socket) return 'CPU'
  if (component.chipset || component.ram_type || component.form_factor) return 'Motherboard'
  if (component.chipset && component.memory) return 'GPU'
  if (component.type && component.speed) return 'RAM'
  if (component.capacity && component.type && (component.type.toLowerCase().includes('ssd') || component.type.toLowerCase().includes('hdd'))) return 'Storage'
  if (component.wattage && component.efficiency) return 'PSU'
  if (component.form_factor && component.fans) return 'Case'
  if (component.type && component.tdp) return 'Cooler'
  return 'Component'
}

const getCategoryIcon = (component) => {
  const type = getComponentType(component)
  switch (type) {
    case 'CPU': return <Cpu className="w-6 h-6 text-blue-600" />
    case 'Motherboard': return <Server className="w-6 h-6 text-purple-600" />
    case 'GPU': return <Monitor className="w-6 h-6 text-green-600" />
    case 'RAM': return <MemoryStick className="w-6 h-6 text-orange-600" />
    case 'Storage': return <HardDrive className="w-6 h-6 text-indigo-600" />
    case 'PSU': return <Zap className="w-6 h-6 text-yellow-600" />
    case 'Case': return <Package className="w-6 h-6 text-gray-600" />
    case 'Cooler': return <Thermometer className="w-6 h-6 text-red-600" />
    default: return <Package className="w-6 h-6 text-gray-600" />
  }
}

const getSpecifications = (component) => {
  const specs = []
  if (component.socket) specs.push({ label: 'Socket', value: component.socket })
  if (component.cores) specs.push({ label: 'Cores', value: component.cores })
  if (component.threads) specs.push({ label: 'Threads', value: component.threads })
  if (component.tdp) specs.push({ label: 'TDP', value: `${component.tdp}W` })
  if (component.ram_type) specs.push({ label: 'RAM Type', value: component.ram_type })
  if (component.form_factor) specs.push({ label: 'Form Factor', value: component.form_factor })
  if (component.memory) specs.push({ label: 'Memory', value: component.memory })
  if (component.type && getComponentType(component) === 'RAM') specs.push({ label: 'Type', value: component.type })
  if (component.speed) specs.push({ label: 'Speed', value: component.speed })
  if (component.capacity && getComponentType(component) === 'Storage') specs.push({ label: 'Capacity', value: component.capacity })
  if (component.wattage) specs.push({ label: 'Wattage', value: `${component.wattage}W` })
  if (component.efficiency) specs.push({ label: 'Efficiency', value: component.efficiency })
  if (component.fans) specs.push({ label: 'Fans', value: `${component.fans} included` })
  if (component.chipset) specs.push({ label: 'Chipset', value: component.chipset })
  return specs
}

const getPerformanceRating = (component) => {
  if (component.price > 500) return 5
  if (component.price > 300) return 4
  if (component.price > 150) return 3
  if (component.price > 50) return 2
  return 1
}

const ComponentPreview = ({ component, onClose }) => {
  if (!component) return null
  const performanceRating = getPerformanceRating(component)
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            {getCategoryIcon(component)}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{component.name}</h2>
              <p className="text-gray-600 flex items-center gap-2">
                {getComponentType(component)}
                <span className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-4 h-4 ${i < performanceRating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                    />
                  ))}
                  <span className="text-sm text-gray-500 ml-1">({performanceRating}.0)</span>
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Image and Price */}
            <div className="space-y-6">
              <div className="relative">
                <img
                  src={getComponentImage(component.name, getComponentType(component).toLowerCase())}
                  alt={component.name}
                  className="w-full h-80 object-cover rounded-lg shadow-lg"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
                <div className="hidden w-full h-80 items-center justify-center bg-gray-100 rounded-lg">
                  <span className="text-6xl text-gray-400">🔲</span>
                </div>
                <div className="absolute top-4 right-4 bg-white rounded-full px-3 py-1 flex items-center gap-1 shadow-md">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-sm font-medium">{performanceRating}.0</span>
                </div>
              </div>
              {/* Price */}
              <div className="text-center bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
                <span className="text-4xl font-bold text-green-600">
                  {formatCurrencyPHP(component.price)}
                </span>

                <p className="text-sm text-gray-600 mt-2">Free shipping • In stock</p>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600">Compatibility checked</span>
                </div>
              </div>
            </div>
            {/* Specifications and Details */}
            <div className="space-y-6">
              {/* Specifications */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Specifications
                </h3>
                <div className="space-y-2">
                  {/* Warranty (top-level or in specs) */}
                  {(component.warranty || (component.specs && component.specs.warranty)) && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600 font-medium">Warranty:</span>
                      <span className="font-semibold text-gray-900">{component.warranty || component.specs.warranty}</span>
                    </div>
                  )}
                  {getSpecifications(component).map((spec, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-gray-200 last:border-b-0">
                      <span className="text-gray-600 font-medium">{spec.label}:</span>
                      <span className="font-semibold text-gray-900">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Description
                </h3>
                <p className="text-gray-600 leading-relaxed bg-white rounded-lg p-4 border border-gray-200">
                  {component.specs}
                </p>
              </div>
              {/* Key Features */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Key Features
                </h3>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>High performance and reliability</span>
                    </li>
                    <li className="flex items-center gap-2 text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>Compatible with modern systems</span>
                    </li>
                    <li className="flex items-center gap-2 text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>Manufacturer warranty included</span>
                    </li>
                    <li className="flex items-center gap-2 text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>Expert technical support</span>
                    </li>
                    <li className="flex items-center gap-2 text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>Free compatibility checking</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
            <button 
              className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              onClick={onClose}
            >
              <CheckCircle className="w-5 h-5" />
              Close Preview
            </button>
            <button 
              className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Package className="w-5 h-5" />
              View Similar Products
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ComponentPreview 