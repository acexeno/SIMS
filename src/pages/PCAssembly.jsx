/**
 * PCAssembly: guided build flow with compatibility, recommendations, and ordering.
 * Maintains internal state when prebuilt not provided; persists selection for UX.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Eye, 
  Plus, 
  Trash2, 
  ShoppingCart, 
  Package, 
  Save, 
  X,
  Cpu,
  HardDrive,
  Monitor,
  Zap,
  Thermometer,
  MemoryStick,
  Server,
  Settings,
  ArrowRight,
  Star,
  TrendingUp,
  Shield,
  Clock,
  Target,
  Lightbulb,
  Edit,
  LogIn,
  User,
  Share2,
  Users,
  CheckSquare,
  Filter,
  BarChart3
} from 'lucide-react'
import EnhancedComponentSelector from '../components/EnhancedComponentSelector'
import CompatibilityChecker from '../components/CompatibilityChecker'
import CompatibilityComparisonModal from '../components/CompatibilityComparisonModal'
import { getCompatibilityScore, filterCompatibleComponents } from '../utils/compatibilityService'
import axios from 'axios'
import { API_BASE, getApiEndpoint } from '../utils/apiBase'
import { formatCurrencyPHP } from '../utils/currency'
import { getComponentImage } from '../utils/componentImages'

const PCAssembly = ({ setCurrentPage, selectedComponents: prebuiltComponents, setSelectedComponents: setSelectedComponentsProp, onLoaded, user, onShowAuth, setUser, saveToPrebuilts = false, hideCompleteButton = false }) => {
  // State management
  const [internalSelectedComponents, setInternalSelectedComponents] = useState({
    cpu: null,
    motherboard: null,
    gpu: null,
    ram: null,
    storage: null,
    psu: null,
    case: null,
    cooler: null
  });
  
  // Memoize selectedComponents to prevent infinite re-renders
  const selectedComponents = useMemo(() => {
    return prebuiltComponents || internalSelectedComponents;
  }, [prebuiltComponents, internalSelectedComponents]);
  
  const setSelectedComponents = setSelectedComponentsProp || setInternalSelectedComponents;

  // UI State
  const [componentsLoaded, setComponentsLoaded] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [showTips, setShowTips] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showRestoreNotification, setShowRestoreNotification] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  // Force remount for child components after a full clear
  const [resetNonce, setResetNonce] = useState(0);
  
  // Order State
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderConfirmation, setOrderConfirmation] = useState(null); // { order_id, total }
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false); // Show review modal before purchase
  
  // Build State
  const [buildName, setBuildName] = useState('');
  const [buildDescription, setBuildDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [savingBuild, setSavingBuild] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingBuildId, setEditingBuildId] = useState(null);
  
  // Community submission is now mandatory
  const [submittingToCommunity, setSubmittingToCommunity] = useState(false);
  
  // Compatibility State
  const [compatibilityStatus, setCompatibilityStatus] = useState({});
  const [compatibilityDetails, setCompatibilityDetails] = useState({});
  
  // Enhanced Compatibility State
  const [showCompatibilityModal, setShowCompatibilityModal] = useState(false);
  const [allComponents, setAllComponents] = useState([]);
  const [compatibilityScore, setCompatibilityScore] = useState(100);
  
  // Recommendations State
  const [recommendations, setRecommendations] = useState({});
  const [loadingRecommendations, setLoadingRecommendations] = useState({});

  // Branch filter for assembly: null = All (global), or 'BULACAN' / 'MARIKINA'
  const [branch, setBranch] = useState(null);

  // Ref to track previous components for localStorage
  const prevComponentsRef = useRef(null);
  
  // Ref to track if initialization has been done
  const initializedRef = useRef(false);

  // Component categories
  const componentCategories = useMemo(() => [
    { key: 'cpu', name: 'Processor', icon: Cpu, description: 'Brain of your PC', priority: 1 },
    { key: 'motherboard', name: 'Motherboard', icon: Server, description: 'Connects everything', priority: 2 },
    { key: 'gpu', name: 'Graphics Card', icon: Monitor, description: 'Handles graphics', priority: 3 },
    { key: 'ram', name: 'Memory', icon: MemoryStick, description: 'System memory', priority: 4 },
    { key: 'storage', name: 'Storage', icon: HardDrive, description: 'Data storage', priority: 5 },
    { key: 'psu', name: 'Power Supply', icon: Zap, description: 'Powers everything', priority: 6 },
    { key: 'case', name: 'Case', icon: Package, description: 'Houses components', priority: 7 },
    { key: 'cooler', name: 'Cooling', icon: Thermometer, description: 'Keeps it cool', priority: 8 }
  ], []);

  // Helper functions
  const getCurrentCategory = useCallback(() => {
    return componentCategories[activeStep - 1] || componentCategories[0];
  }, [componentCategories, activeStep]);

  const getApiCategoryName = useCallback((key) => {
    switch (key) {
      case 'cpu': return 'CPU';
      case 'motherboard': return 'Motherboard';
      case 'gpu': return 'GPU';
      case 'ram': return 'RAM';
      case 'storage': return 'Storage';
      case 'psu': return 'PSU';
      case 'case': return 'Case';
      case 'cooler': return 'Cooler';
      default: return '';
    }
  }, []);

  // Helper function to determine component type from component data
  const getComponentType = useCallback((component) => {
    if (component.socket) return 'cpu';
    if (component.chipset || component.ram_type || component.form_factor) return 'motherboard';
    if (component.chipset && component.memory) return 'gpu';
    if (component.type && component.speed) return 'ram';
    if (component.capacity && component.type && (component.type.toLowerCase().includes('ssd') || component.type.toLowerCase().includes('hdd'))) return 'storage';
    if (component.wattage && component.efficiency) return 'psu';
    if (component.form_factor && component.fans) return 'case';
    if (component.type && component.tdp) return 'cooler';
    return 'default';
  }, []);

  // Update compatibility score when components change
  useEffect(() => {
    // Only calculate compatibility if components are loaded
    if (!componentsLoaded) return;
    
    // Use the imported getCompatibilityScore function which calculates compatibility directly
    const compatibilityResult = getCompatibilityScore(selectedComponents);
    setCompatibilityScore(compatibilityResult.score);
  }, [selectedComponents, componentsLoaded]);

  // Fetch all components for compatibility comparison
  useEffect(() => {
    const fetchAllComponents = async () => {
      try {
        const currentCategory = getCurrentCategory();
        if (!currentCategory || !currentCategory.key) return;
        
        const dbCategory = getApiCategoryName(currentCategory.key);
        const url = getApiEndpoint('components', { 
          category: dbCategory,
          ...(branch && { branch })
        });
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error fetching components: ${response.status} ${response.statusText}`, errorText);
          
          // Try to parse as JSON for detailed error
          try {
            const errorData = JSON.parse(errorText);
            console.error('API Error Details:', errorData);
          } catch (e) {
            console.error('Non-JSON error response:', errorText);
          }
          
          setAllComponents([]);
          return;
        }
        
        const data = await response.json();

        if (data.success) {
          setAllComponents(data.data || []);
          console.log(`Loaded ${data.data?.length || 0} components for category: ${dbCategory}`);
        } else {
          console.error('API returned error:', data.error || 'Unknown error');
          setAllComponents([]);
        }
      } catch (err) {
        console.error('Error fetching components for comparison:', err);
        setAllComponents([]);
      }
    };

    fetchAllComponents();
  }, [getCurrentCategory, getApiCategoryName, branch]);



  const getNormalizedComponents = useCallback((components) => {
    const defaultKeys = {
      cpu: null,
      motherboard: null,
      gpu: null,
      ram: null,
      storage: null,
      psu: null,
      case: null,
      cooler: null
    };

    // Canonicalize incoming keys to prevent alias drift (e.g., 'cooling' -> 'cooler')
    const KEY_MAP = {
      cpu: ['cpu', 'processor', 'procie', 'procie only', 'processor only'],
      motherboard: ['motherboard', 'mobo'],
      gpu: ['gpu', 'graphics', 'graphics card', 'video', 'video card', 'vga'],
      ram: ['ram', 'memory', 'ddr', 'ddr4', 'ddr5', 'ram 3200mhz'],
      storage: ['storage', 'ssd', 'nvme', 'ssd nvme', 'hdd', 'hard drive', 'drive'],
      psu: ['psu', 'power supply', 'psu - tr', 'tr psu'],
      case: ['case', 'chassis', 'case gaming'],
      cooler: ['cooler', 'coolers', 'cooling', 'aio', 'cpu cooler', 'liquid cooler', 'water cooling', 'fan', 'heatsink']
    };

    const input = components || {};
    const lower = {};
    Object.keys(input).forEach(k => { lower[k.toLowerCase()] = input[k]; });

    const canon = {};
    Object.entries(KEY_MAP).forEach(([canonKey, aliases]) => {
      for (const a of aliases) {
        if (lower[a]) { canon[canonKey] = lower[a]; break; }
      }
    });
    // Retain any already canonical keys
    Object.keys(lower).forEach(k => { if (KEY_MAP[k]) canon[k] = lower[k]; });

    return { ...defaultKeys, ...canon };
  }, []);

  const getComponentSpec = useCallback((component, specName) => {
    if (!component) return null;
    // Robustly extract socket info (case-insensitive, trim, check everywhere)
    if (specName === 'socket') {
      const tryFields = [
        component.socket,
        component.Socket,
        component.type,
        component.Type,
        component.model,
        component.Model,
        component.name,
        component.Name,
        component.specs && component.specs.socket,
        component.specs && component.specs.type,
        component.specs && component.specs.model,
        component.specs && component.specs.name
      ];
      for (let val of tryFields) {
        if (typeof val === 'string' && val.trim()) {
          const v = val.trim().toLowerCase();
          if (v.includes('am4')) return 'am4';
          if (v.includes('lga1200')) return 'lga1200';
          if (v.includes('am5')) return 'am5';
          if (v.includes('lga1700')) return 'lga1700';
        }
      }
      return null;
    }
    // Robustly extract brand
    if (specName === 'brand') {
      const tryFields = [
        component.brand,
        component.Brand,
        component.name,
        component.Name,
        component.model,
        component.Model,
        component.type,
        component.Type,
        component.specs && component.specs.brand,
        component.specs && component.specs.name
      ];
      for (let val of tryFields) {
        if (typeof val === 'string' && val.trim()) {
          const v = val.trim().toLowerCase();
          if (v.includes('amd')) return 'amd';
          if (v.includes('intel')) return 'intel';
        }
      }
      return null;
    }
    // RAM type
    if (specName === 'ramType') {
      return component.ram_type || component.type || (component.specs && (component.specs.ram_type || component.specs.type)) || null;
    }
    // Form factor
    if (specName === 'formFactor') {
      return component.form_factor || (component.specs && component.specs.form_factor) || null;
    }
    // Default case
    return component[specName] || (component.specs && component.specs[specName]) || null;
  }, []);

  // Fetch functions
  const fetchComponentsByIds = useCallback(async (componentIds) => {
    try {
      const ids = Object.values(componentIds).filter(id => id && typeof id === 'number');
      if (ids.length === 0) return {};
      
      const url = `${API_BASE}/get_components_by_ids.php?ids=${ids.join(',')}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.data) {
        const componentsByCategory = {};
        data.data.forEach(component => {
          const category = Object.keys(componentIds).find(cat => 
            componentIds[cat] == component.id
          );
          if (category) {
            componentsByCategory[category] = component;
          }
        });
        return componentsByCategory;
      }
      return {};
    } catch (error) {
      console.error('Error fetching components by IDs:', error);
      return {};
    }
  }, []);

  const fetchRecommendations = useCallback(async (category, requirements = {}) => {
    const apiCategory = getApiCategoryName(category);
    if (!apiCategory) return;
    
    setLoadingRecommendations(prev => ({ ...prev, [category]: true }));
    try {
      let apiParams = { category: apiCategory, limit: 5 };
      
      if (requirements.socket) apiParams.socket = requirements.socket;
      if (requirements.type) apiParams.ramType = requirements.type;
      if (requirements.minWattage) apiParams.minWattage = requirements.minWattage;
      if (requirements.minSize) apiParams.minSize = requirements.minSize;
      if (requirements.formFactor) apiParams.formFactor = requirements.formFactor;
      
      let { data } = await axios.get(`${API_BASE}/index.php?endpoint=recommendations`, { params: apiParams });
      
      if (!data.data || data.data.length === 0) {
        const broaderParams = { 
          category: apiCategory, 
          limit: 5,
          minPrice: 1000,
          maxPrice: 500000
        };
        const broaderResponse = await axios.get(`${API_BASE}/index.php?endpoint=recommendations`, { params: broaderParams });
        if (broaderResponse.data.data && broaderResponse.data.data.length > 0) {
          data = broaderResponse.data;
        }
      }
      
      if (!data.data || data.data.length === 0) {
        const topParams = { category: apiCategory, limit: 3 };
        const topResponse = await axios.get(`${API_BASE}/index.php?endpoint=recommendations`, { params: topParams });
        if (topResponse.data.data && topResponse.data.data.length > 0) {
          data = topResponse.data;
        }
      }
      
      setRecommendations(prev => ({ ...prev, [category]: data.data || [] }));
    } catch (e) {
      console.error('Error fetching recommendations:', e);
      setRecommendations(prev => ({ ...prev, [category]: [] }));
    } finally {
      setLoadingRecommendations(prev => ({ ...prev, [category]: false }));
    }
  }, [getApiCategoryName]);

  // Fetch recommendations when category/step changes
  useEffect(() => {
    const currentCategory = getCurrentCategory();
    if (currentCategory) {
      // Extract requirements from selected components
      const requirements = {};
      if (selectedComponents.cpu) {
        const socket = getComponentSpec(selectedComponents.cpu, 'socket');
        if (socket) requirements.socket = socket;
      }
      if (selectedComponents.motherboard) {
        const ramType = getComponentSpec(selectedComponents.motherboard, 'ramType');
        if (ramType) requirements.type = ramType;
        const formFactor = getComponentSpec(selectedComponents.motherboard, 'formFactor');
        if (formFactor) requirements.formFactor = formFactor;
      }
      
      fetchRecommendations(currentCategory.key, requirements);
    }
  }, [activeStep, selectedComponents, getCurrentCategory, fetchRecommendations, getComponentSpec]);

  // Compatibility functions
  const getCompatibilitySuggestions = useCallback((category) => {
    const component = selectedComponents[category];
    if (!component) return null;

    const suggestions = [];

    // CPU suggestions
    if (category === 'cpu' && selectedComponents.motherboard) {
      const cpuSocket = getComponentSpec(component, 'socket');
      const moboSocket = getComponentSpec(selectedComponents.motherboard, 'socket');
      // Only add suggestion if sockets are different and not both AM4
      if (
        cpuSocket && moboSocket && cpuSocket !== moboSocket &&
        !(cpuSocket.toLowerCase() === 'am4' && moboSocket.toLowerCase() === 'am4')
      ) {
        suggestions.push({
          type: 'replace',
          message: `CPU socket (${cpuSocket}) doesn't match motherboard (${moboSocket})`,
          action: 'Replace CPU',
          targetCategory: 'cpu',
          requirements: { socket: moboSocket }
        });
      }
    }

    // Motherboard suggestions
    if (category === 'motherboard') {
      const moboSocket = getComponentSpec(component, 'socket');
      const moboRamType = getComponentSpec(component, 'ramType');
      if (selectedComponents.cpu) {
        const cpuSocket = getComponentSpec(selectedComponents.cpu, 'socket');
        // Only add suggestion if sockets are different and not both AM4
        if (
          moboSocket && cpuSocket && moboSocket !== cpuSocket &&
          !(moboSocket.toLowerCase() === 'am4' && cpuSocket.toLowerCase() === 'am4')
        ) {
          suggestions.push({
            type: 'replace',
            message: `Motherboard socket (${moboSocket}) doesn't match CPU (${cpuSocket})`,
            action: 'Replace Motherboard',
            targetCategory: 'motherboard',
            requirements: { socket: cpuSocket }
          });
        }
      }
      if (selectedComponents.ram) {
        const ramType = getComponentSpec(selectedComponents.ram, 'ramType');
        if (moboRamType && ramType && moboRamType !== ramType) {
          suggestions.push({
            type: 'replace',
            message: `Motherboard supports ${moboRamType} but RAM is ${ramType}`,
            action: 'Replace RAM',
            targetCategory: 'ram',
            requirements: { type: moboRamType }
          });
        }
      }
    }

    // RAM suggestions
    if (category === 'ram' && selectedComponents.motherboard) {
      const ramType = getComponentSpec(component, 'ramType');
      const moboRamType = getComponentSpec(selectedComponents.motherboard, 'ramType');
      if (ramType && moboRamType && ramType !== moboRamType) {
        suggestions.push({
          type: 'replace',
          message: `RAM type (${ramType}) doesn't match motherboard (${moboRamType})`,
          action: 'Replace RAM',
          targetCategory: 'ram',
          requirements: { type: moboRamType }
        });
      }
      // RAM sticks vs. motherboard slots
      const ramSticks = getComponentSpec(component, 'sticks') || getComponentSpec(component, 'modules') || 1;
      const moboSlots = getComponentSpec(selectedComponents.motherboard, 'ram_slots') || getComponentSpec(selectedComponents.motherboard, 'slots') || 2;
      if (ramSticks > moboSlots) {
        suggestions.push({
          type: 'replace',
          message: `Selected RAM (${ramSticks} sticks) exceeds motherboard slots (${moboSlots})`,
          action: 'Replace RAM',
          targetCategory: 'ram',
          requirements: { maxSticks: moboSlots }
        });
      }
    }

    // Storage suggestions
    if (category === 'storage' && selectedComponents.motherboard) {
      const storageInterface = getComponentSpec(component, 'interface') || getComponentSpec(component, 'type');
      const moboStorage = getComponentSpec(selectedComponents.motherboard, 'storage_interfaces') || getComponentSpec(selectedComponents.motherboard, 'storage_support');
      if (storageInterface && moboStorage && !String(moboStorage).toLowerCase().includes(String(storageInterface).toLowerCase())) {
        suggestions.push({
          type: 'replace',
          message: `Storage interface (${storageInterface}) not supported by motherboard (${moboStorage})`,
          action: 'Replace Storage',
          targetCategory: 'storage',
          requirements: { interface: moboStorage }
        });
      }
    }

    // PSU suggestions
    if (category === 'psu') {
      const cpuTdp = getComponentSpec(selectedComponents.cpu, 'tdp') || 0;
      const gpuTdp = getComponentSpec(selectedComponents.gpu, 'tdp') || 0;
      const totalPower = cpuTdp + gpuTdp + 100;
      const recommendedWattage = Math.ceil((totalPower * 1.2) / 10) * 10;
      const psuWattage = getComponentSpec(component, 'wattage');
      if (psuWattage && psuWattage < recommendedWattage) {
        suggestions.push({
          type: 'upgrade',
          message: `PSU (${psuWattage}W) may not provide enough power (${recommendedWattage}W recommended)`,
          action: 'Upgrade PSU',
          targetCategory: 'psu',
          requirements: { minWattage: recommendedWattage }
        });
      }
      // PSU form factor vs. case
      if (selectedComponents.case) {
        const psuForm = getComponentSpec(component, 'form_factor') || getComponentSpec(component, 'type');
        const casePsuSupport = getComponentSpec(selectedComponents.case, 'psu_support') || getComponentSpec(selectedComponents.case, 'psu_type');
        if (psuForm && casePsuSupport && !String(casePsuSupport).toLowerCase().includes(String(psuForm).toLowerCase())) {
          suggestions.push({
            type: 'replace',
            message: `PSU form factor (${psuForm}) not supported by case (${casePsuSupport})`,
            action: 'Replace PSU',
            targetCategory: 'psu',
            requirements: { form_factor: casePsuSupport }
          });
        }
      }
    }

    // GPU suggestions
    if (category === 'gpu' && selectedComponents.case) {
      const gpuLength = getComponentSpec(component, 'length') || getComponentSpec(component, 'max_length');
      const caseGpuMax = getComponentSpec(selectedComponents.case, 'gpu_max_length') || getComponentSpec(selectedComponents.case, 'max_gpu_length');
      if (gpuLength && caseGpuMax && Number(gpuLength) > Number(caseGpuMax)) {
        suggestions.push({
          type: 'replace',
          message: `GPU length (${gpuLength}mm) exceeds case max GPU length (${caseGpuMax}mm)` ,
          action: 'Replace GPU',
          targetCategory: 'gpu',
          requirements: { maxLength: caseGpuMax }
        });
      }
    }

    // Cooler suggestions
    if (category === 'cooler' && selectedComponents.case) {
      const coolerHeight = getComponentSpec(component, 'height') || getComponentSpec(component, 'max_height');
      const caseCoolerMax = getComponentSpec(selectedComponents.case, 'cooler_max_height') || getComponentSpec(selectedComponents.case, 'max_cooler_height');
      if (coolerHeight && caseCoolerMax && Number(coolerHeight) > Number(caseCoolerMax)) {
        suggestions.push({
          type: 'replace',
          message: `Cooler height (${coolerHeight}mm) exceeds case max cooler height (${caseCoolerMax}mm)` ,
          action: 'Replace Cooler',
          targetCategory: 'cooler',
          requirements: { maxHeight: caseCoolerMax }
        });
      }
    }

    // Case suggestions
    if (category === 'case' && selectedComponents.motherboard) {
      const caseForm = getComponentSpec(selectedComponents.case, 'formFactor');
      const moboForm = getComponentSpec(selectedComponents.motherboard, 'formFactor');
      if (caseForm && moboForm) {
        // Support for multiple form factors in case
        const supportedForms = Array.isArray(caseForm)
          ? caseForm.map(f => f.toLowerCase())
          : String(caseForm).split(/,|\//).map(f => f.trim().toLowerCase());
        if (!supportedForms.includes(String(moboForm).toLowerCase())) {
          suggestions.push({
            type: 'replace',
            message: `Case form factor (${caseForm}) may not fit motherboard (${moboForm})`,
            action: 'Replace Case',
            targetCategory: 'case',
            requirements: { formFactor: moboForm }
          });
        }
      }
    }

    return suggestions;
  }, [selectedComponents, getComponentSpec]);

  // Helper functions for compatibility score styling
  const getCompatibilityScoreColor = (score, isBackground = false) => {
    if (score >= 90) return isBackground ? 'bg-green-500' : 'text-green-600';
    if (score >= 70) return isBackground ? 'bg-yellow-500' : 'text-yellow-600';
    if (score >= 50) return isBackground ? 'bg-orange-500' : 'text-orange-600';
    return isBackground ? 'bg-red-500' : 'text-red-600';
  };

  const getCompatibilityStatusStyle = (score) => {
    if (score >= 90) return 'bg-green-50 border-green-400';
    if (score >= 70) return 'bg-yellow-50 border-yellow-400';
    if (score >= 50) return 'bg-orange-50 border-orange-400';
    return 'bg-red-50 border-red-400';
  };

  const getCompatibilityStatusTextColor = (score) => {
    if (score >= 90) return 'text-green-800';
    if (score >= 70) return 'text-yellow-800';
    if (score >= 50) return 'text-orange-800';
    return 'text-red-800';
  };

  const getCompatibilityStatusMessage = (score) => {
    if (score >= 90) return 'Excellent! Your build is highly compatible and ready for assembly.';
    if (score >= 70) return 'Good compatibility with minor optimizations available.';
    if (score >= 50) return 'Moderate compatibility - some components may need adjustment.';
    if (score > 0) return 'Low compatibility - significant issues detected that need attention.';
    return 'No components selected yet - start building to see compatibility score.';
  };

  // Event handlers
  const handleComponentSelect = useCallback((category, component) => {
    setSelectedComponents(prev => ({
      ...prev,
      [category]: component
    }));
    
    const currentCategoryIndex = componentCategories.findIndex(cat => cat.key === category);
    if (currentCategoryIndex === activeStep - 1 && activeStep < componentCategories.length) {
      setActiveStep(activeStep + 1);
    }
  }, [setSelectedComponents, componentCategories, activeStep]);

  const handleComponentRemove = useCallback((category) => {
    setSelectedComponents(prev => ({
      ...prev,
      [category]: null
    }));
  }, [setSelectedComponents]);

  const handleSuggestionAction = useCallback((suggestion) => {
    setActiveStep(componentCategories.findIndex(cat => cat.key === suggestion.targetCategory) + 1);
  }, [componentCategories]);

  const handleClearAllComponents = useCallback(() => {
    // Automated clear without blocking confirm dialog
      const emptyComponents = {
        cpu: null,
        motherboard: null,
        gpu: null,
        ram: null,
        storage: null,
        psu: null,
        case: null,
        cooler: null
      };
      // Reset both the source of truth (prop setter) and our internal fallback
      try { setSelectedComponents(emptyComponents); } catch {}
      try { setInternalSelectedComponents && setInternalSelectedComponents(emptyComponents); } catch {}

      // Clear any persisted selections/editing state
      try { localStorage.removeItem('builditpc-selected-components'); } catch {}
      try { localStorage.removeItem('builditpc-editing-build'); } catch {}

      // Reset derived UI state to avoid stale badges/totals
      setCompatibilityStatus({});
      setCompatibilityDetails({});
      setRecommendations({});
      setCompatibilityScore(0);
      setActiveStep(1);

      // Exit editing mode and clear form fields if any
      setIsEditing(false);
      setEditingBuildId(null);
      setBuildName('');
      setBuildDescription('');

      // Ensure our local persistence ref reflects the cleared state
      try { prevComponentsRef.current = JSON.stringify(emptyComponents); } catch {}
      // Force a remount of child selectors to clear any internal caches
      setResetNonce(n => n + 1);
      // Optional: broadcast a clear event for any listeners
      try { window.dispatchEvent(new CustomEvent('builditpc:clear')); } catch {}
  }, [setSelectedComponents, setInternalSelectedComponents]);

  // Calculation functions
  const getTotalPrice = useCallback(() => {
    return Object.values(selectedComponents)
      .filter(component => component)
      .reduce((total, component) => {
        if (typeof component === 'object' && component !== null) {
          const price = typeof component.price === 'string' ? parseFloat(component.price) : component.price || 0;
          return total + price;
        }
        return total;
      }, 0);
  }, [selectedComponents]);

  const getLocalCompatibilityScore = useCallback(() => {
    const requiredCategories = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case'];
    const selectedCount = requiredCategories.filter(category => {
      const component = selectedComponents[category];
      // More robust check for valid components
      if (!component) return false;
      if (typeof component !== 'object') return false;
      if (Object.keys(component).length === 0) return false;
      // Check if component has essential properties
      return component.id && component.name;
    }).length;
    if (selectedCount === 0) return 0;
    
    // Use the imported getCompatibilityScore function for consistent calculation
    const compatibilityResult = getCompatibilityScore(selectedComponents);
    return compatibilityResult.score;
  }, [selectedComponents]);

  const getCategoriesWithIssues = useCallback(() => {
    const issues = [];
    if (compatibilityStatus.cpu_motherboard === false) issues.push('cpu', 'motherboard');
    if (compatibilityStatus.ram_motherboard === false) issues.push('ram', 'motherboard');
    if (compatibilityStatus.ram_slots === false) issues.push('ram', 'motherboard');
    if (compatibilityStatus.ram_speed === false) issues.push('ram', 'motherboard');
    if (compatibilityStatus.storage_interface === false) issues.push('storage', 'motherboard');
    if (compatibilityStatus.psu_power === false) issues.push('psu');
    if (compatibilityStatus.psu_form_factor === false) issues.push('psu', 'case');
    if (compatibilityStatus.case_motherboard === false) issues.push('case', 'motherboard');
    if (compatibilityStatus.gpu_length === false) issues.push('gpu', 'case');
    if (compatibilityStatus.cooler_height === false) issues.push('cooler', 'case');
    if (compatibilityStatus.cooler_socket === false) issues.push('cooler', 'cpu');
    if (compatibilityStatus.ram_cpu_speed === false) issues.push('ram', 'cpu');
    return new Set(issues);
  }, [compatibilityStatus]);

  const getSelectedComponentsCount = useCallback(() => {
    return Object.entries(selectedComponents)
      .filter(([category, component]) => component !== null && component !== undefined)
      .length;
  }, [selectedComponents]);

  const getRequiredComponentsCount = useCallback(() => {
    return 7; // cpu, motherboard, gpu, ram, storage, psu, case
  }, []);

  const getSelectedRequiredComponentsCount = useCallback(() => {
    const requiredCategories = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case'];
    return requiredCategories.filter(category => {
      const component = selectedComponents[category];
      // More robust check for valid components
      if (!component) return false;
      if (typeof component !== 'object') return false;
      if (Object.keys(component).length === 0) return false;
      // Check if component has essential properties
      return component.id && component.name;
    }).length;
  }, [selectedComponents]);

  const canSaveBuild = useCallback(() => {
    return getSelectedRequiredComponentsCount() >= 5;
  }, [getSelectedRequiredComponentsCount]);

  const getBuildPerformance = useCallback(() => {
    const components = selectedComponents;
    let gamingScore = 0;
    let workstationScore = 0;
    let coolingScore = 0;
    let upgradeScore = 0;

    if (components.gpu && components.cpu) {
      const gpuPrice = typeof components.gpu === 'object' ? (components.gpu.price || 0) : 0;
      const cpuPrice = typeof components.cpu === 'object' ? (components.cpu.price || 0) : 0;
      gamingScore = Math.min(100, (gpuPrice / 50000) * 100 + (cpuPrice / 30000) * 100);
    }

    if (components.cpu && components.ram) {
      const cpuCores = typeof components.cpu === 'object' ? (components.cpu.cores || 0) : 0;
      const ramCapacity = typeof components.ram === 'object' ? (components.ram.capacity || 0) : 0;
      workstationScore = Math.min(100, (cpuCores / 16) * 100 + (ramCapacity / 64) * 100);
    }

    if (components.cooler) {
      if (typeof components.cooler === 'object') {
        coolingScore = components.cooler.type === 'AIO Liquid Cooler' ? 100 : 
                      components.cooler.type === 'Air Cooler' ? 80 : 60;
      } else {
        coolingScore = 40;
      }
    } else {
      coolingScore = 40;
    }

    if (components.motherboard) {
      if (typeof components.motherboard === 'object') {
        upgradeScore = components.motherboard.ram_type === 'DDR5' ? 100 : 70;
      } else {
        upgradeScore = 70;
      }
    }

    return { gamingScore, workstationScore, coolingScore, upgradeScore };
  }, [selectedComponents]);

  const performance = useMemo(() => getBuildPerformance(), [getBuildPerformance]);

  const getComponentSelectionProgress = useCallback(() => {
    const requiredCategories = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case'];
    const selectedCount = requiredCategories.filter(category => {
      const component = selectedComponents[category];
      // More robust check for valid components
      if (!component) return false;
      if (typeof component !== 'object') return false;
      if (Object.keys(component).length === 0) return false;
      // Check if component has essential properties
      return component.id && component.name;
    }).length;
    return Math.round((selectedCount / requiredCategories.length) * 100);
  }, [selectedComponents]);

  const hasCompatibilityIssues = useCallback((category) => {
    const component = selectedComponents[category];
    if (!component) return false;

    switch (category) {
      case 'cpu':
        return compatibilityStatus.cpu_motherboard === false || compatibilityStatus.cooler_socket === false || compatibilityStatus.ram_cpu_speed === false;
      case 'motherboard':
        return compatibilityStatus.cpu_motherboard === false || compatibilityStatus.ram_motherboard === false || compatibilityStatus.ram_slots === false || compatibilityStatus.ram_speed === false || compatibilityStatus.storage_interface === false || compatibilityStatus.case_motherboard === false;
      case 'ram':
        return compatibilityStatus.ram_motherboard === false || compatibilityStatus.ram_slots === false || compatibilityStatus.ram_speed === false || compatibilityStatus.ram_cpu_speed === false;
      case 'storage':
        return compatibilityStatus.storage_interface === false;
      case 'psu':
        return compatibilityStatus.psu_power === false || compatibilityStatus.psu_form_factor === false;
      case 'case':
        return compatibilityStatus.case_motherboard === false || compatibilityStatus.gpu_length === false || compatibilityStatus.cooler_height === false || compatibilityStatus.psu_form_factor === false;
      case 'gpu':
        return compatibilityStatus.gpu_length === false;
      case 'cooler':
        return compatibilityStatus.cooler_height === false || compatibilityStatus.cooler_socket === false;
      default:
        return false;
    }
  }, [selectedComponents, compatibilityStatus]);

  // Helper to check if there are any critical compatibility issues
  const hasCriticalCompatibilityIssues = Object.values(compatibilityStatus).some(status => status === false);

  // Helper for explicit test-case messages
  const getBuildStatusMessage = () => {
    const requiredComplete = getSelectedRequiredComponentsCount() === getRequiredComponentsCount();
    if (!requiredComplete) {
      return 'Build incomplete, please add more components';
    }
    if (hasCriticalCompatibilityIssues) {
      if (compatibilityStatus.cpu_motherboard === false) {
        return 'Incompatible: Socket mismatch';
      }
      return 'Compatibility issues detected';
    }
    if (getLocalCompatibilityScore() === 100) {
      return 'Build compatible and ready';
    }
    return '';
  };

  // Save build function
  const isTokenExpired = (token) => {
    try {
      const part = token.split('.')[1];
      if (!part) return true;
      // Convert base64url -> base64 and pad
      let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const payload = JSON.parse(atob(b64));
      if (!payload.exp) return false;
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  };

  const [userLoading, setUserLoading] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  // Add all build components to cart
  const handleAddToCart = useCallback(async () => {
    // Require all required components
    if (getSelectedRequiredComponentsCount() < getRequiredComponentsCount()) {
      alert('Build incomplete, please add more components');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token) || !user) {
      setShowAuthPrompt(true);
      return;
    }

    try {
      setAddingToCart(true);
      
      // Build component IDs object from selected components
      const requiredCategories = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case'];
      const optionalCategories = ['cooler'];
      const componentIds = {};
      const items = [];
      const pushItem = (comp, cat) => {
        if (comp && typeof comp.id === 'number') {
          componentIds[cat] = comp.id;
          items.push({ component_id: comp.id, quantity: 1 });
        }
      };
      requiredCategories.forEach(cat => pushItem(selectedComponents[cat], cat));
      optionalCategories.forEach(cat => pushItem(selectedComponents[cat], cat));

      if (items.length === 0) {
        alert('No valid components found to add to cart.');
        return;
      }

      // First, check if these components match an existing prebuilt
      try {
        const componentIdsArray = Object.values(componentIds).filter(id => typeof id === 'number');
        const findPrebuiltUrl = `${API_BASE}/index.php?endpoint=cart&action=find_prebuilt&component_ids=${encodeURIComponent(JSON.stringify(componentIdsArray))}`;
        const findResponse = await fetch(findPrebuiltUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (findResponse.ok) {
          const findResult = await findResponse.json();
          if (findResult.success && findResult.prebuilt) {
            // Found matching prebuilt - add it as a prebuilt instead of individual components
            const addPrebuiltResponse = await fetch(`${API_BASE}/index.php?endpoint=cart`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                prebuilt_id: findResult.prebuilt.id,
                quantity: 1
              })
            });

            const addPrebuiltResult = await addPrebuiltResponse.json();
            if (addPrebuiltResponse.ok && addPrebuiltResult.success) {
              alert(`Prebuilt PC "${findResult.prebuilt.name}" added to cart successfully!`);
              if (typeof setCurrentPage === 'function') {
                // Optional: navigate to cart page
              }
              return;
            } else {
              // If adding prebuilt failed, fall through to add components individually
              console.warn('Failed to add prebuilt, falling back to individual components:', addPrebuiltResult.error);
            }
          }
        }
      } catch (findError) {
        // If finding prebuilt fails, fall through to add components individually
        console.warn('Error checking for matching prebuilt, adding components individually:', findError);
      }

      // No matching prebuilt found or prebuilt add failed - add components individually
      // Add each item to cart sequentially
      let successCount = 0;
      let errorMessages = [];
      let prebuiltErrors = {}; // Track errors by prebuilt: { prebuilt_id: { name, count, errors[] } }
      
      for (const item of items) {
        try {
          const response = await fetch(`${API_BASE}/index.php?endpoint=cart`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item)
          });

          const result = await response.json().catch(() => ({}));
          if (response.ok && result.success) {
            successCount++;
          } else {
            const errorMsg = result.error || 'Failed to add component to cart';
            errorMessages.push(errorMsg);
            
            // Check if error is about a component being in a prebuilt
            if (result.prebuilt_id && result.prebuilt_name) {
              const prebuiltId = result.prebuilt_id;
              if (!prebuiltErrors[prebuiltId]) {
                prebuiltErrors[prebuiltId] = {
                  name: result.prebuilt_name,
                  count: 0,
                  errors: []
                };
              }
              prebuiltErrors[prebuiltId].count++;
              prebuiltErrors[prebuiltId].errors.push(errorMsg);
            }
          }
        } catch (e) {
          errorMessages.push(`Error adding component: ${e.message}`);
        }
      }

      if (successCount === items.length) {
        alert(`All ${successCount} components added to cart successfully!`);
        // Refresh cart count if callback exists
        if (typeof setCurrentPage === 'function') {
          // Optional: navigate to cart page
          // setCurrentPage('cart');
        }
      } else if (successCount > 0) {
        // Build a smarter error message
        let message = `Added ${successCount} out of ${items.length} components to cart.\n\n`;
        
        // If multiple components failed due to the same prebuilt, provide a helpful message
        const prebuiltErrorKeys = Object.keys(prebuiltErrors);
        if (prebuiltErrorKeys.length > 0) {
          message += 'Some components could not be added because they are already included in prebuilt PC(s) in your cart:\n\n';
          prebuiltErrorKeys.forEach(prebuiltId => {
            const prebuiltError = prebuiltErrors[prebuiltId];
            message += `• "${prebuiltError.name}": ${prebuiltError.count} component(s) already in cart\n`;
          });
          message += '\nTip: If you want to add this build as a separate prebuilt, you can add it directly from the Prebuilt PCs page instead of adding components individually.';
        } else {
          message += 'Some items could not be added:\n' + errorMessages.join('\n');
        }
        
        alert(message);
      } else {
        alert(`Failed to add items to cart:\n${errorMessages.join('\n')}`);
      }
    } catch (e) {
      console.error('Add to cart failed:', e);
      alert(`Failed to add to cart: ${e.message}`);
    } finally {
      setAddingToCart(false);
    }
  }, [selectedComponents, user, API_BASE, getRequiredComponentsCount, getSelectedRequiredComponentsCount, setCurrentPage]);

  // Show order confirmation modal before placing order
  const handleCompleteBuild = useCallback(() => {
    // Require all required components
    if (getSelectedRequiredComponentsCount() < getRequiredComponentsCount()) {
      alert('Build incomplete, please add more components');
      return;
    }
    if (hasCriticalCompatibilityIssues) {
      if (compatibilityStatus.cpu_motherboard === false) {
        alert('Incompatible: Socket mismatch');
      } else {
        alert('Please resolve critical compatibility issues before proceeding.');
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token) || !user) {
      setShowAuthPrompt(true);
      return;
    }

    // Show confirmation modal
    setShowOrderConfirmation(true);
  }, [selectedComponents, user, hasCriticalCompatibilityIssues, getRequiredComponentsCount, getSelectedRequiredComponentsCount]);

  // Create sales order from selected components
  const placeOrder = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || isTokenExpired(token) || !user) {
        setShowAuthPrompt(true);
        setShowOrderConfirmation(false);
        return;
      }

      // Build order items (default quantity 1 per component)
      const requiredCategories = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case'];
      const optionalCategories = ['cooler'];
      const items = [];
      const pushItem = (comp) => {
        if (comp && typeof comp.id === 'number') {
          const price = typeof comp.price === 'string' ? parseFloat(comp.price) : (comp.price || 0);
          items.push({ component_id: comp.id, quantity: 1, unit_price: price });
        }
      };
      requiredCategories.forEach(cat => pushItem(selectedComponents[cat]));
      optionalCategories.forEach(cat => pushItem(selectedComponents[cat]));

      if (items.length === 0) {
        alert('No valid components found to place an order.');
        setShowOrderConfirmation(false);
        return;
      }

      setPlacingOrder(true);
      const response = await fetch(`${API_BASE}/index.php?endpoint=orders${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: user?.id,
          status: 'pending',
          items
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        // Show detailed error message if out of stock items are provided
        if (result.out_of_stock_items && Array.isArray(result.out_of_stock_items) && result.out_of_stock_items.length > 0) {
          const outOfStockList = result.out_of_stock_items.map(item => {
            if (item.available === 0) {
              return `  • ${item.name} - Out of stock`;
            } else {
              return `  • ${item.name} - Requested: ${item.requested}, Available: ${item.available}`;
            }
          }).join('\n');
          throw new Error(`${result.error || 'Insufficient stock'}\n\nOut of stock components:\n${outOfStockList}\n\nPlease select different components or wait for restocking.`);
        }
        throw new Error(result.error || 'Failed to place order');
      }

      setShowOrderConfirmation(false);
      setOrderConfirmation({ order_id: result.order_id, total: result.total });
    } catch (e) {
      console.error('Order creation failed:', e);
      alert(`Failed to place order: ${e.message}`);
    } finally {
      setPlacingOrder(false);
    }
  }, [selectedComponents, user, API_BASE, branch]);

  // Handle community submission - defined before handleSaveBuild to avoid initialization errors
  const handleSubmitToCommunity = useCallback(async (buildId) => {
    // Validate build ID
    if (!buildId || !Number.isInteger(buildId) || buildId <= 0) {
      console.error('Submission failed: Build ID is required');
      throw new Error('Build ID is required');
    }

    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token) || !user) {
      setShowAuthPrompt(true);
      throw new Error('Authentication required');
    }

    setSubmittingToCommunity(true);
    try {
      const response = await fetch(`${API_BASE}/index.php?endpoint=community_submission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          build_id: buildId,
          build_name: buildName,
          build_description: buildDescription,
          total_price: getTotalPrice(),
          // Use the same compatibilityScore we save to the build
          compatibility: compatibilityScore
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        console.error('Submission failed:', result.error);
        throw new Error(result.error || 'Failed to submit build for review');
      }

      return result; // Return the result for the caller to handle
    } catch (error) {
      console.error('Error in handleSubmitToCommunity:', error);
      throw error; // Re-throw to be handled by the caller
    } finally {
      setSubmittingToCommunity(false);
    }
  }, [buildName, buildDescription, getTotalPrice, compatibilityScore, user, API_BASE]);

  const handleSaveBuild = useCallback(async () => {
    if (!buildName.trim()) return;

    const token = localStorage.getItem('token');
    if (userLoading) {
      // Optionally show a spinner or just return
      return;
    }
    if (!token || isTokenExpired(token) || !user) {
      setShowAuthPrompt(true);
      return;
    }

    // Prevent double-clicking by checking if already saving
    if (savingBuild) {
      return;
    }

    const filteredComponents = Object.fromEntries(
      Object.entries(selectedComponents)
        .filter(([key, comp]) => comp && typeof comp.id === 'number')
    );

    const requiredCategories = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case'];
    const missingRequired = requiredCategories.filter(cat => !filteredComponents[cat]);
    if (missingRequired.length > 0) {
      alert('Please select valid components for: ' + missingRequired.join(', '));
      return;
    }

    setSavingBuild(true);
    try {
      if (saveToPrebuilts) {
        // Build an automatic description if the user did not provide one
        // Format: comma-separated component names (like existing prebuilts)
        const generateAutoDescription = (comps) => {
          const parts = [];
          const addIf = (key) => {
            const c = comps[key];
            if (c && c.name) {
              // Extract short name (before first comma or parenthesis if present)
              const shortName = c.name.split(',')[0].split('(')[0].trim();
              parts.push(shortName);
            }
          };
          // Add components in order: CPU, Motherboard, GPU, RAM, Storage, PSU, Case, Cooler
          addIf('cpu');
          addIf('motherboard');
          addIf('gpu');
          addIf('ram');
          addIf('storage');
          addIf('psu');
          addIf('case');
          addIf('cooler');
          return parts.join(', ');
        };
        // Convert to prebuilts payload
        const componentIds = {};
        Object.entries(filteredComponents).forEach(([key, comp]) => {
          if (comp && typeof comp.id === 'number') {
            componentIds[key] = comp.id;
          }
        });

        const prebuiltData = {
          name: buildName,
          category: 'Custom',
          description: (buildDescription && buildDescription.trim().length > 0)
            ? buildDescription
            : generateAutoDescription(filteredComponents),
          component_ids: componentIds,
          price: getTotalPrice(),
          performance: {},
          features: [
            filteredComponents.cpu?.name || null,
            filteredComponents.gpu?.name || null,
            filteredComponents.ram?.name || null,
            filteredComponents.storage?.name || null
          ].filter(Boolean),
          in_stock: 1,
          is_hidden: 0
        };

        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(getApiEndpoint('prebuilts'), {
          method: 'POST',
          headers,
          body: JSON.stringify(prebuiltData)
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to save as prebuilt');
        }
        alert('Prebuilt created successfully. You can manage it in Prebuilt Management.');
        setShowSaveModal(false);
      } else {
        const buildData = {
          name: buildName,
          description: buildDescription,
          components: filteredComponents,
          compatibility: compatibilityScore,
          totalPrice: getTotalPrice(),
          is_public: isPublic
        };
        const buildIdNum = typeof editingBuildId === 'string' ? parseInt(editingBuildId, 10) : editingBuildId;
        const isUpdate = isEditing && Number.isFinite(buildIdNum) && buildIdNum > 0;
        const method = isUpdate ? 'PUT' : 'POST';
        let url = isUpdate 
          ? `${API_BASE}/index.php?endpoint=builds&id=${buildIdNum}`
          : `${API_BASE}/index.php?endpoint=builds`;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(url, { method, headers, body: JSON.stringify(buildData) });
        const result = await response.json();
        if (result.success) {
          // Extract build ID: for updates use editingBuildId, for creates use response
          const rawBuildId = isUpdate 
            ? (buildIdNum || result.build_id || result.data?.id)
            : (result.build_id || result.data?.id);
          
          // Convert to integer and validate
          const savedBuildId = rawBuildId ? parseInt(rawBuildId, 10) : null;
          
          // Only submit to community if build is public and we have a valid build ID
          if (isPublic && savedBuildId && Number.isInteger(savedBuildId) && savedBuildId > 0) {
            try {
              await handleSubmitToCommunity(savedBuildId);
              alert('Your build has been saved and submitted for community review!');
            } catch (error) {
              console.error('Error during community submission:', error);
              alert('Build saved successfully, but there was an error submitting for community review.');
            }
          }
          
          setBuildName('');
          setBuildDescription('');
          setShowSaveModal(false);
          localStorage.removeItem('builditpc-selected-components');
          localStorage.removeItem('builditpc-editing-build');
          setIsEditing(false);
          setEditingBuildId(null);
          const successMessage = isEditing ? 'Build updated successfully! You can view it in My Builds.' : 'Build saved successfully! You can view it in My Builds.';
          alert(successMessage);
          setCurrentPage('my-builds');
        } else {
          if (response.status === 409) {
            alert('A build with this name and configuration already exists.');
          } else {
            alert('Error saving build: ' + (result.error || 'Unknown error'));
          }
        }
      }
    } catch (error) {
      console.error('Error saving build:', error);
      alert('Error saving build. Please try again.');
    } finally {
      setSavingBuild(false);
    }
  }, [buildName, buildDescription, selectedComponents, isEditing, editingBuildId, compatibilityScore, getTotalPrice, setCurrentPage, user, setUser, userLoading, saveToPrebuilts, isPublic, handleSubmitToCommunity]);

  // Main useEffect for initialization and prebuilt selection
  useEffect(() => {
    // Prevent multiple initializations
    if (initializedRef.current) return;
    
    const initializeComponent = async () => {
      try {
        let initialComponents = getNormalizedComponents({});
        // Handle prebuilt components (IDs or objects)
        if (prebuiltComponents && Object.keys(prebuiltComponents).length > 0) {
          // Always fetch full components if any value is a number (ID)
          const hasIds = Object.values(prebuiltComponents).some(value => typeof value === 'number');
          if (hasIds) {
            const fullComponents = await fetchComponentsByIds(prebuiltComponents);
            initialComponents = getNormalizedComponents(fullComponents);
          } else {
            initialComponents = getNormalizedComponents(prebuiltComponents);
          }
        } else {
          // Load from localStorage only if user is authenticated
          if (user && user.id) {
            const saved = localStorage.getItem('builditpc-selected-components');
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                initialComponents = getNormalizedComponents(parsed);
                const hasComponents = Object.values(parsed).some(component => 
                  component !== null && component !== undefined && 
                  typeof component === 'object' && Object.keys(component).length > 0 &&
                  component.id && component.name
                );
                if (hasComponents) {
                  setShowRestoreNotification(true);
                  setTimeout(() => setShowRestoreNotification(false), 5000);
                }
              } catch (error) {
                console.error('Error parsing saved components:', error);
              }
            }
          } else {
            // For non-authenticated users, clear any existing localStorage data
            localStorage.removeItem('builditpc-selected-components');
            localStorage.removeItem('builditpc-editing-build');
          }
        }
        setSelectedComponents(initialComponents);
        setComponentsLoaded(true);
        if (onLoaded) onLoaded();
        // Check for editing build only if user is authenticated
        if (user && user.id) {
          const editingBuildData = localStorage.getItem('builditpc-editing-build');
          if (editingBuildData) {
            try {
              const editingBuild = JSON.parse(editingBuildData);
              const candidateId = typeof editingBuild.id === 'string' ? parseInt(editingBuild.id, 10) : editingBuild.id;
              if (Number.isFinite(candidateId) && candidateId > 0) {
                setIsEditing(true);
                setEditingBuildId(candidateId);
              } else {
                // Coming from a prebuilt (name/description only) – not an edit
                setIsEditing(false);
                setEditingBuildId(null);
              }
              // Use provided name/description to prefill the form even if not editing
              setBuildName(editingBuild.name || '');
              setBuildDescription(editingBuild.description || '');
            } catch (error) {
              console.error('Error parsing editing build data:', error);
            }
          }
        }
        initializedRef.current = true;
      } catch (error) {
        console.error('Error initializing component:', error);
        setComponentsLoaded(true);
        initializedRef.current = true;
      }
    };
    initializeComponent();
  }, [prebuiltComponents]); // Only depend on prebuiltComponents

  // Enhanced Compatibility check useEffect
  useEffect(() => {
    // Only run compatibility checks if components are loaded
    if (!componentsLoaded) return;
    
    const issues = {};
    const details = {};

    // Helper function to extract and normalize component specifications
    const getSpec = (component, specName) => {
      if (!component) return null;
      
      // Try multiple possible field names for each spec
      const specMappings = {
        socket: ['socket', 'Socket', 'type', 'Type', 'cpu_socket'],
        ramType: ['ramType', 'ram_type', 'memory_type', 'type', 'Type', 'ddr'],
        formFactor: ['formFactor', 'form_factor', 'size', 'Size', 'type', 'Type'],
        wattage: ['wattage', 'Wattage', 'power', 'Power', 'w', 'W'],
        tdp: ['tdp', 'TDP', 'thermal_design_power', 'power_consumption'],
        length: ['length', 'Length', 'max_length', 'maxLength', 'size'],
        height: ['height', 'Height', 'max_height', 'maxHeight'],
        width: ['width', 'Width', 'max_width', 'maxWidth'],
        interface: ['interface', 'Interface', 'connection', 'Connection', 'type', 'Type'],
        slots: ['slots', 'Slots', 'ram_slots', 'memory_slots', 'dimms'],
        sticks: ['sticks', 'Sticks', 'modules', 'Modules', 'ram_modules'],
        storage_interfaces: ['storage_interfaces', 'storage_support', 'sata_ports', 'm2_slots'],
        gpu_max_length: ['gpu_max_length', 'max_gpu_length', 'gpu_length', 'max_length'],
        cooler_max_height: ['cooler_max_height', 'max_cooler_height', 'cpu_cooler_height'],
        psu_support: ['psu_support', 'psu_type', 'power_supply_support'],
        chipset: ['chipset', 'Chipset', 'platform', 'Platform']
      };

      const possibleFields = specMappings[specName] || [specName];
      
      for (const field of possibleFields) {
        if (component[field]) return component[field];
        if (component.specs && component.specs[field]) return component.specs[field];
      }
      
      // Fallback: search in name and description
      const searchText = `${component.name || ''} ${component.description || ''}`.toLowerCase();
      if (specName === 'socket' && searchText.includes('am4')) return 'AM4';
      if (specName === 'socket' && searchText.includes('am5')) return 'AM5';
      if (specName === 'socket' && searchText.includes('lga1200')) return 'LGA1200';
      if (specName === 'socket' && searchText.includes('lga1700')) return 'LGA1700';
      if (specName === 'ramType' && searchText.includes('ddr4')) return 'DDR4';
      if (specName === 'ramType' && searchText.includes('ddr5')) return 'DDR5';
      if (specName === 'formFactor' && searchText.includes('atx')) return 'ATX';
      if (specName === 'formFactor' && searchText.includes('micro-atx')) return 'Micro-ATX';
      if (specName === 'formFactor' && searchText.includes('mini-itx')) return 'Mini-ITX';
      
      return null;
    };

    // --- CPU-Motherboard Socket Compatibility ---
    if (selectedComponents.cpu && selectedComponents.motherboard) {
      const cpuSocket = getSpec(selectedComponents.cpu, 'socket');
      const moboSocket = getSpec(selectedComponents.motherboard, 'socket');
      const cpuName = selectedComponents.cpu.name || '';
      const moboName = selectedComponents.motherboard.name || '';
      
      // Enhanced socket compatibility checking
      const socketCompatible = () => {
        if (!cpuSocket || !moboSocket) return null;
        
        const cpuSocketNorm = cpuSocket.toLowerCase().trim();
        const moboSocketNorm = moboSocket.toLowerCase().trim();
        
        // AMD Sockets
        if (cpuSocketNorm.includes('am4') && moboSocketNorm.includes('am4')) {
          // Check for Ryzen 5000 series on older chipsets
          const isRyzen5000 = /ryzen\s*(5[0-9]{3}|5600|5700|5800|5900|5950)/i.test(cpuName);
          const isOldChipset = /(a320|b350|b450|a520)/i.test(moboName);
          
          if (isRyzen5000 && isOldChipset) {
            return { compatible: true, warning: 'May require BIOS update for Ryzen 5000 series' };
          }
          return { compatible: true };
        }
        
        if (cpuSocketNorm.includes('am5') && moboSocketNorm.includes('am5')) {
          return { compatible: true };
        }
        
        // Intel Sockets
        if (cpuSocketNorm.includes('lga1200') && moboSocketNorm.includes('lga1200')) {
          return { compatible: true };
        }
        
        if (cpuSocketNorm.includes('lga1700') && moboSocketNorm.includes('lga1700')) {
          return { compatible: true };
        }
        
        if (cpuSocketNorm.includes('lga1851') && moboSocketNorm.includes('lga1851')) {
          return { compatible: true };
        }
        
        return { compatible: false };
      };
      
      const socketResult = socketCompatible();
      
      if (socketResult === null) {
        details.cpu_motherboard = 'Cannot determine socket compatibility (missing data)';
      } else if (socketResult.compatible) {
        issues.cpu_motherboard = true;
        if (socketResult.warning) {
          details.cpu_motherboard = `Compatible. ${socketResult.warning}`;
        }
      } else {
        issues.cpu_motherboard = false;
        details.cpu_motherboard = `CPU socket (${cpuSocket}) is not compatible with motherboard socket (${moboSocket})`;
      }
    }

    // --- RAM-Motherboard Compatibility ---
    if (selectedComponents.ram && selectedComponents.motherboard) {
      const ramType = getSpec(selectedComponents.ram, 'ramType');
      const moboRamType = getSpec(selectedComponents.motherboard, 'ramType');
      const ramSticks = getSpec(selectedComponents.ram, 'sticks') || 1;
      const moboSlots = getSpec(selectedComponents.motherboard, 'slots') || 2;
      const ramSpeed = getSpec(selectedComponents.ram, 'speed') || getSpec(selectedComponents.ram, 'frequency');
      const moboMaxSpeed = getSpec(selectedComponents.motherboard, 'max_ram_speed') || getSpec(selectedComponents.motherboard, 'memory_speed');
      
      // RAM Type compatibility
      if (ramType && moboRamType) {
        const ramTypeNorm = ramType.toLowerCase().trim();
        const moboRamTypeNorm = moboRamType.toLowerCase().trim();
        
        if (ramTypeNorm !== moboRamTypeNorm) {
          issues.ram_motherboard = false;
          details.ram_motherboard = `RAM type (${ramType}) is not compatible with motherboard (${moboRamType})`;
        } else {
          issues.ram_motherboard = true;
        }
      } else {
        details.ram_motherboard = 'Cannot determine RAM type compatibility (missing data)';
      }
      
      // RAM Slots compatibility
      if (ramSticks > moboSlots) {
        issues.ram_slots = false;
        details.ram_slots = `Selected RAM (${ramSticks} sticks) exceeds motherboard slots (${moboSlots})`;
      }
      
      // RAM Speed compatibility
      if (ramSpeed && moboMaxSpeed) {
        const ramSpeedNum = parseInt(ramSpeed);
        const moboSpeedNum = parseInt(moboMaxSpeed);
        
        if (ramSpeedNum > moboSpeedNum) {
          issues.ram_speed = false;
          details.ram_speed = `RAM speed (${ramSpeed}MHz) exceeds motherboard maximum (${moboMaxSpeed}MHz)`;
        }
      }
    }

    // --- Storage-Motherboard Compatibility ---
    if (selectedComponents.storage && selectedComponents.motherboard) {
      const storageInterface = getSpec(selectedComponents.storage, 'interface');
      const moboStorageSupport = getSpec(selectedComponents.motherboard, 'storage_interfaces');
      
      if (storageInterface && moboStorageSupport) {
        const interfaceNorm = storageInterface.toLowerCase();
        const supportNorm = moboStorageSupport.toLowerCase();
        
        // Check for common storage interfaces
        const isCompatible = 
          (interfaceNorm.includes('sata') && supportNorm.includes('sata')) ||
          (interfaceNorm.includes('nvme') && supportNorm.includes('nvme')) ||
          (interfaceNorm.includes('m.2') && supportNorm.includes('m.2')) ||
          (interfaceNorm.includes('pcie') && supportNorm.includes('pcie'));
        
        if (!isCompatible) {
          issues.storage_interface = false;
          details.storage_interface = `Storage interface (${storageInterface}) not supported by motherboard`;
        } else {
          issues.storage_interface = true;
        }
      } else {
        details.storage_interface = 'Cannot determine storage compatibility (missing data)';
      }
    }

    // --- PSU Power Compatibility ---
    if (selectedComponents.psu) {
      const psuWattage = getSpec(selectedComponents.psu, 'wattage');
      
      if (psuWattage) {
        // Calculate estimated power requirements
        let totalPower = 0;
        
        // CPU power
        if (selectedComponents.cpu) {
          const cpuTdp = getSpec(selectedComponents.cpu, 'tdp') || 65;
          totalPower += parseInt(cpuTdp);
        }
        
        // GPU power
        if (selectedComponents.gpu) {
          const gpuTdp = getSpec(selectedComponents.gpu, 'tdp') || 150;
          totalPower += parseInt(gpuTdp);
        }
        
        // Base system power (motherboard, RAM, storage, fans, etc.)
        totalPower += 100;
        
        // Add 20% buffer for efficiency and headroom
        const recommendedWattage = Math.ceil((totalPower * 1.2) / 50) * 50;
        const psuWattageNum = parseInt(psuWattage);
        
        if (psuWattageNum < recommendedWattage) {
          issues.psu_power = false;
          details.psu_power = `PSU wattage (${psuWattage}W) is below recommended (${recommendedWattage}W) for your components`;
        } else if (psuWattageNum < recommendedWattage * 1.5) {
          issues.psu_power = true;
          details.psu_power = `PSU wattage (${psuWattage}W) is adequate but consider ${recommendedWattage * 1.5}W for better efficiency`;
        } else {
          issues.psu_power = true;
        }
      } else {
        details.psu_power = 'Cannot determine PSU compatibility (missing wattage data)';
      }
      
      // PSU Form Factor compatibility
      if (selectedComponents.case) {
        const psuFormFactor = getSpec(selectedComponents.psu, 'form_factor');
        const casePsuSupport = getSpec(selectedComponents.case, 'psu_support');
        
        if (psuFormFactor && casePsuSupport) {
          const psuFormNorm = psuFormFactor.toLowerCase();
          const caseSupportNorm = casePsuSupport.toLowerCase();
          
          const isCompatible = 
            (psuFormNorm.includes('atx') && caseSupportNorm.includes('atx')) ||
            (psuFormNorm.includes('sfx') && caseSupportNorm.includes('sfx')) ||
            (psuFormNorm.includes('sfx-l') && caseSupportNorm.includes('sfx-l'));
          
          if (!isCompatible) {
            issues.psu_form_factor = false;
            details.psu_form_factor = `PSU form factor (${psuFormFactor}) not supported by case`;
          } else {
            issues.psu_form_factor = true;
          }
        }
      }
    }

    // --- Case-Motherboard Form Factor Compatibility ---
    if (selectedComponents.case && selectedComponents.motherboard) {
      const caseFormFactor = getSpec(selectedComponents.case, 'formFactor');
      const moboFormFactor = getSpec(selectedComponents.motherboard, 'formFactor');
      
      if (caseFormFactor && moboFormFactor) {
        const caseFormNorm = caseFormFactor.toLowerCase();
        const moboFormNorm = moboFormFactor.toLowerCase();
        
        // Form factor compatibility matrix
        const formFactorCompatibility = {
          'atx': ['atx', 'micro-atx', 'mini-itx'],
          'micro-atx': ['micro-atx', 'mini-itx'],
          'mini-itx': ['mini-itx'],
          'e-atx': ['e-atx', 'atx', 'micro-atx', 'mini-itx']
        };
        
        const supportedForms = formFactorCompatibility[caseFormNorm] || [];
        const isCompatible = supportedForms.includes(moboFormNorm);
        
        if (!isCompatible) {
          issues.case_motherboard = false;
          details.case_motherboard = `Case form factor (${caseFormFactor}) does not support motherboard (${moboFormFactor})`;
        } else {
          issues.case_motherboard = true;
        }
      } else {
        details.case_motherboard = 'Cannot determine form factor compatibility (missing data)';
      }
    }

    // --- GPU-Case Length Compatibility ---
    if (selectedComponents.gpu && selectedComponents.case) {
      const gpuLength = getSpec(selectedComponents.gpu, 'length');
      const caseMaxGpuLength = getSpec(selectedComponents.case, 'gpu_max_length');
      
      if (gpuLength && caseMaxGpuLength) {
        const gpuLengthNum = parseInt(gpuLength);
        const caseMaxLengthNum = parseInt(caseMaxGpuLength);
        
        if (gpuLengthNum > caseMaxLengthNum) {
          issues.gpu_length = false;
          details.gpu_length = `GPU length (${gpuLength}mm) exceeds case maximum (${caseMaxGpuLength}mm)`;
        } else {
          issues.gpu_length = true;
        }
      } else {
        details.gpu_length = 'Cannot determine GPU-case compatibility (missing data)';
      }
    }

    // --- CPU Cooler-Case Height Compatibility ---
    if (selectedComponents.cooler && selectedComponents.case) {
      const coolerHeight = getSpec(selectedComponents.cooler, 'height');
      const caseMaxCoolerHeight = getSpec(selectedComponents.case, 'cooler_max_height');
      
      if (coolerHeight && caseMaxCoolerHeight) {
        const coolerHeightNum = parseInt(coolerHeight);
        const caseMaxHeightNum = parseInt(caseMaxCoolerHeight);
        
        if (coolerHeightNum > caseMaxHeightNum) {
          issues.cooler_height = false;
          details.cooler_height = `Cooler height (${coolerHeight}mm) exceeds case maximum (${caseMaxCoolerHeight}mm)`;
        } else {
          issues.cooler_height = true;
        }
      } else {
        details.cooler_height = 'Cannot determine cooler-case compatibility (missing data)';
      }
    }

    // --- Additional Advanced Checks ---
    
    // CPU Cooler Socket Compatibility
    if (selectedComponents.cooler && selectedComponents.cpu) {
      const coolerSocket = getSpec(selectedComponents.cooler, 'socket');
      const cpuSocket = getSpec(selectedComponents.cpu, 'socket');
      
      if (coolerSocket && cpuSocket) {
        const coolerSocketNorm = coolerSocket.toLowerCase();
        const cpuSocketNorm = cpuSocket.toLowerCase();
        
        const socketCompatible = 
          (coolerSocketNorm.includes('am4') && cpuSocketNorm.includes('am4')) ||
          (coolerSocketNorm.includes('am5') && cpuSocketNorm.includes('am5')) ||
          (coolerSocketNorm.includes('lga1200') && cpuSocketNorm.includes('lga1200')) ||
          (coolerSocketNorm.includes('lga1700') && cpuSocketNorm.includes('lga1700')) ||
          (coolerSocketNorm.includes('universal') || coolerSocketNorm.includes('all'));
        
        if (!socketCompatible) {
          issues.cooler_socket = false;
          details.cooler_socket = `CPU cooler socket (${coolerSocket}) not compatible with CPU (${cpuSocket})`;
        } else {
          issues.cooler_socket = true;
        }
      }
    }

    // RAM Speed vs CPU/Motherboard Support
    if (selectedComponents.ram && selectedComponents.cpu) {
      const ramSpeed = getSpec(selectedComponents.ram, 'speed');
      const cpuMaxRamSpeed = getSpec(selectedComponents.cpu, 'max_memory_speed');
      
      if (ramSpeed && cpuMaxRamSpeed) {
        const ramSpeedNum = parseInt(ramSpeed);
        const cpuMaxSpeedNum = parseInt(cpuMaxRamSpeed);
        
        if (ramSpeedNum > cpuMaxSpeedNum) {
          issues.ram_cpu_speed = false;
          details.ram_cpu_speed = `RAM speed (${ramSpeed}MHz) exceeds CPU maximum (${cpuMaxRamSpeed}MHz)`;
        }
      }
    }

    setCompatibilityStatus(issues);
    setCompatibilityDetails(details);
  }, [selectedComponents, componentsLoaded]);

  // Save to localStorage (only for authenticated users)
  useEffect(() => {
    if (!user || !user.id) return; // Only save for authenticated users
    
    const componentsJson = JSON.stringify(selectedComponents);
    const prevComponentsJson = prevComponentsRef.current;
    
    // Only save if the components have actually changed
    if (componentsJson !== prevComponentsJson) {
      localStorage.setItem('builditpc-selected-components', componentsJson);
      prevComponentsRef.current = componentsJson;
    }
  }, [selectedComponents, user]);

  // Clear localStorage when user logs out
  useEffect(() => {
    if (!user || !user.id) {
      // User is not authenticated, clear localStorage
      localStorage.removeItem('builditpc-selected-components');
      localStorage.removeItem('builditpc-editing-build');
      prevComponentsRef.current = null;
    }
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isEditing) {
        localStorage.removeItem('builditpc-editing-build');
      }
      initializedRef.current = false;
    };
  }, [isEditing]);

  // Restore user state if token exists but user is null
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!user && typeof setUser === 'function' && token && !isTokenExpired(token)) {
      setUserLoading(true);
      fetch(`${API_BASE}/index.php?endpoint=profile`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (res.status === 401) {
            // Unauthorized: do not clear global token here
            return null;
          }
          return res.json();
        })
        .then(data => {
          if (data && data.success && data.user) {
            setUser(data.user);
          }
        })
        .catch(() => { /* ignore */ })
        .finally(() => setUserLoading(false));
    }
  }, [user, setUser]);

  // Show loading state
  if (!componentsLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">Loading PC Assembly...</h3>
          <p className="text-gray-600">Please wait while we load your components.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Compatibility Banner */}
      {hasCriticalCompatibilityIssues && (
        <div className="bg-red-100 border border-red-300 text-red-800 px-6 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <span className="font-semibold">Compatibility Issues Detected!</span>
            <span className="text-sm">Some components are not compatible. Please review the issues below before saving your build.</span>
          </div>
          <button
            onClick={() => window.scrollTo({ top: document.getElementById('compatibility-checker')?.offsetTop || 0, behavior: 'smooth' })}
            className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Review Issues
          </button>
        </div>
      )}
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">PC Assembly</h1>
                {isEditing && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    <Edit className="w-4 h-4 mr-1" />
                    Editing Build
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-1">
                {isEditing ? 'Modify your existing build configuration' : 'Build your dream PC with confidence'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowTips(!showTips)}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
              >
                <Lightbulb className="w-4 h-4" />
                {showTips ? 'Hide Tips' : 'Show Tips'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Restore Notification */}
      {showRestoreNotification && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-green-900">Components Restored</h3>
                  <p className="text-sm text-green-700">Your previously selected components have been restored from your last session.</p>
                </div>
              </div>
              <button
                onClick={() => setShowRestoreNotification(false)}
                className="flex-shrink-0 p-1 text-green-400 hover:text-green-600 hover:bg-green-100 rounded-full transition-colors duration-200"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full px-2 sm:px-4 lg:px-6 xl:px-8 2xl:px-12 py-4 sm:py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
          {/* Main Content Area - Responsive width for better space utilization */}
          <div className="lg:col-span-8 xl:col-span-8 2xl:col-span-9 space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Performance Analysis */}
            {getSelectedRequiredComponentsCount() >= 3 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Performance Analysis</h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Monitor className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-900">Gaming</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-700">
                      {Math.round(performance.gamingScore)}%
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${performance.gamingScore}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Settings className="w-5 h-5 text-purple-600" />
                      <span className="font-medium text-purple-900">Workstation</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-700">
                      {Math.round(performance.workstationScore)}%
                    </div>
                    <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${performance.workstationScore}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Thermometer className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-900">Cooling</span>
                    </div>
                    <div className="text-2xl font-bold text-green-700">
                      {Math.round(performance.coolingScore)}%
                    </div>
                    <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${performance.coolingScore}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowRight className="w-5 h-5 text-orange-600" />
                      <span className="font-medium text-orange-900">Upgrade Path</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-700">
                      {Math.round(performance.upgradeScore)}%
                    </div>
                    <div className="w-full bg-orange-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-orange-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${performance.upgradeScore}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Progress Steps */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Build Progress</h2>
                    <p className="text-sm text-gray-600">Track your component selection progress</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {getSelectedRequiredComponentsCount()}/{getRequiredComponentsCount()}
                    </div>
                    <div className="text-sm text-gray-600">components selected</div>
                  </div>
                  <div className="w-16 h-16 relative">
                    <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-gray-200"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-green-600"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray={`${(getSelectedRequiredComponentsCount() / getRequiredComponentsCount()) * 100}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-semibold text-gray-700">
                        {Math.round((getSelectedRequiredComponentsCount() / getRequiredComponentsCount()) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-8 2xl:grid-cols-8 gap-2 sm:gap-3 lg:gap-4">
                {componentCategories.map((category, index) => {
                  const isSelected = selectedComponents[category.key];
                  const isActive = index + 1 === activeStep;
                  const isCompleted = index + 1 < activeStep;
                  // For Processor and Motherboard, always show green, never warning
                  let hasIssues = false;
                  if (category.key === 'cpu' || category.key === 'motherboard') {
                    hasIssues = false;
                  } else {
                    const categoriesWithIssues = getCategoriesWithIssues();
                    hasIssues = categoriesWithIssues.has(category.key);
                  }
                  const IconComponent = category.icon;
                  return (
                    <div
                      key={category.key}
                      className={`relative group cursor-pointer ${isActive ? 'scale-105' : ''}`}
                      onClick={() => setActiveStep(index + 1)}
                    >
                      <div className={`
                        w-full aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-2 transition-all duration-200
                        ${isSelected 
                          ? 'bg-green-50 border-green-500 text-green-700'
                          : isActive 
                          ? 'bg-blue-50 border-blue-500 text-blue-700' 
                          : isCompleted
                          ? 'bg-gray-50 border-gray-300 text-gray-600'
                          : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                        }
                      `}>
                        <IconComponent className={`w-6 h-6 mb-1 ${
                          isSelected 
                            ? 'text-green-600' 
                            : isActive 
                              ? 'text-blue-600' 
                              : ''
                        }`} />
                        <span className="text-xs font-medium text-center leading-tight">
                          {category.name}
                        </span>
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-green-600 absolute -top-1 -right-1" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tips Section */}
            {showTips && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Lightbulb className="w-6 h-6 text-blue-600" />
                  <h3 className="text-lg font-semibold text-blue-900">Building Tips</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                  <div className="flex items-start gap-2">
                    <Target className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                    <span>Start with CPU and motherboard - they determine compatibility for other parts</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                    <span>Ensure your power supply has enough wattage for all components</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                    <span>Consider future upgrades when choosing motherboard and case</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                    <span>Don't rush - take time to research and compare components</span>
                  </div>
                </div>
              </div>
            )}

            {/* Component Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
                <div className="flex items-center gap-3">
                  {(() => {
                    const currentCategory = getCurrentCategory();
                    const IconComponent = currentCategory.icon;
                    return <IconComponent className="w-6 h-6 text-white" />;
                  })()}
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Select {getCurrentCategory().name}
                    </h2>
                    <p className="text-green-100 text-sm">
                      {getCurrentCategory().description}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 sm:p-6 lg:p-8">
                {/* Enhanced Compatibility Section */}
                <div className="mb-8">
                  {/* Compatibility Score and Comparison Section */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4 sm:p-6 mb-4 sm:mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
                      {/* Left side - Compatibility Score with detailed bar */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Shield className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">Compatibility Score</h3>
                            <p className="text-sm text-gray-600">Overall system compatibility rating</p>
                          </div>
                        </div>
                        
                        {/* Detailed Compatibility Score Display */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">System Compatibility</span>
                            <span className={`text-lg font-bold ${getCompatibilityScoreColor(compatibilityScore)}`}>
                              {compatibilityScore}%
                            </span>
                          </div>
                          
                          {/* Enhanced Progress Bar */}
                          <div className="relative">
                            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                              <div 
                                className={`h-4 rounded-full transition-all duration-1000 ease-out ${getCompatibilityScoreColor(compatibilityScore, true)}`}
                                style={{ width: `${compatibilityScore}%` }}
                              ></div>
                            </div>
                            {/* Progress indicators */}
                            <div className="flex justify-between mt-1 text-xs text-gray-500">
                              <span>0%</span>
                              <span>25%</span>
                              <span>50%</span>
                              <span>75%</span>
                              <span>100%</span>
                            </div>
                          </div>
                          
                          {/* Compatibility Status Message */}
                          <div className={`p-3 rounded-lg border-l-4 ${getCompatibilityStatusStyle(compatibilityScore)}`}>
                            <p className={`text-sm font-medium ${getCompatibilityStatusTextColor(compatibilityScore)}`}>
                              {getCompatibilityStatusMessage(compatibilityScore)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right side - Actions and Branch Selector */}
                      <div className="flex flex-col gap-4">
                        <button
                          onClick={() => setShowCompatibilityModal(true)}
                          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                        >
                          <Filter className="w-4 h-4" />
                          Compare Compatibility
                        </button>
                        {/* Exact test-case status messaging */}
                        <div className="text-sm text-gray-700 text-center">
                          {getBuildStatusMessage()}
                        </div>
                        
                        {/* Branch selector with better spacing */}
                        <div className="bg-white rounded-lg border border-gray-200 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-700">Branch Filter:</span>
                          </div>
                          <div className="inline-flex rounded-lg border overflow-hidden shadow-sm">
                            <button
                              className={`px-4 py-2 text-sm font-medium transition-colors ${branch === null ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                              onClick={() => setBranch(null)}
                              type="button"
                            >
                              All Branches
                            </button>
                            <button
                              className={`px-4 py-2 text-sm font-medium border-l transition-colors ${branch === 'BULACAN' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                              onClick={() => setBranch('BULACAN')}
                              type="button"
                            >
                              Bulacan
                            </button>
                            <button
                              className={`px-4 py-2 text-sm font-medium border-l transition-colors ${branch === 'MARIKINA' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                              onClick={() => setBranch('MARIKINA')}
                              type="button"
                            >
                              Marikina
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <EnhancedComponentSelector 
                  key={`ecs-${resetNonce}-${getCurrentCategory().key}`}
                  selectedComponents={selectedComponents}
                  onComponentSelect={handleComponentSelect}
                  onComponentRemove={handleComponentRemove}
                  activeCategory={getCurrentCategory().key}
                  prefetchedComponents={allComponents}
                  recommendations={recommendations[getCurrentCategory().key] || []}
                  loadingRecommendations={loadingRecommendations[getCurrentCategory().key] || false}
                  compatibilityIssues={getCompatibilitySuggestions(getCurrentCategory().key) || []}
                  branch={branch}
                />
              </div>
            </div>
          </div>

          {/* Enhanced Sidebar - Responsive width for better space utilization */}
          <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Compatibility Status */}
            <CompatibilityChecker 
              compatibilityStatus={compatibilityStatus}
              compatibilityScore={getLocalCompatibilityScore()}
              compatibilityDetails={compatibilityDetails}
              selectionProgress={getComponentSelectionProgress()}
            />

            {/* Enhanced Build Summary */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
              {/* Header Section */}
              <div className="mb-4 sm:mb-6 lg:mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-green-100 to-blue-100 rounded-xl">
                      <ShoppingCart className="w-7 h-7 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">Build Summary</h3>
                      <p className="text-gray-600">Track your PC build progress and components</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-600">
                      {Math.round((getSelectedRequiredComponentsCount() / getRequiredComponentsCount()) * 100)}%
                    </div>
                    <div className="text-sm text-gray-600">Complete</div>
                  </div>
                </div>
                
                {/* Enhanced Progress Section */}
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-2 sm:mb-3">
                    <span className="text-xs sm:text-sm font-semibold text-gray-700">Build Progress</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-900">
                      {getSelectedRequiredComponentsCount()}/{getRequiredComponentsCount()} Components
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-700 shadow-sm"
                      style={{ width: `${(getSelectedRequiredComponentsCount() / getRequiredComponentsCount()) * 100}%` }}
                    ></div>
                  </div>
                  
                  {/* Status Message */}
                  <div className={`p-3 rounded-lg border-l-4 ${
                    getSelectedRequiredComponentsCount() === 0 
                      ? 'bg-blue-50 border-blue-400' 
                      : getSelectedRequiredComponentsCount() === getRequiredComponentsCount()
                      ? 'bg-green-50 border-green-400'
                      : 'bg-yellow-50 border-yellow-400'
                  }`}>
                    <p className={`text-sm font-medium ${
                      getSelectedRequiredComponentsCount() === 0 
                        ? 'text-blue-800' 
                        : getSelectedRequiredComponentsCount() === getRequiredComponentsCount()
                        ? 'text-green-800'
                        : 'text-yellow-800'
                    }`}>
                      {getSelectedRequiredComponentsCount() === 0
                        ? "Start building by selecting components from the categories above"
                        : getSelectedRequiredComponentsCount() === getRequiredComponentsCount()
                        ? "Build complete! Ready for final review and ordering"
                        : `${getRequiredComponentsCount() - getSelectedRequiredComponentsCount()} more components needed to complete your build`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Enhanced Selected Components */}
              <div className="mb-6 sm:mb-8">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h4 className="text-base sm:text-lg font-semibold text-gray-900">Selected Components</h4>
                  <span className="text-xs sm:text-sm text-gray-500">{getSelectedComponentsCount()} items</span>
                </div>
                
                <div className="space-y-2 sm:space-y-3 max-h-64 sm:max-h-80 overflow-y-auto pr-1 sm:pr-2">
                  {Object.entries(selectedComponents).map(([category, component]) => (
                    component && (
                      <div key={category} className="group bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-all duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-1 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-100 to-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <span className="text-xs sm:text-sm font-bold text-green-600">
                                {category === 'motherboard' ? 'MB' : 
                                 category === 'gpu' ? 'GPU' : 
                                 category === 'storage' ? 'SSD' : 
                                 category === 'psu' ? 'PSU' : 
                                 category === 'cooler' ? 'FAN' : 
                                 category.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="font-semibold text-gray-900 text-xs sm:text-sm mb-1 truncate">{component.name}</h5>
                              <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-600">
                                  <span className="font-bold text-green-600 text-xs sm:text-sm">{formatCurrencyPHP(component.price)}</span>
                                <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                <span className="truncate">
                                  {component.socket && `Socket: ${component.socket}`}
                                  {component.memory && `Memory: ${component.memory}`}
                                  {component.type && component.speed && `${component.type} ${component.speed}`}
                                  {component.capacity && `Capacity: ${component.capacity}`}
                                  {component.wattage && `${component.wattage}W`}
                                  {component.size && `Size: ${component.size}`}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <button
                              onClick={() => handleComponentRemove(category)}
                              className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all duration-200 opacity-0 group-hover:opacity-100"
                              title="Remove component"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                  
                  {getSelectedComponentsCount() === 0 && (
                    <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border-2 border-dashed border-gray-300">
                      <div className="p-4 bg-white rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                        <Package className="w-10 h-10 text-gray-400" />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">No Components Selected</h4>
                      <p className="text-gray-600 mb-4">Start building by selecting components from the categories above</p>
                      <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                        <ArrowRight className="w-4 h-4" />
                        <span>Choose your first component to begin</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Price Summary */}
              <div className="bg-gradient-to-r from-gray-50 to-green-50 rounded-xl p-4 sm:p-6 border border-gray-200">
                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <span className="text-green-600 text-lg font-bold">₱</span>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900">Price Summary</h4>
                </div>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-gray-600 font-medium">Subtotal:</span>
                    <span className="text-lg font-semibold text-gray-900">{formatCurrencyPHP(getTotalPrice())}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-green-600 font-bold">₱</span>
                      </div>
                      <span className="text-lg font-semibold text-gray-900">Total Price:</span>
                    </div>
                    <span className="text-3xl font-bold text-green-600">
                      {formatCurrencyPHP(getTotalPrice())}
                    </span>
                  </div>
                </div>

                {/* Enhanced Action Buttons */}
                <div className="space-y-4">
                  {/* Primary Actions */}
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => setShowSaveModal(true)}
                      className={`flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200 ${
                        user 
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 transform hover:scale-105' 
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      disabled={!user}
                      title={!user ? 'Please log in to save builds' : ''}
                    >
                      <Save className="w-5 h-5" />
                      {isEditing ? (saveToPrebuilts ? 'Update Prebuilt' : 'Update Build') : (saveToPrebuilts ? 'Save Prebuilt' : 'Save Build')}
                      {!user && <span className="text-sm ml-2 opacity-75">(Login Required)</span>}
                    </button>
                    
                    {!hideCompleteButton && (
                    <button
                      onClick={handleCompleteBuild}
                      className={`flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200 ${
                        getSelectedRequiredComponentsCount() === getRequiredComponentsCount()
                          ? getLocalCompatibilityScore() === 100
                            ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg hover:shadow-xl hover:from-green-700 hover:to-green-800 transform hover:scale-105'
                            : 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-red-600'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      disabled={getSelectedRequiredComponentsCount() < getRequiredComponentsCount()}
                    >
                      {placingOrder ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Placing order...</span>
                        </div>
                      ) : (
                        getSelectedRequiredComponentsCount() === getRequiredComponentsCount() 
                          ? getLocalCompatibilityScore() === 100
                            ? (
                              <div className="flex items-center justify-center gap-3">
                                <ShoppingCart className="w-5 h-5" />
                                <span>Buy PC Build!</span>
                              </div>
                            )
                            : (
                              <div className="flex items-center justify-center gap-3">
                                <AlertTriangle className="w-5 h-5" />
                                <span>Buy PC Build</span>
                              </div>
                            )
                          : `Select ${getRequiredComponentsCount() - getSelectedRequiredComponentsCount()} more components`
                      )}
                    </button>
                    )}
                    
                    {/* Add to Cart Button */}
                    {!hideCompleteButton && (
                    <button
                      onClick={handleAddToCart}
                      className={`flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200 ${
                        getSelectedRequiredComponentsCount() === getRequiredComponentsCount()
                          ? user
                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 transform hover:scale-105'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      disabled={getSelectedRequiredComponentsCount() < getRequiredComponentsCount() || !user || addingToCart}
                      title={!user ? 'Please log in to add items to cart' : ''}
                    >
                      {addingToCart ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Adding to cart...</span>
                        </div>
                      ) : (
                        getSelectedRequiredComponentsCount() === getRequiredComponentsCount() 
                          ? (
                            <div className="flex items-center justify-center gap-3">
                              <Package className="w-5 h-5" />
                              <span>Add to Cart</span>
                            </div>
                          )
                          : `Select ${getRequiredComponentsCount() - getSelectedRequiredComponentsCount()} more components`
                      )}
                    </button>
                    )}
                  </div>
                  
                  {/* Secondary Actions */}
                  <div className="pt-2 border-t border-gray-200">
                    <button
                      onClick={handleClearAllComponents}
                      className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-semibold text-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300 transition-all duration-200"
                    >
                      <Trash2 className="w-5 h-5" />
                      Clear All Components
                    </button>
                  </div>
                </div>
                
                {getSelectedRequiredComponentsCount() === getRequiredComponentsCount() && (
                  <div className="text-center text-sm mt-4 p-3 rounded-lg">
                    {getLocalCompatibilityScore() === 100 ? (
                      <div className="text-green-600 bg-green-50">
                        <p className="font-medium">Ready to proceed with your build!</p>
                        {!selectedComponents.cooler && (
                          <p className="text-yellow-600 mt-1 text-xs">
                            Consider adding an aftermarket cooler for better performance
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-orange-600 bg-orange-50">
                        <p className="font-medium">Build ready with compatibility warnings</p>
                        <p className="text-xs mt-1">
                          Your build can be completed, but consider reviewing the warnings above for optimal performance
                        </p>
                        {!selectedComponents.cooler && (
                          <p className="text-yellow-600 mt-1 text-xs">
                            Consider adding an aftermarket cooler for better performance
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Build Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center">
                    <Save className="w-6 h-6 text-white" />
                </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                  {isEditing ? 'Update Your Build' : 'Save Your Build'}
                </h2>
                    <p className="text-sm text-gray-600">Save your PC configuration for future reference</p>
                  </div>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                  <X className="w-6 h-6" />
              </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Build Details */}
                <div className="space-y-6">
                  {/* Build Name */}
                  <div>
                    <label htmlFor="build-name" className="block text-sm font-semibold text-gray-700 mb-2">
                  Build Name *
                </label>
                <input
                  id="build-name"
                  type="text"
                  value={buildName}
                  onChange={(e) => setBuildName(e.target.value)}
                  placeholder="e.g., Gaming Beast Pro, Workstation Build"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors ${
                        buildName.trim() === '' ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                      }`}
                  maxLength={50}
                />
                    <p className={`text-xs mt-2 ${buildName.trim() === '' ? 'text-red-500' : 'text-gray-500'}`}>
                      {buildName.length}/50 characters {buildName.trim() === '' && '(Required)'}
                </p>
              </div>

                  {/* Build Description */}
                  <div>
                    <label htmlFor="build-description" className="block text-sm font-semibold text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  id="build-description"
                  value={buildDescription}
                  onChange={(e) => setBuildDescription(e.target.value)}
                  placeholder="Describe your build, intended use, or any special features..."
                      rows="4"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none transition-colors"
                  maxLength={200}
                />
                    <p className="text-xs text-gray-500 mt-2">
                  {buildDescription.length}/200 characters
                </p>
              </div>

                  {/* Build Visibility Section - hidden for prebuilts flow */}
                  <div className="bg-gray-50 rounded-xl p-4" style={{display: saveToPrebuilts ? 'none' : undefined}}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Build Visibility</h3>
                        <p className="text-xs text-gray-600 mt-1">
                          Your build will be visible to other users in the PC Build Sharing section. You can change this later.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${isPublic ? 'text-green-600' : 'text-gray-500'}`}>
                      {isPublic ? 'Public' : 'Private'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsPublic(!isPublic)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
                            isPublic ? 'bg-green-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                          isPublic ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

              </div>

              {/* Close Left Column */}
              </div>

                {/* Right Column - Build Summary */}
                <div className="space-y-6">
                  {/* Build Summary Card */}
                  <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-green-600" />
                      Build Summary
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Package className="w-4 h-4 text-blue-600" />
                  </div>
                          <span className="text-sm font-medium text-gray-700">Components</span>
                  </div>
                        <span className="text-lg font-bold text-blue-600">
                          {getSelectedRequiredComponentsCount()}/{getRequiredComponentsCount()}
                        </span>
                  </div>
                      
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                          <span className="text-sm font-medium text-gray-700">Compatibility</span>
                        </div>
                        <span className="text-lg font-bold text-green-600">
                          {getLocalCompatibilityScore()}%
                        </span>
              </div>

                                             <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                             <span className="text-lg font-bold text-purple-600">₱</span>
                           </div>
                           <span className="text-sm font-medium text-gray-700">Total Price</span>
                         </div>
                         <span className="text-lg font-bold text-purple-600">
                           {getTotalPrice().toLocaleString()}
                         </span>
                       </div>
                    </div>
                  </div>

                  {/* Compatibility Status */}
                  {getLocalCompatibilityScore() < 100 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                        <span className="text-sm font-semibold text-yellow-800">Compatibility Notice</span>
                      </div>
                      <p className="text-xs text-yellow-700">
                        Your build has some compatibility warnings. Consider reviewing the compatibility checker for optimal performance.
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-3">
                <button
                  onClick={handleSaveBuild}
                      disabled={!buildName.trim() || hasCriticalCompatibilityIssues || savingBuild}
                      className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-white text-lg transition-all duration-200 shadow-lg ${
                        !buildName.trim() || hasCriticalCompatibilityIssues
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 hover:shadow-xl transform hover:scale-[1.02]'
                      }`}
                      title={!buildName.trim() ? 'Please enter a build name' : hasCriticalCompatibilityIssues ? 'Cannot save build due to compatibility issues' : 'Save your build'}
                >
                  {savingBuild ? (
                    <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                          <span>{isEditing ? 'Update Build' : 'Save Build'}</span>
                    </>
                  )}
                </button>
                    
                    <button
                      onClick={() => setShowSaveModal(false)}
                      className="w-full px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Review Confirmation Modal */}
      {showOrderConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Review Your Build</h2>
                    <p className="text-sm text-gray-600">Please review your components before placing the order</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowOrderConfirmation(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Components List */}
            <div className="p-6">
              <div className="space-y-4">
                {componentCategories
                  .filter(cat => {
                    const component = selectedComponents[cat.key];
                    return component !== null && component !== undefined;
                  })
                  .map((category) => {
                    const component = selectedComponents[category.key];
                    if (!component) return null;

                    const categoryName = category.name;
                    const Icon = category.icon;
                    const price = typeof component.price === 'string' ? parseFloat(component.price) : (component.price || 0);

                    return (
                      <div
                        key={category.key}
                        className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          {/* Component Image */}
                          <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <img
                              src={getComponentImage(component, getComponentType(component))}
                              alt={component.name || 'Component'}
                              className="w-full h-full object-cover rounded-lg"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) {
                                  e.target.nextSibling.style.display = 'flex';
                                }
                              }}
                            />
                            <div className="hidden w-full h-full items-center justify-center text-gray-400">
                              <Icon className="w-10 h-10" />
                            </div>
                          </div>

                          {/* Component Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Icon className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm font-medium text-gray-500 uppercase">{categoryName}</span>
                                </div>
                                <h3 className="font-semibold text-gray-900 text-lg mb-1">{component.name}</h3>
                                {component.brand && (
                                  <p className="text-sm text-gray-600 mb-2">{component.brand}</p>
                                )}
                                <div className="flex items-center">
                                  <span className="text-xl font-bold text-green-600">{formatCurrencyPHP(price)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Price Breakdown */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Breakdown</h3>
                <div className="space-y-3 mb-4">
                  {componentCategories
                    .filter(cat => {
                      const component = selectedComponents[cat.key];
                      return component !== null && component !== undefined;
                    })
                    .map((category) => {
                      const component = selectedComponents[category.key];
                      if (!component) return null;

                      const price = typeof component.price === 'string' ? parseFloat(component.price) : (component.price || 0);
                      
                      return (
                        <div
                          key={category.key}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900">{component.name}</span>
                            <span className="text-xs text-gray-500 ml-2">({category.name})</span>
                          </div>
                          <span className="text-base font-semibold text-gray-900 ml-4 flex-shrink-0">
                            {formatCurrencyPHP(price)}
                          </span>
                        </div>
                      );
                    })}
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-gray-600 font-medium">Subtotal:</span>
                    <span className="text-lg font-semibold text-gray-900">{formatCurrencyPHP(getTotalPrice())}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-green-600 font-bold">₱</span>
                      </div>
                      <span className="text-lg font-semibold text-gray-900">Total Price:</span>
                    </div>
                    <span className="text-3xl font-bold text-green-600">
                      {formatCurrencyPHP(getTotalPrice())}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-b-xl">
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowOrderConfirmation(false)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  disabled={placingOrder}
                >
                  Cancel
                </button>
                <button
                  onClick={placeOrder}
                  disabled={placingOrder}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                >
                  {placingOrder ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Placing Order...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      <span>Confirm Purchase</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Confirmation Modal */}
      {orderConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Order Placed Successfully</h2>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-700">Your PC build has been recorded as a sales order.</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Order ID:</span>
                <span className="font-semibold text-gray-900">#{orderConfirmation.order_id}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Order Total:</span>
                <span className="font-semibold text-green-700">₱{Number(orderConfirmation.total || 0).toLocaleString()}</span>
              </div>
            </div>
            <div className="p-6 pt-0 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setOrderConfirmation(null);
                  // Optional: clear the current selection after successful order
                  try { handleClearAllComponents(); } catch {}
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Prompt Modal */}
      {showAuthPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-orange-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Login Required
                </h2>
              </div>
              <button
                onClick={() => setShowAuthPrompt(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Save Your Build
                </h3>
                <p className="text-gray-600">
                  You need to be logged in to save your PC build configuration. 
                  This will allow you to access your builds later and share them with others.
                </p>
              </div>

              {/* Build Preview */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Your Build Preview</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Components:</span>
                    <span className="font-medium">{getSelectedRequiredComponentsCount()}/{getRequiredComponentsCount()} selected</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Compatibility:</span>
                    <span className="font-medium text-green-600">{getLocalCompatibilityScore()}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Price:</span>
                    <span className="font-medium text-green-600">₱{getTotalPrice().toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowAuthPrompt(false);
                    onShowAuth('login');
                  }}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <LogIn className="w-5 h-5" />
                  Login to Save Build
                </button>
                <button
                  onClick={() => {
                    setShowAuthPrompt(false);
                    onShowAuth('register');
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <User className="w-5 h-5" />
                  Create Account
                </button>
                <button
                  onClick={() => setShowAuthPrompt(false)}
                  className="w-full px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Continue building without saving
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compatibility Comparison Modal */}
      <CompatibilityComparisonModal
        isOpen={showCompatibilityModal}
        onClose={() => setShowCompatibilityModal(false)}
        selectedComponents={selectedComponents}
        currentCategory={getCurrentCategory().key}
        allComponents={allComponents}
        onComponentSelect={handleComponentSelect}
      />
    </div>
  )
}

export default PCAssembly;