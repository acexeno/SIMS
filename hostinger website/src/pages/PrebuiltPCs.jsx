import React, { useState, useEffect } from 'react';
import { API_BASE, getApiEndpoint } from '../utils/apiBase';
import { 
  Eye, 
  ShoppingCart, 
  Zap, 
  Monitor, 
  Settings, 
  ArrowRight,
  Filter,
  Search,
  Package,
  Cpu,
  MemoryStick,
  HardDrive,
  Server,
  Thermometer,
  Users,
  Share2,
  Download,
  Calendar,
  CheckCircle,
  AlertCircle,
  User,
  Copy,
  MessageCircle,
  Tag,
  Coins,
  CheckSquare,
  Clock,
  XCircle,
  X,
} from 'lucide-react';
import { formatCurrencyPHP } from '../utils/currency';
import { getCompatibilityScore as calcCompatibility } from '../utils/compatibilityService';
import CommentsSection from '../components/CommentsSection';
// import Prebuilts from '../data/Prebuilts' // Remove static import

const API_URL = `${API_BASE}/prebuilts.php`;

// Canonical key mapping for component categories (module scope)
const KEY_MAP = {
  cpu: ['cpu', 'processor', 'procie', 'procie only', 'processor only'],
  motherboard: ['motherboard', 'mobo'],
  gpu: ['gpu', 'graphics', 'graphics card', 'video', 'video card', 'vga'],
  ram: ['ram', 'memory', 'ram 3200mhz', 'ddr', 'ddr4', 'ddr5'],
  storage: ['storage', 'ssd', 'nvme', 'ssd nvme', 'hdd', 'hard drive', 'drive'],
  psu: ['psu', 'power supply', 'psu - tr', 'tr psu'],
  case: ['case', 'chassis', 'case gaming'],
  cooler: ['cooler', 'coolers', 'aio', 'cooling', 'cpu cooler', 'water cooling', 'liquid cooler', 'fan', 'heatsink']
};

// Helper to fetch full component objects by IDs
async function fetchComponentsByIds(componentIds) {
  if (!componentIds || typeof componentIds !== 'object') return {};
  // Accept numeric strings and numbers
  const ids = Object.values(componentIds)
    .map(v => typeof v === 'string' ? parseInt(v, 10) : v)
    .filter(v => Number.isFinite(v) && v > 0);
  if (ids.length === 0) return {};
  const url = `${API_BASE}/get_components_by_ids.php?ids=${ids.join(',')}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.success && data.data) {
    const componentsByCategory = {};
    data.data.forEach(component => {
      const category = Object.keys(componentIds).find(cat => componentIds[cat] == component.id);
      if (category) {
        componentsByCategory[category] = component;
      }
    });
    return componentsByCategory;
  }
  return {};
}

// Fetch cheapest component for a given canonical category key (module scope)
async function fetchCheapestForCategory(canonKey, constraints = {}) {
  const map = {
    cpu: 'CPU',
    motherboard: 'Motherboard',
    gpu: 'GPU',
    ram: 'RAM',
    storage: 'Storage',
    psu: 'PSU',
    case: 'Case',
    cooler: 'Cooler'
  };
  const category = map[canonKey];
  if (!category) return null;
  try {
    // Request only in-stock components to avoid suggesting unavailable parts
    const url = getApiEndpoint('components', { category, only_in_stock: '1' });
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data) || data.data.length === 0) return null;
    const items = data.data.slice();
    items.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    return items[0] || null;
  } catch (e) {
    return null;
  }
}

const PrebuiltPCs = ({ setCurrentPage, setSelectedComponents, onPrebuiltSelect, user }) => {
  const [prebuilts, setPrebuilts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prebuiltFilterPrice, setPrebuiltFilterPrice] = useState('all');
  
  // Community builds state
  const [publicBuilds, setPublicBuilds] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [selectedBuild, setSelectedBuild] = useState(null);
  const [communitySearchTerm, setCommunitySearchTerm] = useState('');
  const [communitySortBy, setCommunitySortBy] = useState('newest');
  const [communityFilterPrice, setCommunityFilterPrice] = useState('all');
  const [activeTab, setActiveTab] = useState('prebuilts'); // 'prebuilts', 'community', or 'management' (for admins)
  
  // Community management state (for admins/employees)
  const [communitySubmissions, setCommunitySubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [submissionStats, setSubmissionStats] = useState({});
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewingSubmission, setReviewingSubmission] = useState(false);
  

  // Recalculate price from component_ids by fetching current component prices
  const recalculatePrice = async (pc) => {
    try {
      const componentIds = pc.component_ids || pc.componentIds || {};
      if (!componentIds || typeof componentIds !== 'object' || Object.keys(componentIds).length === 0) {
        return pc.price || 0;
      }
      
      const ids = Object.values(componentIds)
        .map(v => typeof v === 'string' ? parseInt(v, 10) : v)
        .filter(v => Number.isFinite(v) && v > 0);
      
      if (ids.length === 0) {
        return pc.price || 0;
      }
      
      const url = `${API_BASE}/get_components_by_ids.php?ids=${ids.join(',')}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        const total = data.data.reduce((sum, component) => {
          const price = typeof component.price === 'number' ? component.price : parseFloat(component.price) || 0;
          return sum + price;
        }, 0);
        return total > 0 ? total : pc.price || 0;
      }
    } catch (error) {
      console.error('Error recalculating price:', error);
    }
    return pc.price || 0;
  };

  // Check if prebuilt is available based on component stock
  const checkPrebuiltAvailability = async (pc) => {
    try {
      const componentIds = pc.component_ids || pc.componentIds || {};
      if (!componentIds || typeof componentIds !== 'object' || Object.keys(componentIds).length === 0) {
        return { available: false, reason: 'No components', outOfStockComponents: [] };
      }
      
      const ids = Object.values(componentIds)
        .map(v => typeof v === 'string' ? parseInt(v, 10) : v)
        .filter(v => Number.isFinite(v) && v > 0);
      
      if (ids.length === 0) {
        return { available: false, reason: 'Invalid component IDs', outOfStockComponents: [] };
      }
      
      const url = `${API_BASE}/get_components_by_ids.php?ids=${ids.join(',')}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        const outOfStockComponents = [];
        let allAvailable = true;
        
        // Check each component's stock
        data.data.forEach(component => {
          const stock = component.stock_quantity || component.stock || 0;
          if (stock <= 0) {
            allAvailable = false;
            outOfStockComponents.push({
              id: component.id,
              name: component.name,
              stock: stock
            });
          }
        });
        
        return {
          available: allAvailable,
          reason: outOfStockComponents.length > 0 
            ? `${outOfStockComponents.length} component(s) out of stock` 
            : 'All components available',
          outOfStockComponents: outOfStockComponents
        };
      }
    } catch (error) {
      console.error('Error checking prebuilt availability:', error);
      return { available: false, reason: 'Error checking availability', outOfStockComponents: [] };
    }
    return { available: true, reason: 'Could not verify', outOfStockComponents: [] };
  };

  useEffect(() => {
    const fetchPrebuilts = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          // Recalculate prices and check availability for all prebuilts
          const prebuiltsWithData = await Promise.all(
            data.map(async (pc) => {
              const recalculatedPrice = await recalculatePrice(pc);
              const availability = await checkPrebuiltAvailability(pc);
              return { 
                ...pc, 
                price: recalculatedPrice,
                stockAvailable: availability.available,
                stockReason: availability.reason,
                outOfStockComponents: availability.outOfStockComponents
              };
            })
          );
          setPrebuilts(prebuiltsWithData);
        } else {
          setPrebuilts([]);
        }
      } catch (e) {
        setError('Failed to fetch prebuilts.');
        setPrebuilts([]);
      }
      setLoading(false);
    };
    fetchPrebuilts();
  }, []);

  // Fetch community builds
  useEffect(() => {
    const fetchPublicBuilds = async () => {
      setCommunityLoading(true);
      try {
        const response = await fetch(`${API_BASE}/index.php?endpoint=builds&public=1`);
        const result = await response.json();
        if (result.success) {
          setPublicBuilds(result.data);
        } else {
          setPublicBuilds([]);
        }
      } catch (error) {
        console.error('Error fetching public builds:', error);
        setPublicBuilds([]);
      } finally {
        setCommunityLoading(false);
      }
    };
    fetchPublicBuilds();
  }, []);


  // Fetch admin data when component loads
  useEffect(() => {
    if (isAdminUser()) {
      fetchCommunitySubmissions();
      fetchSubmissionStats();
    }
  }, [user]);

  // Helpers for brand badge and quick spec extraction from description/name
  const getBrandBadge = (pc) => {
    const brand = getBrand(pc);
    if (brand === 'amd') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
          AMD
        </span>
      );
    }
    if (brand === 'intel') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
          Intel
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
        Mixed
      </span>
    );
  };

  const extractQuickSpecs = (pc) => {
    const text = `${pc.name || ''} ${pc.description || ''}`;
    const cpuMatch = text.match(/(R[3579] \d{3,4}X?|Ryzen\s?\d|i[3579]-?\d{3,5}|Intel\s?Core\s?i[3579]-?\d{3,5})/i);
    const gpuMatch = text.match(/(RTX\s?\d{3,4}|GTX\s?\d{3,4}|RX\s?\d{3,4}|Arc\s?\w+|IGPU)/i);
    const ramMatch = text.match(/(\d{2,3})\s?GB\s?(DDR\d)?/i);
    const storageMatch = text.match(/(\d(?:\.\d)?\s?TB|\d{3,4}\s?GB)\s?(NVME|SSD|HDD)?/i);
    return {
      cpu: cpuMatch ? cpuMatch[0] : null,
      gpu: gpuMatch ? gpuMatch[0] : null,
      ram: ramMatch ? `${ramMatch[1]}GB` : null,
      storage: storageMatch ? storageMatch[0].replace(/\s+/g, ' ') : null,
    };
  };

  // Helper to determine brand from CPU name
  const getBrand = (pc) => {
    // Prefer explicit brand if provided
    if (pc.brand) {
      const b = String(pc.brand).toLowerCase();
      if (b.includes('amd')) return 'amd';
      if (b.includes('intel')) return 'intel';
    }
    // Many prebuilts don't carry detailed specs; infer from name/description
    const haystack = `${pc.name || ''} ${pc.description || ''}`.toLowerCase();
    if (haystack.includes('amd') || haystack.includes('ryzen')) return 'amd';
    if (haystack.includes('intel') || haystack.includes('core i')) return 'intel';
    return 'other';
  };

  const categories = [
    { id: 'all', name: 'All PCs', count: prebuilts.length },
    ...Array.from(new Set(prebuilts.map(pc => pc.category))).filter(Boolean).map(cat => ({
      id: cat,
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      count: prebuilts.filter(pc => pc.category === cat).length
    }))
  ];

  const brands = [
    { id: 'all', name: 'All Brands', count: prebuilts.length },
    { id: 'amd', name: 'AMD Builds', count: prebuilts.filter(pc => getBrand(pc) === 'amd').length },
    { id: 'intel', name: 'Intel Builds', count: prebuilts.filter(pc => getBrand(pc) === 'intel').length }
  ];

  const filteredPCs = prebuilts
    .filter(pc => selectedCategory === 'all' || pc.category === selectedCategory)
    .filter(pc => selectedBrand === 'all' || getBrand(pc) === selectedBrand)
    .filter(pc => pc.name && pc.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.price - b.price
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    });

  const handleCardClick = async (pc) => {
    try {
      // Check if prebuilt is available (if stock info is already loaded)
      if (pc.stockAvailable === false) {
        const outOfStockList = pc.outOfStockComponents && pc.outOfStockComponents.length > 0
          ? pc.outOfStockComponents.map(c => `- ${c.name}`).join('\n')
          : '';
        const message = `This prebuilt is currently unavailable due to out-of-stock components.\n\n${pc.stockReason || 'Some components are out of stock.'}${outOfStockList ? `\n\nOut of stock components:\n${outOfStockList}` : ''}\n\nYou can still view the build, but you won't be able to place an order until all components are back in stock.`;
        if (!confirm(message + '\n\nDo you want to view the build anyway?')) {
          return;
        }
      }
      
      // Parse component_ids from JSON string if it's a string
      let componentIds = {};
      if (pc.component_ids) {
        if (typeof pc.component_ids === 'string') {
          try {
            componentIds = JSON.parse(pc.component_ids);
          } catch (e) {
            alert('This prebuilt has invalid component data and cannot be loaded. Please contact support or try another prebuilt.');
            return;
          }
        } else {
          componentIds = pc.component_ids;
        }
      } else if (pc.componentIds) {
        componentIds = pc.componentIds;
      }
      // Defensive: must have at least one component
      if (!componentIds || Object.keys(componentIds).length === 0) {
        alert('This prebuilt has no components and cannot be loaded.');
        return;
      }
      const componentsForEdit = await fetchComponentsByIds(componentIds);
      if (!componentsForEdit || Object.keys(componentsForEdit).length === 0) {
        alert('The components for this prebuilt could not be found.');
        return;
      }
      // Canonicalize category keys to match Assembly expectations
      const canon = {};
      const lowerKeys = Object.keys(componentsForEdit).reduce((acc, k) => { acc[k.toLowerCase()] = componentsForEdit[k]; return acc; }, {});
      Object.entries(KEY_MAP).forEach(([canonKey, aliases]) => {
        for (const a of aliases) {
          if (lowerKeys[a]) { canon[canonKey] = lowerKeys[a]; break; }
        }
      });
      // Keep any already canonical keys
      Object.keys(componentsForEdit).forEach((k) => {
        if (KEY_MAP[k]) canon[k] = componentsForEdit[k];
      });

      // If original prebuilt indicated cooler but it's missing, auto-fill a basic cooler
      const originalKeySet = Object.keys(componentIds || {}).map(k => String(k).toLowerCase());
      const intendedCooler = (KEY_MAP.cooler || []).some(alias => originalKeySet.includes(alias));
      if (intendedCooler && !canon.cooler) {
        const fallbackCooler = await fetchCheapestForCategory('cooler');
        if (fallbackCooler) canon.cooler = fallbackCooler;
      }

      // Ensure required categories exist; backfill with cheapest sensible options
      const required = ['cpu','motherboard','gpu','ram','storage','psu','case'];
      const missing = required.filter(k => !canon[k]);
      if (missing.length > 0) {
        const results = await Promise.all(missing.map(k => fetchCheapestForCategory(k)));
        results.forEach((comp, idx) => { if (comp) canon[missing[idx]] = comp; });
      }

      // Persist to localStorage for consistency with other flows
      try {
        localStorage.setItem('builditpc-selected-components', JSON.stringify(canon));
        localStorage.setItem('builditpc-editing-build', JSON.stringify({
          name: (pc.name || 'Prebuilt') + ' (Prebuilt)',
          description: pc.description || ''
        }));
      } catch (e) {
        // Non-fatal if storage fails
      }
      if (onPrebuiltSelect) {
        onPrebuiltSelect(canon);
      } else {
        if (setSelectedComponents) {
          setSelectedComponents(canon);
        }
        setCurrentPage('pc-assembly');
      }
    } catch (error) {
      console.error('Error loading prebuilt components:', error);
      alert('Error loading prebuilt components. Please try again.');
    }
  }

  const handleBuyNowClick = (e, pc) => {
    // Prevent the card click event from firing
    e.stopPropagation();
    // Handle buy now logic here
    // Buy Now clicked for prebuilt PC
    // You can add your purchase logic here
  }

  // Add prebuilt to cart
  const handleAddPrebuiltToCart = async (e, pc) => {
    e.stopPropagation(); // Prevent card click
    
    const token = localStorage.getItem('token');
    if (!token || !user) {
      alert('Please log in to add items to cart');
      if (onShowAuth) {
        onShowAuth();
      }
      return;
    }

    // Check if prebuilt is available
    if (pc.stockAvailable === false || !(pc.in_stock || pc.inStock)) {
      alert('This prebuilt is currently out of stock and cannot be added to cart.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/index.php?endpoint=cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prebuilt_id: pc.id,
          quantity: 1
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        alert('Prebuilt PC added to cart successfully!');
        // Refresh cart count if callback exists
        if (typeof setCurrentPage === 'function') {
          // Optional: navigate to cart page
          // setCurrentPage('cart');
        }
      } else {
        alert(result.error || 'Failed to add prebuilt to cart');
      }
    } catch (error) {
      console.error('Add prebuilt to cart failed:', error);
      alert(`Failed to add prebuilt to cart: ${error.message}`);
    }
  }

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'gaming': return <Zap className="w-5 h-5" />
      case 'workstation': return <Settings className="w-5 h-5" />
      case 'cooling': return <Thermometer className="w-5 h-5" />
      default: return <Package className="w-5 h-5" />
    }
  }

  // Community builds helper functions
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCompatibilityStatus = (compatibility) => {
    if (compatibility >= 90) {
      return { status: 'Excellent', color: 'text-green-600', bgColor: 'bg-green-100', icon: <CheckCircle className="w-4 h-4" /> };
    } else if (compatibility >= 70) {
      return { status: 'Good', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: <AlertCircle className="w-4 h-4" /> };
    } else {
      return { status: 'Issues', color: 'text-red-600', bgColor: 'bg-red-100', icon: <AlertCircle className="w-4 h-4" /> };
    }
  };

  const safePrice = (price) => {
    const num = Number(price);
    return isNaN(num) ? 0 : num;
  };

  const handleUseBuild = async (build) => {
    let componentsTemp = {};
    if (Array.isArray(build.components)) {
      build.components.forEach(component => {
        if (component && component.category) {
          componentsTemp[component.category.toLowerCase()] = component;
        }
      });
    } else if (build.components && typeof build.components === 'object') {
      const keys = Object.keys(build.components);
      if (keys.every(key => !isNaN(Number(key)))) {
        Object.values(build.components).forEach(component => {
          if (component && component.category) {
            componentsTemp[component.category.toLowerCase()] = component;
          }
        });
      } else {
        componentsTemp = { ...build.components };
      }
    }

    // Canonicalize keys (e.g., 'cooling' -> 'cooler') and retain canonical keys
    const canon = {};
    const lowerKeys = Object.keys(componentsTemp).reduce((acc, k) => { acc[k.toLowerCase()] = componentsTemp[k]; return acc; }, {});
    Object.entries(KEY_MAP).forEach(([canonKey, aliases]) => {
      for (const a of aliases) {
        if (lowerKeys[a]) { canon[canonKey] = lowerKeys[a]; break; }
      }
    });
    Object.keys(componentsTemp).forEach((k) => {
      if (KEY_MAP[k]) canon[k] = componentsTemp[k];
    });

    // Auto-complete any missing required categories with a sensible cheapest option
    const required = ['cpu','motherboard','gpu','ram','storage','psu','case'];
    const missing = required.filter(k => !canon[k]);
    if (missing.length > 0) {
      const results = await Promise.all(missing.map(k => fetchCheapestForCategory(k)));
      results.forEach((comp, idx) => { if (comp) canon[missing[idx]] = comp; });
    }

    // If the community build included a cooling component by intent but it's missing (stale ID), auto-fill one
    let intendedCooler = false;
    if (Array.isArray(build.components)) {
      intendedCooler = build.components.some(c => {
        const cat = (c?.category || '').toLowerCase();
        return (KEY_MAP.cooler || []).some(alias => cat.includes(alias));
      });
    } else if (build.components && typeof build.components === 'object') {
      const lowerKeys2 = Object.keys(build.components).map(k => k.toLowerCase());
      intendedCooler = (KEY_MAP.cooler || []).some(alias => lowerKeys2.includes(alias));
    }
    if (intendedCooler && !canon.cooler) {
      const fallbackCooler = await fetchCheapestForCategory('cooler');
      if (fallbackCooler) canon.cooler = fallbackCooler;
    }

    // Persist selections
    try {
      localStorage.setItem('builditpc-selected-components', JSON.stringify(canon));
      localStorage.setItem('builditpc-editing-build', JSON.stringify({
        name: build.name + ' (Copy)',
        description: build.description + ' - Shared by ' + build.creator_name
      }));
    } catch {}

    if (typeof setSelectedComponents === 'function') {
      setSelectedComponents(canon);
    }

    setCurrentPage('pc-assembly');
  };

  const handleCopyBuildLink = (buildId) => {
    const buildUrl = `${window.location.origin}/prebuilt-pcs?build=${buildId}`;
    navigator.clipboard.writeText(buildUrl).then(() => {
      alert('Build link copied to clipboard!');
    });
  };

  // Helper function to check if user has admin privileges
  const isAdminUser = () => {
    if (!user || !user.roles) return false;
    const roles = Array.isArray(user.roles) ? user.roles : user.roles.split(',').map(r => r.trim());
    // Allow Admin, Super Admin, and Employee (matches backend permissions)
    return roles.some(role => ['Admin', 'Super Admin', 'Employee'].includes(role));
  };

  // Fetch community submissions (for admins)
  const fetchCommunitySubmissions = async () => {
    if (!isAdminUser()) return;
    
    setSubmissionsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/index.php?endpoint=community_management&action=submissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setCommunitySubmissions(result.data);
      }
    } catch (error) {
      console.error('Error fetching community submissions:', error);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  // Fetch submission statistics (for admins)
  const fetchSubmissionStats = async () => {
    if (!isAdminUser()) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/index.php?endpoint=community_management&action=stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        const stats = {};
        result.data.forEach(item => {
          stats[item.status] = item.count;
        });
        setSubmissionStats(stats);
      }
    } catch (error) {
      console.error('Error fetching submission stats:', error);
    }
  };

  // Handle submission review (for admins)
  const handleSubmissionReview = async (submissionId, status) => {
    setReviewingSubmission(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/index.php?endpoint=community_management&action=review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          submission_id: submissionId,
          status: status,
          admin_notes: reviewNotes
        })
      });
      
      const result = await response.json();
      if (result.success) {
        alert(`Submission ${status} successfully!`);
        setSelectedSubmission(null);
        setReviewNotes('');
        fetchCommunitySubmissions();
        fetchSubmissionStats();
      } else {
        alert('Error reviewing submission: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error reviewing submission:', error);
      alert('Error reviewing submission. Please try again.');
    } finally {
      setReviewingSubmission(false);
    }
  };

  // Handle submission deletion (for admins)
  const handleSubmissionDelete = async (submissionId, submissionName) => {
    if (!confirm(`Are you sure you want to delete the submission "${submissionName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/index.php?endpoint=community_management&action=delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          submission_id: submissionId
        })
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Submission deleted successfully!');
        fetchCommunitySubmissions();
        fetchSubmissionStats();
      } else {
        alert('Error deleting submission: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting submission:', error);
      alert('Error deleting submission. Please try again.');
    }
  };

  // Persist recalculated community compatibility score (fire-and-forget)
  const persistCommunityCompatibility = async (buildId, score) => {
    try {
      await fetch(`${API_BASE}/update_build_compatibility.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ build_id: buildId, compatibility: score })
      });
    } catch {}
  };


  // Filter and sort community builds
  const filteredAndSortedBuilds = publicBuilds
    .filter(build => 
      build.name.toLowerCase().includes(communitySearchTerm.toLowerCase()) ||
      build.description.toLowerCase().includes(communitySearchTerm.toLowerCase()) ||
      build.creator_name.toLowerCase().includes(communitySearchTerm.toLowerCase())
    )
    // Recompute compatibility when missing/zero and we have component data
    .map(build => {
      try {
        const hasScore = typeof build.compatibility === 'number' && build.compatibility > 0;
        const comps = Array.isArray(build.components) ? build.components : Object.values(build.components || {});
        if (!hasScore && comps.length > 0) {
          const keyAliases = {
            cpu: ['cpu','processor','procie'],
            motherboard: ['motherboard','mobo'],
            gpu: ['gpu','graphics card','graphics','video card','vga'],
            ram: ['ram','memory'],
            storage: ['storage','ssd','hdd','nvme'],
            psu: ['psu','power supply'],
            case: ['case','chassis'],
            cooler: ['cooler','cooling','aio']
          };
          const selected = {};
          comps.forEach(c => {
            const cat = String(c?.category || '').toLowerCase();
            const canon = Object.keys(keyAliases).find(k => k === cat || keyAliases[k].some(a => cat.includes(a)));
            if (canon) selected[canon] = c;
          });
          const comp = calcCompatibility(selected);
          if (comp && typeof comp.score === 'number') {
            const updated = { ...build, compatibility: comp.score };
            // Persist in background
            if (build.id) persistCommunityCompatibility(build.id, comp.score);
            return updated;
          }
        }
      } catch {}
      return build;
    })
    .filter(build => {
      const price = safePrice(build.totalPrice);
      switch (communityFilterPrice) {
        case 'under-50k':
          return price < 50000;
        case '50k-100k':
          return price >= 50000 && price < 100000;
        case '100k-200k':
          return price >= 100000 && price < 200000;
        case 'over-200k':
          return price >= 200000;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      switch (communitySortBy) {
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'price-low':
          return safePrice(a.totalPrice) - safePrice(b.totalPrice);
        case 'price-high':
          return safePrice(b.totalPrice) - safePrice(a.totalPrice);
        case 'compatibility':
          return b.compatibility - a.compatibility;
        default:
          return 0;
      }
    });

  // Derived prebuilt list with price filter
  const priceToNumber = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.\-]/g, '');
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };
  const filteredPrebuilts = prebuilts
    .filter(pc => selectedCategory === 'all' || pc.category === selectedCategory)
    .filter(pc => selectedBrand === 'all' || getBrand(pc) === selectedBrand)
    .filter(pc => pc.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(pc => {
      const p = priceToNumber(pc.price);
      switch (prebuiltFilterPrice) {
        case 'under-50k': return p < 50000;
        case '50k-100k': return p >= 50000 && p < 100000;
        case '100k-200k': return p >= 100000 && p < 200000;
        case 'over-200k': return p >= 200000;
        default: return true;
      }
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc') return priceToNumber(a.price) - priceToNumber(b.price);
      if (sortBy === 'price-desc') return priceToNumber(b.price) - priceToNumber(a.price);
      return String(a.name).localeCompare(String(b.name));
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Prebuilt PC Systems</h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Expertly curated PC configurations using real components from our inventory.
            </p>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex justify-center mt-8">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('prebuilts')}
                className={`px-6 py-3 rounded-md font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'prebuilts'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Package className="w-5 h-5" />
                Prebuilt PCs
              </button>
              <button
                onClick={() => setActiveTab('community')}
                className={`px-6 py-3 rounded-md font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'community'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users className="w-5 h-5" />
                PC Build Sharing
              </button>
              {isAdminUser() && (
                <button
                  onClick={() => setActiveTab('management')}
                  className={`px-6 py-3 rounded-md font-medium transition-colors flex items-center gap-2 ${
                    activeTab === 'management'
                      ? 'bg-white text-green-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <CheckSquare className="w-5 h-5" />
                  PC Build Sharing
                  {submissionStats.pending > 0 && (
                    <span className="ml-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {submissionStats.pending}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'prebuilts' && (
          <>
            {/* Filters and Search */}
            <div className="card mb-8">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search prebuilt PCs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="name">Sort by Name</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
              </div>

              {/* Category and Brand Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mt-6">
                {/* Category Filters */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Categories</h4>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                          selectedCategory === category.id
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {getCategoryIcon(category.id)}
                        <span className="ml-2">{category.name}</span>
                        <span className="ml-2 bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">
                          {category.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brand Filters */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Brands</h4>
                  <div className="flex flex-wrap gap-2">
                    {brands.map((brand) => (
                      <button
                        key={brand.id}
                        onClick={() => setSelectedBrand(brand.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                          selectedBrand === brand.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <Cpu className="w-5 h-5" />
                        <span className="ml-2">{brand.name}</span>
                        <span className="ml-2 bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">
                          {brand.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Prebuilt Controls */}
            <div className="card mb-6 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Sort</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="name">Name</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Price Range</label>
                <select
                  value={prebuiltFilterPrice}
                  onChange={(e) => setPrebuiltFilterPrice(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="all">All</option>
                  <option value="under-50k">Under ₱50,000</option>
                  <option value="50k-100k">₱50,000 - ₱100,000</option>
                  <option value="100k-200k">₱100,000 - ₱200,000</option>
                  <option value="over-200k">Over ₱200,000</option>
                </select>
              </div>
            </div>

            {/* Prebuilt PCs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {loading && Array.from({length:6}).map((_,i)=> (
                <div key={`s-${i}`} className="card p-6 animate-pulse">
                  <div className="h-5 w-2/3 bg-gray-200 rounded mb-3" />
                  <div className="h-4 w-full bg-gray-100 rounded mb-2" />
                  <div className="h-4 w-5/6 bg-gray-100 rounded mb-2" />
                  <div className="h-4 w-1/2 bg-gray-100 rounded" />
                </div>
              ))}
              {!loading && filteredPrebuilts.length === 0 && (
                <div className="col-span-full">
                  <div className="card p-8 text-center text-gray-600">
                    <Package className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    No results found
                  </div>
                </div>
              )}
              {!loading && filteredPrebuilts.map((pc) => (
                <div 
                  key={pc.id} 
                  onClick={() => handleCardClick(pc)}
                  className="card relative cursor-pointer hover:border-green-300"
                >
                  {/* Badges */}
                  <div className="absolute top-4 left-4 flex gap-2">
                    {(!(pc.in_stock || pc.inStock) || pc.stockAvailable === false) && (
                      <span 
                        className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium"
                        title={pc.stockReason || 'This prebuilt is currently unavailable'}
                      >
                        OUT OF STOCK
                      </span>
                    )}
                    {pc.stockAvailable === true && (pc.in_stock || pc.inStock) && (
                      <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                        IN STOCK
                      </span>
                    )}
                  </div>
                  {/* Click indicator */}
                  <div className="absolute top-4 right-4 bg-green-600 text-white p-2 rounded-full opacity-0 hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h2 className="text-xl font-bold text-gray-900">{pc.name}</h2>
                      {getBrandBadge(pc)}
                    </div>
                    <div className="text-gray-600 mb-2">{pc.description}</div>
                    {/* Quick Specs */}
                    {(() => { const specs = extractQuickSpecs(pc); return (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {specs.cpu && (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">
                            CPU: {specs.cpu}
                          </span>
                        )}
                        {specs.gpu && (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">
                            GPU: {specs.gpu}
                          </span>
                        )}
                        {specs.ram && (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">
                            RAM: {specs.ram}
                          </span>
                        )}
                        {specs.storage && (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">
                            Storage: {specs.storage}
                          </span>
                        )}
                      </div>
                    ); })()}
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 mb-4">
                      <li className="flex items-center gap-1">
                        <Tag className="w-4 h-4 text-green-500" />
                        <span className="font-medium">Category:</span> {pc.category}
                      </li>
                      <li className="flex items-center gap-1">
                        <Coins className="w-4 h-4 text-green-500" />
                        <span className="font-medium">Price:</span> {formatCurrencyPHP(pc.price, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </li>
                    </ul>
                    
                    {/* Add to Cart Button */}
                    <button
                      onClick={(e) => handleAddPrebuiltToCart(e, pc)}
                      disabled={pc.stockAvailable === false || !(pc.in_stock || pc.inStock)}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      title={pc.stockAvailable === false ? 'This prebuilt is out of stock' : 'Add to cart'}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'community' && (
          // Community Builds Tab
          <div>
            {/* Community Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-1">PC Build Sharing</h2>
                  <p className="text-gray-600">Discover and get inspired by PC builds shared by the community</p>
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setCurrentPage('my-builds')}
                    className="border-2 border-gray-300 text-gray-700 px-5 py-2 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Eye className="w-5 h-5" /> My Builds
                  </button>
                  <button 
                    onClick={() => setCurrentPage('pc-assembly')}
                    className="bg-green-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Package className="w-5 h-5" /> Create Build
                  </button>
                </div>
              </div>
              
              {publicBuilds.length > 0 && (
                <div className="mb-6 text-gray-700 text-lg">
                  Total builds: {filteredAndSortedBuilds.length} &nbsp; • &nbsp; Total value: {formatCurrencyPHP(filteredAndSortedBuilds.reduce((sum, build) => sum + safePrice(build.totalPrice), 0))}
                </div>
              )}
            </div>

            {/* Community Filters and Search */}
            {publicBuilds.length > 0 && (
              <div className="card mb-6 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search builds, creators..."
                      value={communitySearchTerm}
                      onChange={(e) => setCommunitySearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  
                  <select
                    value={communitySortBy}
                    onChange={(e) => setCommunitySortBy(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="compatibility">Best Compatibility</option>
                  </select>
                  
                  <select
                    value={communityFilterPrice}
                    onChange={(e) => setCommunityFilterPrice(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="all">All Prices</option>
                    <option value="under-50k">Under ₱50,000</option>
                    <option value="50k-100k">₱50,000 - ₱100,000</option>
                    <option value="100k-200k">₱100,000 - ₱200,000</option>
                    <option value="over-200k">Over ₱200,000</option>
                  </select>
                  
                  <div className="text-sm text-gray-600 flex items-center justify-center">
                    {filteredAndSortedBuilds.length} of {publicBuilds.length} builds
                  </div>
                </div>
              </div>
            )}

            {/* Community Content */}
            {communityLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading PC builds...</p>
                </div>
              </div>
            ) : publicBuilds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                  <Share2 className="w-12 h-12 text-gray-400" />
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No public builds yet</h3>
                <p className="text-gray-600 text-center max-w-md mb-8">
                  Be the first to share your PC build with the community! Create a build and make it public to inspire others.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => setCurrentPage('pc-assembly')}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Package className="w-5 h-5" />
                    Create Your Build
                  </button>
                  <button 
                    onClick={() => setCurrentPage('my-builds')}
                    className="border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Eye className="w-5 h-5" />
                    View My Builds
                  </button>
                </div>
              </div>
            ) : filteredAndSortedBuilds.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No builds found</h3>
                <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredAndSortedBuilds.map((build) => (
                  <div key={build.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">{build.name}</h3>
                          <p className="text-sm text-gray-600 mb-2">{build.description}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {build.creator_name}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(build.createdAt)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              {formatCurrencyPHP(safePrice(build.totalPrice))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleCopyBuildLink(build.id)}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            title="Copy build link"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mb-4">
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getCompatibilityStatus(build.compatibility).bgColor}`}>
                          {getCompatibilityStatus(build.compatibility).icon}
                          <span className={`text-sm font-medium ${getCompatibilityStatus(build.compatibility).color}`}>
                            {build.compatibility}% Compatible
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Shared:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatDate(build.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        {(Array.isArray(build.components) ? build.components : Object.values(build.components || {})).slice(0, 8).map((component, index) => (
                          <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs font-medium text-gray-600 mb-1">{component.category}</div>
                            <div className="text-sm font-semibold text-gray-900 truncate">{component.name}</div>
                            <div className="text-xs text-gray-500">{formatCurrencyPHP(component.price || 0)}</div>
                          </div>
                        ))}
                        {(Array.isArray(build.components) ? build.components : Object.values(build.components || {})).length > 8 && (
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="text-xs font-medium text-blue-600 mb-1">+{(Array.isArray(build.components) ? build.components : Object.values(build.components || {})).length - 8} more</div>
                            <div className="text-sm font-semibold text-blue-800">components</div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-3">
                        <button 
                          className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                          onClick={() => setSelectedBuild(build)}
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                        <button 
                          onClick={() => handleUseBuild(build)}
                          className="flex-1 border-2 border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Use This Build
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'management' && isAdminUser() && (
          // Community Management Tab (Admin/Employee only)
          <div>
            {/* Management Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-1">PC Build Sharing</h2>
                  <p className="text-gray-600">Review and manage PC build sharing submissions</p>
                </div>
              </div>
              
              {/* Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Pending</h3>
                      <p className="text-2xl font-bold text-yellow-600">{submissionStats.pending || 0}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Approved</h3>
                      <p className="text-2xl font-bold text-green-600">{submissionStats.approved || 0}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Rejected</h3>
                      <p className="text-2xl font-bold text-red-600">{submissionStats.rejected || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submissions List */}
            {submissionsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading submissions...</p>
                </div>
              </div>
            ) : communitySubmissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                  <CheckSquare className="w-12 h-12 text-gray-400" />
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No submissions to review</h3>
                <p className="text-gray-600 text-center max-w-md">
                  All PC build sharing submissions have been reviewed. Check back later for new submissions.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {communitySubmissions.map((submission) => (
                  <div key={submission.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{submission.build_name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            submission.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            submission.status === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{submission.build_description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {submission.submitter_name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(submission.submitted_at)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Package className="w-4 h-4" />
                            {formatCurrencyPHP(submission.total_price)}
                          </div>
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            {submission.compatibility}% Compatible
                          </div>
                        </div>
                        {submission.admin_notes && (
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-700">
                              <strong>Admin Notes:</strong> {submission.admin_notes}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {submission.status === 'pending' && (
                          <button
                            onClick={() => setSelectedSubmission(submission)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                          >
                            Review
                          </button>
                        )}
                        {(submission.status === 'approved' || submission.status === 'rejected') && (
                          <button
                            onClick={() => handleSubmissionDelete(submission.id, submission.build_name)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Build Details Modal */}
        {selectedBuild && (
          (() => {
            const components = Array.isArray(selectedBuild.components)
              ? selectedBuild.components
              : Object.values(selectedBuild.components || {});
            return (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  {/* Header */}
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                          <Share2 className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">{selectedBuild.name}</h2>
                          <p className="text-gray-600">Shared by {selectedBuild.creator_name}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedBuild(null)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    {/* Build Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">Compatibility</h3>
                            <p className="text-2xl font-bold text-green-600">{selectedBuild.compatibility}%</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${selectedBuild.compatibility}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Package className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">Total Price</h3>
                            <p className="text-2xl font-bold text-blue-600">{formatCurrencyPHP(selectedBuild.totalPrice || 0)}</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">All components included</p>
                      </div>

                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">Creator</h3>
                            <p className="text-lg font-bold text-purple-600">{selectedBuild.creator_name}</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">Build shared on {formatDate(selectedBuild.createdAt)}</p>
                      </div>
                    </div>

                    {/* Build Description */}
                    <div className="bg-gray-50 rounded-xl p-6 mb-8">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-gray-600" />
                        Build Description
                      </h3>
                      <p className="text-gray-700 leading-relaxed">{selectedBuild.description}</p>
                    </div>

                    {/* Components List */}
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Package className="w-6 h-6 text-gray-600" />
                        Build Components
                      </h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {components
                          .sort((a, b) => {
                            // Define the desired order of components
                            const order = [
                              'motherboard', 'cpu', 'gpu', 'ram', 
                              'storage', 'psu', 'case', 'cooler'
                            ];
                            // Add null checks for category properties
                            const aCategory = a?.category?.toLowerCase() || '';
                            const bCategory = b?.category?.toLowerCase() || '';
                            const aIndex = order.indexOf(aCategory);
                            const bIndex = order.indexOf(bCategory);
                            // If both categories are in the order list, sort them
                            if (aIndex !== -1 && bIndex !== -1) {
                              return aIndex - bIndex;
                            }
                            // If only a is in the list, it comes first
                            if (aIndex !== -1) return -1;
                            // If only b is in the list, it comes first
                            if (bIndex !== -1) return 1;
                            // Otherwise, sort alphabetically (with null safety)
                            return (a?.category || '').localeCompare(b?.category || '');
                          })
                          .map((component, idx) => (
                          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-start gap-4">
                              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Package className="w-8 h-8 text-gray-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                                    {component.category}
                                  </span>
                                  <span className="text-lg font-bold text-green-600">
                                    {formatCurrencyPHP(component.price || 0)}
                                  </span>
                                </div>
                                <h4 className="font-semibold text-gray-900 text-lg mb-2 line-clamp-2">
                                  {component.name}
                                </h4>
                                {component.brand && (
                                  <p className="text-sm text-gray-600 mb-2">
                                    Brand: <span className="font-medium">{component.brand}</span>
                                  </p>
                                )}
                                {component.specs && (
                                  <div className="text-xs text-gray-500 space-y-1">
                                    {Object.entries(component.specs).slice(0, 3).map(([key, value]) => (
                                      <div key={key} className="flex justify-between">
                                        <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                                        <span className="font-medium">{value}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Comments Section */}
                    <div className="mt-8">
                      <CommentsSection 
                        buildId={selectedBuild.id} 
                        user={user}
                        className="mb-8"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
                      <button 
                        onClick={() => handleUseBuild(selectedBuild)}
                        className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-5 h-5" />
                        Use This Build
                      </button>
                      <button 
                        onClick={() => handleCopyBuildLink(selectedBuild.id)}
                        className="flex-1 border-2 border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Copy className="w-5 h-5" />
                        Copy Link
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        )}

        {/* Submission Review Modal */}
        {selectedSubmission && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <CheckSquare className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Review Submission</h2>
                      <p className="text-gray-600">{selectedSubmission.build_name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSubmission(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Submission Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Submitter</h3>
                        <p className="text-lg font-bold text-blue-600">{selectedSubmission.submitter_name}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">Submitted on {formatDate(selectedSubmission.submitted_at)}</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Compatibility</h3>
                        <p className="text-2xl font-bold text-green-600">{selectedSubmission.compatibility}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${selectedSubmission.compatibility}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Build Information */}
                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Build Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Build Name</label>
                      <p className="text-gray-900 font-medium">{selectedSubmission.build_name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <p className="text-gray-900">{selectedSubmission.build_description || 'No description provided'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Price</label>
                      <p className="text-gray-900 font-medium">{formatCurrencyPHP(selectedSubmission.total_price)}</p>
                    </div>
                  </div>
                </div>

                {/* Review Notes */}
                <div className="mb-6">
                  <label htmlFor="review-notes" className="block text-sm font-medium text-gray-700 mb-2">
                    Review Notes (Optional)
                  </label>
                  <textarea
                    id="review-notes"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about your decision (will be shared with the submitter)..."
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {reviewNotes.length}/500 characters
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setSelectedSubmission(null)}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSubmissionReview(selectedSubmission.id, 'rejected')}
                    disabled={reviewingSubmission}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {reviewingSubmission ? 'Processing...' : 'Reject'}
                  </button>
                  <button
                    onClick={() => handleSubmissionReview(selectedSubmission.id, 'approved')}
                    disabled={reviewingSubmission}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {reviewingSubmission ? 'Processing...' : 'Approve'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default PrebuiltPCs;
 