import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Check, ChevronDown, Cpu, Server, Monitor, MemoryStick, HardDrive, Zap, Package, Thermometer } from 'lucide-react';

const ComponentSearchInput = ({ 
  value = '', 
  onChange, 
  inventory = [], 
  categories = [],
  placeholder = "Search components...",
  className = "",
  disabled = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Category mapping with icons
  const categoryIcons = {
    'CPU': Cpu,
    'Motherboard': Server,
    'GPU': Monitor,
    'RAM': MemoryStick,
    'Storage': HardDrive,
    'PSU': Zap,
    'Case': Package,
    'Cooler': Thermometer
  };

  // Main categories for filtering
  const mainCategories = [
    { key: 'all', name: 'All', icon: null },
    { key: 'CPU', name: 'CPU', icon: Cpu },
    { key: 'Motherboard', name: 'Motherboard', icon: Server },
    { key: 'GPU', name: 'GPU', icon: Monitor },
    { key: 'RAM', name: 'RAM', icon: MemoryStick },
    { key: 'Storage', name: 'Storage', icon: HardDrive },
    { key: 'PSU', name: 'PSU', icon: Zap },
    { key: 'Case', name: 'Case', icon: Package },
    { key: 'Cooler', name: 'Cooler', icon: Thermometer }
  ];

  // Initialize with selected component name if value is provided
  useEffect(() => {
    if (value && inventory.length > 0) {
      const component = inventory.find(c => c.id.toString() === value.toString());
      if (component) {
        setSelectedComponent(component);
        setSearchTerm(component.name);
      }
    }
  }, [value, inventory]);

  // Helper function to get component category
  const getComponentCategory = (component) => {
    if (!categories.length) return null;
    const category = categories.find(cat => cat.id === Number(component.category_id));
    if (!category) return null;
    
    // Map database categories to main categories
    const categoryMapping = {
      'CPU': 'CPU',
      'Procie Only': 'CPU',
      'Pro & Mobo - Amd': 'CPU',
      'Pro & Mobo - Intel': 'CPU',
      'Motherboard': 'Motherboard',
      'Mobo': 'Motherboard',
      'GPU': 'GPU',
      'RAM': 'RAM',
      'Ram 3200mhz': 'RAM',
      'Storage': 'Storage',
      'Ssd Nvme': 'Storage',
      'PSU': 'PSU',
      'Psu - Tr': 'PSU',
      'Case': 'Case',
      'Case Gaming': 'Case',
      'Cooler': 'Cooler',
      'Aio': 'Cooler'
    };
    
    return categoryMapping[category.name] || null;
  };

  // Filter components based on search term and category
  const filteredComponents = inventory.filter(component => {
    const matchesSearch = searchTerm === '' || 
      component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (component.brand && component.brand.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || 
      getComponentCategory(component) === selectedCategory;
    
    return matchesSearch && matchesCategory;
  }).slice(0, 20); // Increased limit for better browsing

  // Group components by category for better organization
  const groupedComponents = filteredComponents.reduce((groups, component) => {
    const category = getComponentCategory(component) || 'Other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(component);
    return groups;
  }, {});

  const handleInputChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    setShowDropdown(term.length > 0);
    
    // Clear selection if user is typing
    if (selectedComponent && term !== selectedComponent.name) {
      setSelectedComponent(null);
      onChange('');
    }
  };

  const handleComponentSelect = (component) => {
    setSelectedComponent(component);
    setSearchTerm(component.name);
    setShowDropdown(false);
    setShowSelectDropdown(false);
    onChange(component.id.toString());
  };

  const handleSelectChange = (e) => {
    const componentId = e.target.value;
    if (componentId) {
      const component = inventory.find(c => c.id.toString() === componentId);
      if (component) {
        setSelectedComponent(component);
        setSearchTerm(component.name);
        onChange(componentId);
      }
    } else {
      setSelectedComponent(null);
      setSearchTerm('');
      onChange('');
    }
  };

  const handleClear = () => {
    setSelectedComponent(null);
    setSearchTerm('');
    setShowDropdown(false);
    setShowSelectDropdown(false);
    onChange('');
    inputRef.current?.focus();
  };


  const handleInputBlur = (e) => {
    // Delay hiding dropdown to allow clicks on options
    setTimeout(() => {
      if (!dropdownRef.current?.contains(e.relatedTarget)) {
        setShowDropdown(false);
      }
    }, 150);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      setShowSelectDropdown(false);
      inputRef.current?.blur();
    }
  };


  return (
    <div className={`relative ${className}`}>
      {/* Combined Search Input and Dropdown */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => {
            setShowDropdown(true);
            setShowSelectDropdown(false);
          }}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-10 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'
          }`}
        />
        <button
          type="button"
          onClick={() => {
            setShowSelectDropdown(!showSelectDropdown);
            setShowDropdown(false);
          }}
          disabled={disabled}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        {selectedComponent && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Filter Tabs */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {mainCategories.map((category) => {
            const IconComponent = category.icon;
            return (
              <button
                key={category.key}
                type="button"
                onClick={() => setSelectedCategory(category.key)}
                disabled={disabled}
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors ${
                  selectedCategory === category.key
                    ? 'bg-blue-100 text-blue-700 border-blue-300 shadow-sm'
                    : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200 hover:shadow-sm'
                } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              >
                {IconComponent && <IconComponent className="w-4 h-4" />}
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Unified Dropdown for both search results and component selection */}
      {(showDropdown || showSelectDropdown) && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute z-[9999] w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-2xl max-h-[32rem] overflow-y-auto"
          style={{
            maxHeight: '32rem', // 512px - significantly increased
            minHeight: '12rem', // 192px - increased minimum height
          }}
        >
          {/* Clear selection option */}
          <div
            onClick={() => {
              setSelectedComponent(null);
              setSearchTerm('');
              onChange('');
              setShowDropdown(false);
              setShowSelectDropdown(false);
            }}
            className="px-6 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 text-gray-500 font-medium"
          >
            Select Component
          </div>
          
          {/* Grouped Components */}
          {Object.entries(groupedComponents).map(([categoryName, components]) => {
            const category = mainCategories.find(cat => cat.key === categoryName);
            const IconComponent = category?.icon;
            
            return (
              <div key={categoryName}>
                {/* Category Header */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3 text-sm font-semibold text-gray-700">
                  {IconComponent && <IconComponent className="w-5 h-5" />}
                  {categoryName} ({components.length})
                </div>
                
                {/* Components in this category */}
                {components.map((component) => (
                  <div
                    key={component.id}
                    onClick={() => handleComponentSelect(component)}
                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex items-center justify-between transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-base">{component.name}</div>
                      {component.brand && (
                        <div className="text-sm text-gray-500 mt-1">{component.brand}</div>
                      )}
                      {component.price && (
                        <div className="text-sm text-green-600 font-semibold mt-1">
                          ₱{component.price.toLocaleString()}
                        </div>
                      )}
                    </div>
                    {selectedComponent && selectedComponent.id === component.id && (
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
          
          {/* No results message */}
          {filteredComponents.length === 0 && (
            <div className="px-6 py-8 text-gray-500 text-center">
              <div className="text-lg font-medium mb-2">No components found</div>
              <div className="text-sm">Try adjusting your search terms or category filter</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ComponentSearchInput;
