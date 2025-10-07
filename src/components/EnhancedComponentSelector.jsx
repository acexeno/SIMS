import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  Plus, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  Package,
  XCircle,
  Info,
  Shield,
  Zap,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  Thermometer,
  Server,
  Settings,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Lightbulb
} from 'lucide-react';
import { getComponentImage } from '../utils/componentImages';
import { API_BASE } from '../utils/apiBase';
// Resolve BASE_URL so fallback images work under /capstone2/dist/
const BASE_URL = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
const baseNoSlash = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
import { filterCompatibleComponents, extractComponentSpecs, predictCompatibilityForCategory, getSmartRecommendations, getRAMCompatibilityGuidance, getCaseCompatibilityGuidance } from '../utils/compatibilityService';

const EnhancedComponentSelector = ({ 
  selectedComponents, 
  onComponentSelect, 
  onComponentRemove, 
  activeCategory,
  recommendations = [],
  loadingRecommendations = false,
  compatibilityIssues = [],
  prefetchedComponents = [],
  branch = null
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showIncompatible, setShowIncompatible] = useState(true);
  const [showCompatibilityDetails, setShowCompatibilityDetails] = useState({});
  const [filteredComponents, setFilteredComponents] = useState({ compatible: [], incompatible: [] });
  const [refreshing, setRefreshing] = useState(false);

  // Fetch coordination refs
  const firstLoadRef = useRef(true);
  const lastCategoryRef = useRef(activeCategory);
  const requestSeqRef = useRef(0);
  const debounceRef = useRef(null);
  const hasDataRef = useRef(false);
  const cacheRef = useRef({}); // per-category cache to avoid empty UI on aborts
  const fallbackTriedRef = useRef(false);

  const categories = [
    { id: 'cpu', name: 'CPU', icon: Cpu, required: true, description: 'Brain of your PC' },
    { id: 'motherboard', name: 'Motherboard', icon: Server, required: true, description: 'Connects everything' },
    { id: 'gpu', name: 'Graphics Card', icon: Monitor, required: true, description: 'Handles graphics' },
    { id: 'ram', name: 'RAM', icon: MemoryStick, required: true, description: 'System memory' },
    { id: 'storage', name: 'Storage', icon: HardDrive, required: true, description: 'Data storage' },
    { id: 'psu', name: 'Power Supply', icon: Zap, required: true, description: 'Powers everything' },
    { id: 'case', name: 'Case', icon: Package, required: true, description: 'Houses components' },
    { id: 'cooler', name: 'Cooler', icon: Thermometer, required: false, description: 'Keeps it cool' }
  ];

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
  };

  // If parent already fetched the list for the current category, seed UI immediately
  useEffect(() => {
    if (Array.isArray(prefetchedComponents) && prefetchedComponents.length > 0) {
      try { console.debug('[ECS] Using prefetched components:', { count: prefetchedComponents.length, category: activeCategory }); } catch {}
      setComponents(prefetchedComponents);
      try { cacheRef.current[activeCategory] = prefetchedComponents; } catch {}
      const filtered = filterCompatibleComponents(prefetchedComponents, selectedComponents, activeCategory);
      setFilteredComponents(filtered);
      setLoading(false);
    }
  }, [prefetchedComponents, activeCategory, selectedComponents]);

  // Fetch components from API
  const abortRef = useRef(null);
  const inflightCategoryRef = useRef(null);
  const timeoutRef = useRef(null);
  const timedOutRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
    try { if (abortRef.current) abortRef.current.abort(); } catch {}
    try { if (timeoutRef.current) clearTimeout(timeoutRef.current); } catch {}
    try { if (debounceRef.current) clearTimeout(debounceRef.current); } catch {}
  }, []);

  const fetchComponents = useCallback(async () => {
    // Cancel any in-flight request before starting a new one
    const categoryChanged = lastCategoryRef.current !== activeCategory;
    // If we already have an in-flight request for the same category, don't abort it; just wait for it
    if (!categoryChanged && inflightCategoryRef.current === activeCategory && loading) {
      try { console.debug('[ECS] Reuse in-flight request for', activeCategory); } catch {}
      return;
    }
    // For category changes, abort previous request (if any)
    if (categoryChanged && abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }
    // Create a fresh AbortController per request
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    // Decide whether to show full loading or a soft refresh
    lastCategoryRef.current = activeCategory;
    if (firstLoadRef.current || categoryChanged || !hasDataRef.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    // Reset timeout state for this request
    if (timeoutRef.current) { try { clearTimeout(timeoutRef.current); } catch {} }
    timedOutRef.current = false;
    
    try {
      const seq = ++requestSeqRef.current;
      inflightCategoryRef.current = activeCategory;
      const dbCategory = categoryMapping[activeCategory];
      const url = `${API_BASE}/index.php?endpoint=components&category=${encodeURIComponent(dbCategory)}${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`;
      // Debug logging for difficult-to-reproduce loading states
      try { console.debug('[ECS] Fetching components:', { activeCategory, dbCategory, branch, url }); } catch {}
      // Add a safety timeout so the UI never spins forever if the backend hangs
      timeoutRef.current = setTimeout(() => {
        timedOutRef.current = true;
        try { controller.abort(); } catch {}
      }, 10000); // 10s timeout
      const response = await fetch(url, { signal: controller.signal });
      if (timeoutRef.current) { try { clearTimeout(timeoutRef.current); } catch {} }
      // If server returned non-JSON (e.g., PHP error), this can throw
      const data = await response.json().catch(async (e) => {
        const text = await response.text().catch(() => '');
        throw new Error(`Invalid JSON from server. Status=${response.status} ${response.statusText}. BodyPreview=${(text || '').slice(0,200)}`);
      });

      if (!mountedRef.current) return;
      // Ignore stale responses
      if (seq !== requestSeqRef.current) {
        try { console.debug('[ECS] Ignored stale response'); } catch {}
        return;
      }

      if (data.success) {
        try { console.debug('[ECS] Loaded components:', { category: dbCategory, count: Array.isArray(data.data) ? data.data.length : 'n/a' }); } catch {}
        
        // Deduplicate components by id, then by name+brand combination
        const deduplicatedComponents = [];
        const seenIds = new Set();
        const seenNames = new Set();
        
        if (Array.isArray(data.data)) {
          data.data.forEach(component => {
            const id = component.id;
            const nameKey = `${(component.name || '').toLowerCase().trim()}-${(component.brand || '').toLowerCase().trim()}`;
            
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              deduplicatedComponents.push(component);
            } else if (!id && !seenNames.has(nameKey)) {
              seenNames.add(nameKey);
              deduplicatedComponents.push(component);
            }
          });
        }
        
        setComponents(deduplicatedComponents);
        // Cache by category key
        try { cacheRef.current[activeCategory] = deduplicatedComponents; } catch {}
        // Filter components based on compatibility
        const filtered = filterCompatibleComponents(deduplicatedComponents, selectedComponents, activeCategory);
        setFilteredComponents(filtered);
        firstLoadRef.current = false;
      } else {
        setError(data.error || 'Failed to fetch components');
        try { console.error('[ECS] API error:', data); } catch {}
        // Attempt one-shot fallback if API router path fails but global list works
        await tryFallbackFetch(activeCategory, dbCategory, controller.signal);
      }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        // Distinguish between timeout vs. rapid re-render
        if (timedOutRef.current) {
          setError('Request timed out. Please check your server (Apache/MySQL) and try again.');
          try { console.error('[ECS] Fetch aborted due to timeout'); } catch {}
          // Fallback on timeout as well
          const dbCategory = categoryMapping[activeCategory];
          await tryFallbackFetch(activeCategory, dbCategory);
        } else {
          try { console.warn('[ECS] Fetch aborted due to new request (category changed)'); } catch {}
          // If we have cached data for this category, use it to avoid spinner
          if (cacheRef.current[activeCategory]) {
            setComponents(cacheRef.current[activeCategory]);
            const filtered = filterCompatibleComponents(cacheRef.current[activeCategory], selectedComponents, activeCategory);
            setFilteredComponents(filtered);
          }
        }
        return;
      }
      if (!mountedRef.current) return;
      setError(`Failed to connect to server${err?.message ? `: ${err.message}` : ''}`);
      try { console.error('[ECS] Fetch exception:', err); } catch {}
    } finally {
      if (!mountedRef.current) return;
      // Ensure any timeout for this request is cleared
      if (timeoutRef.current) { try { clearTimeout(timeoutRef.current); } catch {} }
      setLoading(false);
      setRefreshing(false);
      inflightCategoryRef.current = null;
    }
  }, [activeCategory, branch]);

  // Fallback fetch: fetch all components then filter by category on the client
  const tryFallbackFetch = useCallback(async (categoryKey, dbCategory, signal) => {
    if (fallbackTriedRef.current) return; // only once per mount to avoid loops
    fallbackTriedRef.current = true;
    try {
      const res = await fetch(`${API_BASE}/get_all_components.php`, { signal });
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data)) {
        const list = json.data.filter(item => {
          const cat = (item.category || item.Category || '').toString().toLowerCase();
          return cat === dbCategory.toString().toLowerCase();
        });
        if (list.length > 0) {
          // Deduplicate components by id, then by name+brand combination
          const deduplicatedComponents = [];
          const seenIds = new Set();
          const seenNames = new Set();
          
          list.forEach(component => {
            const id = component.id;
            const nameKey = `${(component.name || '').toLowerCase().trim()}-${(component.brand || '').toLowerCase().trim()}`;
            
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              deduplicatedComponents.push(component);
            } else if (!id && !seenNames.has(nameKey)) {
              seenNames.add(nameKey);
              deduplicatedComponents.push(component);
            }
          });
          
          cacheRef.current[categoryKey] = deduplicatedComponents;
          setComponents(deduplicatedComponents);
          const filtered = filterCompatibleComponents(deduplicatedComponents, selectedComponents, categoryKey);
          setFilteredComponents(filtered);
          setError(null);
          try { console.warn('[ECS] Fallback list used for', dbCategory, 'count=', deduplicatedComponents.length); } catch {}
        }
      }
    } catch (e) {
      // Silent; keep existing UI state
      try { console.error('[ECS] Fallback fetch failed:', e); } catch {}
    }
  }, [selectedComponents]);

  // Debounce fetches to avoid rapid abort/restart loops during quick re-renders
  useEffect(() => {
    try { if (debounceRef.current) clearTimeout(debounceRef.current); } catch {}
    debounceRef.current = setTimeout(() => {
      fetchComponents();
    }, 150);
    return () => { try { if (debounceRef.current) clearTimeout(debounceRef.current); } catch {} };
  }, [fetchComponents]);

  // Re-filter components when selectedComponents change
  useEffect(() => {
    if (components.length > 0) {
      const filtered = filterCompatibleComponents(components, selectedComponents, activeCategory);
      setFilteredComponents(filtered);
    }
  }, [selectedComponents, activeCategory, components]);

  // Track whether we already have data loaded for any category
  useEffect(() => {
    hasDataRef.current = components && components.length > 0;
  }, [components]);

  // Sort components
  const sortComponents = (componentsToSort) => {
    return [...componentsToSort].sort((a, b) => {
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

  // Filter components by search term
  const filterBySearch = (componentsToFilter) => {
    if (!searchTerm) return componentsToFilter;
    
    return componentsToFilter.filter(component => 
      component.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      component.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      component.model?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Get current category info
  const currentCategory = categories.find(cat => cat.id === activeCategory);

  // Smart suggestions for compatibility issues
  const getSmartSuggestions = () => {
    if (currentCategory?.id === 'motherboard' && selectedComponents.cpu) {
      const cpuName = selectedComponents.cpu.name?.toLowerCase() || '';
      const suggestions = [];
      
      if (cpuName.includes('i7-11700')) {
        suggestions.push({
          type: 'socket',
          message: 'Your Intel i7-11700 uses LGA1200 socket',
          recommendation: 'Look for motherboards with LGA1200 socket support'
        });
      } else if (cpuName.includes('ryzen')) {
        suggestions.push({
          type: 'socket',
          message: 'Your AMD Ryzen CPU uses AM4 socket',
          recommendation: 'Look for motherboards with AM4 socket support'
        });
      }
      
      return suggestions;
    }
    return [];
  };

  // Smart compatibility preview - shows what will be available next
  const getCompatibilityPreview = () => {
    if (!selectedComponents.cpu) return null;
    
    const preview = {
      motherboard: { compatible: 0, total: 0, rate: 0, issues: [], recommendations: [] },
      ram: { compatible: 0, total: 0, rate: 0, issues: [], recommendations: [] },
      gpu: { compatible: 0, total: 0, rate: 0, issues: [], recommendations: [] },
      storage: { compatible: 0, total: 0, rate: 0, issues: [], recommendations: [] },
      psu: { compatible: 0, total: 0, rate: 0, issues: [], recommendations: [] },
      case: { compatible: 0, total: 0, rate: 0, issues: [], recommendations: [] },
      cooler: { compatible: 0, total: 0, rate: 0, issues: [], recommendations: [] }
    };

    // Get real predictions for each category
    Object.keys(preview).forEach(category => {
      if (category !== activeCategory) {
        const prediction = predictCompatibilityForCategory(selectedComponents, category);
        const mockComponents = 15; // Assume 15 components per category
        
        preview[category] = {
          compatible: Math.round(mockComponents * prediction.compatibilityRate),
          total: mockComponents,
          rate: prediction.compatibilityRate,
          issues: prediction.potentialIssues,
          recommendations: prediction.recommendations
        };
      }
    });

    return preview;
  };

  // Get alternative recommendations
  const getAlternativeRecommendations = () => {
    return getSmartRecommendations(selectedComponents, activeCategory);
  };

  const smartSuggestions = getSmartSuggestions();
  const compatibilityPreview = getCompatibilityPreview();
  const alternativeRecommendations = getAlternativeRecommendations();
     const ramGuidance = activeCategory === 'ram' ? getRAMCompatibilityGuidance(selectedComponents) : null;
   const caseGuidance = activeCategory === 'case' ? getCaseCompatibilityGuidance(selectedComponents) : null;
   
   // Special cooling guidance since it's optional
   const getCoolingGuidance = () => {
     if (activeCategory !== 'cooler') return null;
     
     return {
       message: "CPU cooling is completely optional for your build!",
       recommendations: [
         "Most CPUs come with stock coolers that work fine for basic use",
         "Stock coolers are included in the CPU box at no extra cost",
         "You only need aftermarket cooling for gaming, overclocking, or better performance",
         "Air coolers are simpler and more reliable than liquid cooling"
       ],
       troubleshooting: [
         "If no coolers are found, you can safely skip this step",
         "Stock coolers handle most gaming and productivity tasks",
         "Aftermarket cooling is a luxury, not a requirement"
       ],
       fallbackOptions: [
         "Use the included stock cooler (free and functional)",
         "Skip cooling selection and proceed with build",
         "Add cooling later if you need better performance"
       ]
     };
   };
   
   const coolingGuidance = getCoolingGuidance();
  
     // State for collapsible sections
   const [showCompatibilityPreview, setShowCompatibilityPreview] = useState(true);
   const [showSmartRecommendations, setShowSmartRecommendations] = useState(true);
   const [showCaseGuidance, setShowCaseGuidance] = useState(true);
   const [showRAMGuidance, setShowRAMGuidance] = useState(true);
   const [showCoolingGuidance, setShowCoolingGuidance] = useState(true);

  // Get compatibility icon and color
  const getCompatibilityIcon = (component) => {
    if (!component.compatibility) return null;
    
    if (component.compatibility.compatible) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  // Get compatibility badge
  const getCompatibilityBadge = (component) => {
    if (!component.compatibility) return null;
    
    if (component.compatibility.compatible) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Compatible
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Incompatible
        </span>
      );
    }
  };

  // Render component card
  const renderComponentCard = (component, isCompatible = true) => {
    const isSelected = selectedComponents[activeCategory]?.id === component.id;
    const compatibilityIcon = getCompatibilityIcon(component);
    const compatibilityBadge = getCompatibilityBadge(component);

    return (
      <div 
        key={component.id}
        className={`relative bg-white rounded-lg border-2 p-4 transition-all duration-200 hover:shadow-lg ${
          isSelected 
            ? 'border-green-500 bg-green-50' 
            : isCompatible 
              ? 'border-gray-200 hover:border-green-300' 
              : 'border-red-200 bg-red-50 opacity-75'
        } ${!isCompatible && !showIncompatible ? 'hidden' : ''}`}
      >
        {/* Compatibility Badge */}
        {compatibilityBadge && (
          <div className="absolute top-2 right-2">
            {compatibilityBadge}
          </div>
        )}

        {/* Component Image */}
        <div className="flex justify-center mb-4">
          <img
            src={getComponentImage(component, activeCategory)}
            alt={component.name}
            className="w-24 h-24 object-contain"
            onError={(e) => {
              // Use a local placeholder inside the built dist folder
              e.currentTarget.onerror = null;
              e.currentTarget.src = `${baseNoSlash}/images/placeholder-component.svg`;
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

        {/* Compatibility Summary (always visible, helpful bullets) */}
        {component.compatibility && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              {compatibilityIcon}
              <span className="text-xs font-medium text-gray-700">Compatibility</span>
            </div>
            {component.compatibility.reason && (
              <p className="text-xs text-gray-600">{component.compatibility.reason}</p>
            )}
            {component.compatibility.issues && component.compatibility.issues.length > 0 && (
              <ul className="mt-2 text-xs text-red-600 space-y-1 list-disc pl-4">
                {component.compatibility.issues.slice(0,3).map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {isSelected ? (
            <button
              onClick={() => onComponentRemove(activeCategory)}
              className="flex-1 bg-red-500 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Remove
            </button>
          ) : (
            <button
              onClick={() => onComponentSelect(activeCategory, component)}
              disabled={!isCompatible}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center ${
                isCompatible
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4 mr-1" />
              {isCompatible ? 'Select' : 'Incompatible'}
            </button>
          )}
          
          {/* Info toggle removed; summary shown above */}
        </div>
      </div>
    );
  };

  if (loading && components.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading components...</p>
        </div>
      </div>
    );
  }

  if (!loading && components.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-600">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <p className="text-lg font-medium mb-1">No components found for this category</p>
          <p className="text-sm mb-3">Try again or pick a different category.</p>
          <button
            onClick={fetchComponents}
            className="mt-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Error Loading Components</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchComponents}
            className="mt-4 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const sortedCompatible = sortComponents(filterBySearch(filteredComponents.compatible));
  const sortedIncompatible = sortComponents(filterBySearch(filteredComponents.incompatible));

  return (
    <div className="space-y-6">
             {/* Header */}
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div className="flex items-center gap-3">
           {currentCategory && (
             <>
               <currentCategory.icon className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
               <div>
                 <h2 className="text-lg sm:text-xl font-bold text-gray-900">{currentCategory.name}</h2>
                 <p className="text-xs sm:text-sm text-gray-600">{currentCategory.description}</p>
                 {/* Special message for cooling */}
                 {activeCategory === 'cooler' && (
                   <div className="mt-1">
                     <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 border border-cyan-200">
                       <Thermometer className="w-3 h-3 mr-1" />
                       Optional Component
                     </span>
                   </div>
                 )}
               </div>
             </>
           )}
         </div>
        
        {/* Compatibility Toggle */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowIncompatible(!showIncompatible)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              showIncompatible 
                ? 'bg-red-100 text-red-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {showIncompatible ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            <span className="hidden sm:inline">{showIncompatible ? 'Hide' : 'Show'} Incompatible</span>
            <span className="sm:hidden">{showIncompatible ? 'Hide' : 'Show'}</span>
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${currentCategory?.name || 'components'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="name">Sort by Name</option>
          <option value="price">Sort by Price</option>
          <option value="brand">Sort by Brand</option>
        </select>
      </div>

             {/* Compatibility Summary */}
       <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-900">Compatibility View</span>
          </div>
          <span className="text-sm text-blue-700">
            {filteredComponents.compatible.length} compatible • {filteredComponents.incompatible.length} incompatible
          </span>
        </div>
        <p className="text-sm text-blue-700 mt-1">
          Showing all components by default. Use the toggle to hide incompatible items if you want a narrower list.
        </p>
      </div>

               {/* Smart Compatibility Preview */}
        {compatibilityPreview && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-900">Compatibility Preview</span>
              </div>
                             <button
                 onClick={() => setShowCompatibilityPreview(!showCompatibilityPreview)}
                 className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-50 text-green-700 rounded-full border border-green-200 hover:bg-green-100 hover:border-green-300 transition-all duration-200 shadow-sm"
               >
                 <Lightbulb className="w-4 h-4" />
                 {showCompatibilityPreview ? 'Hide Tips' : 'Show Tips'}
               </button>
            </div>
            
            {showCompatibilityPreview && (
              <>
                <p className="text-sm text-green-700 mb-3">
                  Based on your current selections, here's what you can expect in upcoming categories:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(compatibilityPreview).map(([category, stats]) => (
                    <div key={category} className="text-center p-2 bg-white rounded border">
                      <div className="text-xs font-medium text-gray-600 capitalize mb-1">
                        {category}
                      </div>
                      <div className="text-sm font-bold text-green-600">
                        {stats.compatible}/{stats.total}
                      </div>
                      <div className="text-xs text-gray-500">
                        compatible
                      </div>
                      <div className="text-xs text-blue-600 font-medium mt-1">
                        {Math.round(stats.rate * 100)}% rate
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Detailed Recommendations */}
                <div className="mt-4 p-3 bg-white rounded border">
                  <div className="text-sm font-medium text-gray-900 mb-2">Key Recommendations:</div>
                  <div className="space-y-1">
                    {Object.entries(compatibilityPreview).map(([category, stats]) => 
                      stats.recommendations.map((rec, index) => (
                        <div key={`${category}-${index}`} className="text-xs text-gray-700 flex items-start gap-2">
                          <span className="text-blue-600 font-medium capitalize">{category}:</span>
                          <span>{rec}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

                               {/* Alternative Recommendations */}
         {alternativeRecommendations.length > 0 && (
           <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
             <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-2">
                 <Lightbulb className="w-5 h-5 text-purple-600" />
                 <span className="font-medium text-purple-900">Smart Recommendations</span>
               </div>
                               <button
                  onClick={() => setShowSmartRecommendations(!showSmartRecommendations)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-50 text-purple-700 rounded-full border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 shadow-sm"
                >
                  <Lightbulb className="w-4 h-4" />
                  {showSmartRecommendations ? 'Hide Tips' : 'Show Tips'}
                </button>
             </div>
             
             {showSmartRecommendations && (
               <>
                 <p className="text-sm text-purple-700 mb-3">
                   Consider these alternatives for better compatibility in future steps:
                 </p>
                 <div className="space-y-2">
                   {alternativeRecommendations.map((rec, index) => (
                     <div key={index} className="flex items-center justify-between p-3 bg-white rounded border">
                       <div>
                         <div className="font-medium text-gray-900">{rec.name}</div>
                         <div className="text-sm text-gray-600">{rec.reason}</div>
                       </div>
                       <div className="text-right">
                         <div className="font-bold text-green-600">{rec.price}</div>
                         <div className="text-xs text-purple-600 font-medium">{rec.compatibility} compatibility</div>
                       </div>
                     </div>
                   ))}
                 </div>
               </>
             )}
           </div>
         )}

                 {/* RAM Compatibility Guidance */}
         {ramGuidance && (
           <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
             <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-2">
                 <MemoryStick className="w-5 h-5 text-blue-600" />
                 <span className="font-medium text-blue-900">RAM Compatibility Guide</span>
               </div>
                               <button
                  onClick={() => setShowRAMGuidance(!showRAMGuidance)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 shadow-sm"
                >
                  <Lightbulb className="w-4 h-4" />
                  {showRAMGuidance ? 'Hide Tips' : 'Show Tips'}
                </button>
             </div>
             
             {showRAMGuidance && (
               <>
                 {/* Recommendations */}
                 {ramGuidance.recommendations.length > 0 && (
                   <div className="mb-4">
                     <h4 className="text-sm font-medium text-blue-900 mb-2">Recommendations:</h4>
                     <ul className="space-y-1">
                       {ramGuidance.recommendations.map((rec, index) => (
                         <li key={index} className="text-sm text-blue-700 flex items-start gap-2">
                           <span className="text-blue-500 mt-1">•</span>
                           <span>{rec}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                 )}

                 {/* Troubleshooting */}
                 {ramGuidance.troubleshooting.length > 0 && (
                   <div className="mb-4">
                     <h4 className="text-sm font-medium text-blue-900 mb-2">Troubleshooting:</h4>
                     <ul className="space-y-1">
                       {ramGuidance.troubleshooting.map((tip, index) => (
                         <li key={index} className="text-sm text-blue-700 flex items-start gap-2">
                           <span className="text-blue-500 mt-1">•</span>
                           <span>{tip}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                 )}

                 {/* Fallback Options */}
                 {ramGuidance.fallbackOptions.length > 0 && (
                   <div>
                     <h4 className="text-sm font-medium text-blue-900 mb-2">Safe Fallback Options:</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                       {ramGuidance.fallbackOptions.map((option, index) => (
                         <div key={index} className="text-sm text-blue-700 bg-white p-2 rounded border">
                           {option}
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
               </>
             )}
           </div>
         )}

                 {/* Case Compatibility Guidance */}
         {caseGuidance && (
           <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
             <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-2">
                 <Package className="w-5 h-5 text-indigo-600" />
                 <span className="font-medium text-indigo-900">Case Compatibility Guide</span>
               </div>
                               <button
                  onClick={() => setShowCaseGuidance(!showCaseGuidance)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-all duration-200 shadow-sm"
                >
                  <Lightbulb className="w-4 h-4" />
                  {showCaseGuidance ? 'Hide Tips' : 'Show Tips'}
                </button>
             </div>
             
             {showCaseGuidance && (
               <>
                 {/* Recommendations */}
                 {caseGuidance.recommendations.length > 0 && (
                   <div className="mb-4">
                     <h4 className="text-sm font-medium text-indigo-900 mb-2">Recommendations:</h4>
                     <ul className="space-y-1">
                       {caseGuidance.recommendations.map((rec, index) => (
                         <li key={index} className="text-sm text-indigo-700 flex items-start gap-2">
                           <span className="text-indigo-500 mt-1">•</span>
                           <span>{rec}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                 )}

                 {/* Troubleshooting */}
                 {caseGuidance.troubleshooting.length > 0 && (
                   <div className="mb-4">
                     <h4 className="text-sm font-medium text-indigo-900 mb-2">Troubleshooting:</h4>
                     <ul className="space-y-1">
                       {caseGuidance.troubleshooting.map((tip, index) => (
                         <li key={index} className="text-sm text-indigo-700 flex items-start gap-2">
                           <span className="text-indigo-500 mt-1">•</span>
                           <span>{tip}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                 )}

                 {/* Fallback Options */}
                 {caseGuidance.fallbackOptions.length > 0 && (
                   <div>
                     <h4 className="text-sm font-medium text-indigo-900 mb-2">Safe Fallback Options:</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                       {caseGuidance.fallbackOptions.map((option, index) => (
                         <div key={index} className="text-sm text-indigo-700 bg-white p-2 rounded border">
                           {option}
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
               </>
             )}
                      </div>
                  )}

         {/* Cooling Compatibility Guidance - Show at top when no components */}
         {coolingGuidance && activeCategory === 'cooler' && (
           <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
             <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-2">
                 <Thermometer className="w-5 h-5 text-cyan-600" />
                 <span className="font-medium text-cyan-900">Cooling Compatibility Guide</span>
               </div>
               <button
                 onClick={() => setShowCoolingGuidance(!showCoolingGuidance)}
                 className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-cyan-50 text-cyan-700 rounded-full border border-cyan-200 hover:bg-cyan-100 hover:border-cyan-300 transition-all duration-200 shadow-sm"
               >
                 <Lightbulb className="w-4 h-4" />
                 {showCoolingGuidance ? 'Hide Tips' : 'Show Tips'}
               </button>
             </div>
             
             {showCoolingGuidance && (
               <>
                 {/* Message */}
                 <div className="mb-4 p-3 bg-white rounded border">
                   <p className="text-sm text-cyan-700 font-medium">
                     {coolingGuidance.message}
                   </p>
                 </div>
                 
                 {/* Recommendations */}
                 {coolingGuidance.recommendations.length > 0 && (
                   <div className="mb-4">
                     <h4 className="text-sm font-medium text-cyan-900 mb-2">Recommendations:</h4>
                     <ul className="space-y-1">
                       {coolingGuidance.recommendations.map((rec, index) => (
                         <li key={index} className="text-sm text-cyan-700 flex items-start gap-2">
                           <span className="text-cyan-500 mt-1">•</span>
                           <span>{rec}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                 )}

                 {/* Troubleshooting */}
                 {coolingGuidance.troubleshooting.length > 0 && (
                   <div className="mb-4">
                     <h4 className="text-sm font-medium text-cyan-900 mb-2">Troubleshooting:</h4>
                     <ul className="space-y-1">
                       {coolingGuidance.troubleshooting.map((tip, index) => (
                         <li key={index} className="text-sm text-cyan-700 flex items-start gap-2">
                           <span className="text-cyan-500 mt-1">•</span>
                           <span>{tip}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                 )}

                 {/* Fallback Options */}
                 {coolingGuidance.fallbackOptions.length > 0 && (
                   <div>
                     <h4 className="text-sm font-medium text-cyan-900 mb-2">Safe Fallback Options:</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                       {coolingGuidance.fallbackOptions.map((option, index) => (
                         <div key={index} className="text-sm text-cyan-700 bg-white p-2 rounded border">
                           {option}
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
               </>
             )}
           </div>
         )}

         {/* Components Grid */}
        <div className="space-y-6">
        {/* Compatible Components */}
        {sortedCompatible.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Compatible Components ({sortedCompatible.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {sortedCompatible.map(component => renderComponentCard(component, true))}
            </div>
          </div>
        )}

        {/* Incompatible Components */}
        {showIncompatible && sortedIncompatible.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Incompatible Components ({sortedIncompatible.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {sortedIncompatible.map(component => renderComponentCard(component, false))}
            </div>
          </div>
        )}

                 {/* No Components */}
         {sortedCompatible.length === 0 && (!showIncompatible || sortedIncompatible.length === 0) && (
           <div className="text-center py-12">
             <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
             <h3 className="text-lg font-medium text-gray-900 mb-2">
               {activeCategory === 'cooler' ? 'No Cooling Components Found' : 'No Components Found'}
             </h3>
             
             {/* Enhanced No Components Message */}
            {!searchTerm && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium text-yellow-800">Compatibility Issue</span>
                </div>
                                 <p className="text-sm text-yellow-700 mb-3">
                   {activeCategory === 'cooler' ? 
                     'No cooling components found, but this is completely optional!' : 
                     'No compatible components found for your current selections. This might be due to:'}
                 </p>
                                 <ul className="text-sm text-yellow-700 space-y-1 mb-4">
                   {activeCategory === 'cooler' ? (
                     <>
                       <li>• Cooling is completely optional for your build</li>
                       <li>• Most CPUs come with stock coolers included</li>
                       <li>• You can proceed without selecting a cooler</li>
                     </>
                   ) : (
                     <>
                       <li>• Socket compatibility issues</li>
                       <li>• Missing component specifications</li>
                       <li>• Limited component database</li>
                     </>
                   )}
                 </ul>
                
                                 {/* Smart Suggestions */}
                 {smartSuggestions.length > 0 && (
                   <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                     <div className="flex items-center gap-2 mb-2">
                       <Lightbulb className="w-4 h-4 text-blue-600" />
                       <span className="font-medium text-blue-800 text-sm">Smart Suggestions</span>
                     </div>
                     {smartSuggestions.map((suggestion, index) => (
                       <div key={index} className="text-sm text-blue-700">
                         <p className="font-medium">{suggestion.message}</p>
                         <p className="text-blue-600">{suggestion.recommendation}</p>
                       </div>
                     ))}
                   </div>
                 )}

                                   {/* RAM-Specific Help */}
                  {activeCategory === 'ram' && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <MemoryStick className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-800 text-sm">RAM Compatibility Help</span>
                      </div>
                      <div className="text-sm text-green-700 space-y-2">
                        <p><strong>Good news:</strong> Most DDR4 RAM modules are compatible with modern motherboards!</p>
                        <p><strong>Try this:</strong> Click "Show All Components" to see all available RAM options.</p>
                        <p><strong>Safe choices:</strong> Kingston, Corsair, G.Skill DDR4 3200MHz RAM usually works with most systems.</p>
                        <p><strong>If still stuck:</strong> Check your motherboard manual for specific RAM requirements.</p>
                      </div>
                    </div>
                  )}

                                     {/* Case-Specific Help */}
                   {activeCategory === 'case' && (
                     <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                       <div className="flex items-center gap-2 mb-2">
                         <Package className="w-4 h-4 text-indigo-600" />
                         <span className="font-medium text-indigo-800 text-sm">Case Compatibility Help</span>
                       </div>
                       <div className="text-sm text-indigo-700 space-y-2">
                         <p><strong>Good news:</strong> Most cases are compatible with most motherboards!</p>
                         <p><strong>Try this:</strong> Click "Show All Components" to see all available case options.</p>
                         <p><strong>Safe choices:</strong> ATX cases offer the best compatibility and airflow.</p>
                         <p><strong>If still stuck:</strong> Most ATX, Micro-ATX, and Mini-ITX cases work together.</p>
                       </div>
                     </div>
                   )}

                   {/* Enhanced Cooling Options */}
                   {activeCategory === 'cooler' && (
                     <div className="mb-4 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg">
                       <div className="flex items-center gap-3 mb-4">
                         <div className="bg-cyan-100 p-2 rounded-full">
                           <Thermometer className="w-5 h-5 text-cyan-600" />
                         </div>
                         <div>
                           <h4 className="font-semibold text-cyan-800">Cooling Options</h4>
                           <p className="text-sm text-cyan-700">Choose your preferred cooling solution</p>
                         </div>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                         {/* Stock Cooler Option */}
                         <div className="bg-white p-4 rounded-lg border border-green-100">
                           <h5 className="font-medium text-gray-900 mb-2">Stock Cooler</h5>
                           <p className="text-xs text-gray-600 mb-3">Included with your CPU</p>
                           <ul className="text-xs text-gray-600 space-y-1.5 mb-4">
                             <li className="flex items-center gap-1.5">
                               <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                               <span>Great for everyday use</span>
                             </li>
                             <li className="flex items-center gap-1.5">
                               <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                               <span>Quiet operation</span>
                             </li>
                           </ul>
                           <button
                             onClick={() => onComponentSelect('cooler', { id: 'stock-cooler', name: 'Stock CPU Cooler', price: 0 })}
                             className="w-full px-3 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-md"
                           >
                             Use Stock Cooler
                           </button>
                         </div>
                         
                         {/* Aftermarket Cooler Option */}
                         <div className="bg-white p-4 rounded-lg border border-blue-100">
                           <h5 className="font-medium text-gray-900 mb-2">Aftermarket Cooler</h5>
                           <p className="text-xs text-gray-600 mb-3">Better performance & cooling</p>
                           <ul className="text-xs text-gray-600 space-y-1.5 mb-4">
                             <li className="flex items-center gap-1.5">
                               <Zap className="w-3.5 h-3.5 text-blue-500" />
                               <span>Ideal for gaming/overclocking</span>
                             </li>
                             <li className="flex items-center gap-1.5">
                               <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                               <span>Browse options below</span>
                             </li>
                           </ul>
                           <button
                             onClick={() => setShowIncompatible(true)}
                             className="w-full px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md"
                           >
                             View All Coolers
                           </button>
                         </div>
                       </div>
                       
                       <p className="text-xs text-cyan-700 text-center">
                         Not sure? The stock cooler is a great choice for most users!
                       </p>
                     </div>
                   )}
                
                                 <div className="flex flex-col gap-2">

                   
                   <button
                     onClick={() => setShowIncompatible(true)}
                     className="w-full px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm font-medium"
                   >
                     Show All Components (Including Incompatible)
                   </button>
                   <button
                     onClick={() => window.location.reload()}
                     className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
                   >
                     Start Over
                   </button>
                 </div>
              </div>
            )}
          </div>
        )}

         {/* No Components - Only show if no compatible components and not showing incompatible ones */}
         {sortedCompatible.length === 0 && (!showIncompatible || sortedIncompatible.length === 0) && (
           <div className="text-center py-12">
             <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
             <h3 className="text-lg font-medium text-gray-900 mb-2">
               {activeCategory === 'cooler' ? 'No Cooling Components Found' : 'No Components Found'}
             </h3>
             
             {/* Enhanced No Components Message */}
             {!searchTerm && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium text-yellow-800">Compatibility Issue</span>
                </div>
                                 <p className="text-sm text-yellow-700 mb-3">
                   {activeCategory === 'cooler' ? 
                     'No cooling components found, but this is completely optional!' : 
                     'No compatible components found for your current selections. This might be due to:'}
                 </p>
                                 <ul className="text-sm text-yellow-700 space-y-1 mb-4">
                   {activeCategory === 'cooler' ? (
                     <>
                       <li>• Cooling is completely optional for your build</li>
                       <li>• Most CPUs come with stock coolers included</li>
                       <li>• You can proceed without selecting a cooler</li>
                     </>
                   ) : (
                     <>
                       <li>• Socket compatibility issues</li>
                       <li>• Missing component specifications</li>
                       <li>• Limited component database</li>
                     </>
                   )}
                 </ul>
                
                                 {/* Smart Suggestions */}
                 {smartSuggestions.length > 0 && (
                   <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                     <div className="flex items-center gap-2 mb-2">
                       <Lightbulb className="w-4 h-4 text-blue-600" />
                       <span className="font-medium text-blue-800 text-sm">Smart Suggestions</span>
                     </div>
                     {smartSuggestions.map((suggestion, index) => (
                       <div key={index} className="text-sm text-blue-700">
                         <p className="font-medium">{suggestion.message}</p>
                         <p className="text-blue-600">{suggestion.recommendation}</p>
                       </div>
                     ))}
                   </div>
                 )}

                                   {/* RAM-Specific Help */}
                  {activeCategory === 'ram' && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <MemoryStick className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-800 text-sm">RAM Compatibility Help</span>
                      </div>
                      <div className="text-sm text-green-700 space-y-2">
                        <p><strong>Good news:</strong> Most DDR4 RAM modules are compatible with modern motherboards!</p>
                        <p><strong>Try this:</strong> Click "Show All Components" to see all available RAM options.</p>
                        <p><strong>Safe choices:</strong> Kingston, Corsair, G.Skill DDR4 3200MHz RAM usually works with most systems.</p>
                        <p><strong>If still stuck:</strong> Check your motherboard manual for specific RAM requirements.</p>
                      </div>
                    </div>
                  )}

                                     {/* Case-Specific Help */}
                   {activeCategory === 'case' && (
                     <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                       <div className="flex items-center gap-2 mb-2">
                         <Package className="w-4 h-4 text-indigo-600" />
                         <span className="font-medium text-indigo-800 text-sm">Case Compatibility Help</span>
                       </div>
                       <div className="text-sm text-indigo-700 space-y-2">
                         <p><strong>Good news:</strong> Most cases are compatible with most motherboards!</p>
                         <p><strong>Try this:</strong> Click "Show All Components" to see all available case options.</p>
                         <p><strong>Safe choices:</strong> ATX cases offer the best compatibility and airflow.</p>
                         <p><strong>If still stuck:</strong> Most ATX, Micro-ATX, and Mini-ITX cases work together.</p>
                       </div>
                     </div>
                   )}

                   {/* Enhanced Cooling Options */}
                   {activeCategory === 'cooler' && (
                     <div className="mb-4 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg">
                       <div className="flex items-center gap-3 mb-4">
                         <div className="bg-cyan-100 p-2 rounded-full">
                           <Thermometer className="w-5 h-5 text-cyan-600" />
                         </div>
                         <div>
                           <h4 className="font-semibold text-cyan-800">Cooling Options</h4>
                           <p className="text-sm text-cyan-700">Choose your preferred cooling solution</p>
                         </div>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                         {/* Stock Cooler Option */}
                         <div className="bg-white p-4 rounded-lg border border-green-100">
                           <h5 className="font-medium text-gray-900 mb-2">Stock Cooler</h5>
                           <p className="text-xs text-gray-600 mb-3">Included with your CPU</p>
                           <ul className="text-xs text-gray-600 space-y-1.5 mb-4">
                             <li className="flex items-center gap-1.5">
                               <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                               <span>Great for everyday use</span>
                             </li>
                             <li className="flex items-center gap-1.5">
                               <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                               <span>Quiet operation</span>
                             </li>
                           </ul>
                           <button
                             onClick={() => onComponentSelect('cooler', { id: 'stock-cooler', name: 'Stock CPU Cooler', price: 0 })}
                             className="w-full px-3 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-md"
                           >
                             Use Stock Cooler
                           </button>
                         </div>
                         
                         {/* Aftermarket Cooler Option */}
                         <div className="bg-white p-4 rounded-lg border border-blue-100">
                           <h5 className="font-medium text-gray-900 mb-2">Aftermarket Cooler</h5>
                           <p className="text-xs text-gray-600 mb-3">Better performance & cooling</p>
                           <ul className="text-xs text-gray-600 space-y-1.5 mb-4">
                             <li className="flex items-center gap-1.5">
                               <Zap className="w-3.5 h-3.5 text-blue-500" />
                               <span>Ideal for gaming/overclocking</span>
                             </li>
                             <li className="flex items-center gap-1.5">
                               <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                               <span>Browse options below</span>
                             </li>
                           </ul>
                           <button
                             onClick={() => setShowIncompatible(true)}
                             className="w-full px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md"
                           >
                             View All Coolers
                           </button>
                         </div>
                       </div>
                       
                       <p className="text-xs text-cyan-700 text-center">
                         Not sure? The stock cooler is a great choice for most users!
                       </p>
                     </div>
                   )}
                
                                 <div className="flex flex-col gap-2">

                   
                   <button
                     onClick={() => setShowIncompatible(true)}
                     className="w-full px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm font-medium"
                   >
                     Show All Components (Including Incompatible)
                   </button>
                   <button
                     onClick={() => window.location.reload()}
                     className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
                   >
                     Start Over
                   </button>
                 </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedComponentSelector;
