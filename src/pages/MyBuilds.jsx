import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/apiBase';
import { Plus, Trash2, Edit, Eye, Share2, Download, Calendar, CheckCircle, AlertCircle, Clock, Package, Globe, Lock } from 'lucide-react';
import { getCompatibilityScore as calcCompatibility } from '../utils/compatibilityService';
import { formatCurrencyPHP } from '../utils/currency';
import CommentsSection from '../components/CommentsSection';

// Helper function to check if JWT token is expired (supports base64url)
function isTokenExpired(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return true;
    let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payload = JSON.parse(atob(b64));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true; // treat as expired if invalid
  }
}

const MyBuilds = ({ setCurrentPage, setSelectedComponents, user }) => {
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuild, setSelectedBuild] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [buildToDelete, setBuildToDelete] = useState(null);
  const [deletingBuild, setDeletingBuild] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(null);
  const [submissions, setSubmissions] = useState([]); // status per build

  // Load builds from backend
  useEffect(() => {
    const fetchBuilds = async () => {
      const token = localStorage.getItem('token');
      if (!token || isTokenExpired(token)) {
        setLoading(false);
        return;
      }
      try {
        const headers = {
          'Authorization': `Bearer ${token}`
        };
        const response = await fetch(`${API_BASE}/index.php?endpoint=builds`, {
          method: 'GET',
          headers
        });
        if (response.status === 401) {
          // Do not clear global token here; just stop this flow
          setLoading(false);
          setBuilds([]);
          return;
        }
        const result = await response.json();
        console.log('API Response:', result);
        
        if (result.success) {
          // Debug: Log what we received
          console.log('Raw builds from API:', result.data);
          console.log('Debug info:', result.debug);
          
          // Ensure all builds have valid IDs
          const validBuilds = (result.data || []).map((build, index) => {
            // Ensure ID is properly set - try multiple property names
            let buildId = build.id || build.build_id || build.ID || build.Id;
            
            // Debug: Log each build
            console.log(`Build ${index}:`, { 
              id: build.id, 
              buildId: buildId, 
              type: typeof build.id,
              fullBuild: build 
            });
            
            // If still no ID, log error but don't crash
            if (!buildId || buildId <= 0) {
              console.error('Build missing valid ID at index', index, ':', build);
            }
            
            // Ensure ID is a number
            if (buildId) {
              buildId = typeof buildId === 'string' ? parseInt(buildId, 10) : Number(buildId);
            }
            
            return {
              ...build,
              id: buildId || null // Set to null if invalid, will be filtered out
            };
          }).filter(build => build.id && build.id > 0); // Filter out builds without valid IDs
          
          console.log('Fetched builds:', validBuilds.length, 'valid builds out of', result.data?.length || 0);
          if (result.debug) {
            console.log('Backend debug:', result.debug);
          }
          setBuilds(validBuilds);
        } else {
          console.error('API returned error:', result.error || result);
          setBuilds([]);
        }
      } catch (error) {
        setBuilds([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBuilds();
  }, []);

  // Load user's community submissions
  useEffect(() => {
    const fetchSubmissions = async () => {
      const token = localStorage.getItem('token');
      if (!token || isTokenExpired(token)) return;
      try {
        const res = await fetch(`${API_BASE}/community_submission.php`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success) setSubmissions(result.data || []);
      } catch {}
    };
    fetchSubmissions();
  }, []);

  const handleDeleteBuild = (buildId) => {
    // Handle various formats: number, string number, or convert
    let id;
    
    // First check if buildId is null or undefined
    if (buildId === null || buildId === undefined) {
      console.error('Build ID is null or undefined');
      alert('Error: Invalid build ID. Please refresh the page and try again.');
      return;
    }
    
    // Convert to number - handle both string and number inputs
    if (typeof buildId === 'string') {
      id = parseInt(buildId, 10);
    } else if (typeof buildId === 'number') {
      id = buildId;
    } else {
      // Try to convert to string first, then parse
      id = parseInt(String(buildId), 10);
    }
    
    // Validate the ID - must be a positive integer
    if (isNaN(id) || id <= 0 || !Number.isInteger(id)) {
      console.error('Invalid build ID:', buildId, 'parsed as:', id, 'type:', typeof buildId);
      alert('Error: Invalid build ID. The build may not have been saved properly. Please refresh the page and try again.');
      return;
    }
    
    // Double-check: ensure id is a valid positive integer
    const finalId = Number.isInteger(id) && id > 0 ? id : null;
    if (!finalId) {
      console.error('Build ID validation failed after conversion:', { original: buildId, converted: id });
      alert('Error: Invalid build ID. Please refresh the page and try again.');
      return;
    }
    
    console.log('Setting buildToDelete:', finalId, 'from input:', buildId, 'type:', typeof buildId);
    setBuildToDelete(finalId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async (e) => {
    // Prevent any default behavior and stop propagation
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Check if buildToDelete is null, undefined, or not a valid number
    if (buildToDelete === null || buildToDelete === undefined || typeof buildToDelete !== 'number' || buildToDelete <= 0 || deletingBuild) {
      console.log('Delete blocked:', { buildToDelete, deletingBuild, type: typeof buildToDelete });
      return;
    }
    
    console.log('Starting delete process for build:', buildToDelete);
    setDeletingBuild(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token || isTokenExpired(token)) {
        alert('Session expired. Please log in again.');
        setShowDeleteModal(false);
        setBuildToDelete(null);
        setDeletingBuild(false);
        return;
      }

      const url = `${API_BASE}/index.php?endpoint=builds&id=${buildToDelete}`;
      console.log('Delete URL:', url);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Delete response status:', response.status);

      let result;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
        console.log('Delete response:', result);
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Invalid response from server: ' + text.substring(0, 100));
      }

      if (response.ok && result.success) {
        setBuilds(prev => prev.filter(build => build.id !== buildToDelete));
        setShowDeleteModal(false);
        setBuildToDelete(null);
        alert('Build deleted successfully!');
      } else {
        const errorMsg = result.error || result.message || `HTTP ${response.status}: ${response.statusText}`;
        console.error('Delete failed:', errorMsg, result);
        alert('Error deleting build: ' + errorMsg);
      }
    } catch (error) {
      console.error('Error deleting build:', error);
      alert('Error deleting build: ' + (error.message || 'Please try again.'));
    } finally {
      setDeletingBuild(false);
    }
  };

  const handleTogglePublic = async (buildId) => {
    setTogglingPublic(buildId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/index.php?endpoint=builds&public=1&id=${buildId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setBuilds(prev => prev.map(build => 
          build.id === buildId 
            ? { ...build, isPublic: result.is_public }
            : build
        ));
        alert(result.message);
      } else {
        alert(result.error || 'Unable to change visibility.');
      }
    } catch (error) {
      console.error('Error updating build visibility:', error);
      alert('Error updating build visibility. Please try again.');
    } finally {
      setTogglingPublic(null);
    }
  };

  const submitToCommunity = async (build) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/index.php?endpoint=community_submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          build_id: build.id,
          build_name: build.name,
          build_description: build.description || '',
          total_price: build.totalPrice || 0,
          compatibility: build.compatibility || 0
        })
      });
      const result = await response.json();
      if (result.success) {
        alert('Build submitted for PC Build Sharing review! Admins will review and approve it for PC Build Sharing.');
        setSubmissions(prev => [{ id: result.submission_id, build_id: build.id, status: 'pending' }, ...prev]);
      } else {
        alert(result.error || 'Failed to submit for review.');
      }
    } catch (e) {
      console.error('Error submitting to community:', e);
      alert('Network error while submitting. Please try again.');
    }
  };

  // Handle edit build functionality
  const handleEditBuild = (build) => {
    // Ensure components are mapped by category key to the full component object
    let componentsForEdit = {};
    if (Array.isArray(build.components)) {
      // If components is an array, map by category
      build.components.forEach(component => {
        if (component && component.category) {
          // Use lowercase category key for consistency
          componentsForEdit[component.category.toLowerCase()] = component;
        }
      });
    } else if (build.components && typeof build.components === 'object') {
      // If already an object, check if keys are category names
      // If keys are numbers, convert to category keys
      const keys = Object.keys(build.components);
      if (keys.every(key => !isNaN(Number(key)))) {
        // Numeric keys, convert to category keys
        Object.values(build.components).forEach(component => {
          if (component && component.category) {
            componentsForEdit[component.category.toLowerCase()] = component;
          }
        });
      } else {
        // Assume already correct
        componentsForEdit = { ...build.components };
      }
    }

    // Store the build data for editing
    localStorage.setItem('builditpc-selected-components', JSON.stringify(componentsForEdit));
    localStorage.setItem('builditpc-editing-build', JSON.stringify({
      id: build.id,
      name: build.name,
      description: build.description
    }));

    // Pass the components to the main app so PCAssembly can pre-fill them
    if (typeof setSelectedComponents === 'function') {
      setSelectedComponents(componentsForEdit);
    }

    // Navigate to PC Assembly page
    setCurrentPage('pc-assembly');
  };

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

  // Helper to safely format price
  const safePrice = (price) => {
    const num = Number(price);
    return isNaN(num) ? 0 : num;
  };

  // Helper to safely format date
  const safeDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return isNaN(d) ? 'N/A' : d.toLocaleDateString();
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2">No builds yet</h3>
      <p className="text-gray-600 text-center max-w-md mb-8">
        You haven't saved any PC builds yet. Start building your dream PC in the PC Assembly section and save your configurations for future reference.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <button 
          onClick={() => setCurrentPage('pc-assembly')}
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Start Building
        </button>
      </div>
      
      <div className="mt-8 p-6 bg-blue-50 rounded-lg max-w-md">
                        <h4 className="font-semibold text-blue-900 mb-2">Pro Tips:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Save multiple builds to compare different configurations</li>
          <li>• Share your builds with friends for feedback</li>
          <li>• Export parts lists to local retailers</li>
          <li>• Track price changes on your saved components</li>
        </ul>
      </div>
    </div>
  );

  const BuildCard = ({ build }) => {
    // Ensure build has a valid ID
    if (!build || !build.id || build.id <= 0) {
      console.error('Invalid build data:', build);
      return null;
    }

    // Ensure components is always an array - handle string, object, or array
    let components = [];
    if (Array.isArray(build.components)) {
      components = build.components.filter(c => c && typeof c === 'object');
    } else if (build.components && typeof build.components === 'object') {
      // Handle object format (keyed by category)
      components = Object.values(build.components).filter(c => c && typeof c === 'object');
    } else if (typeof build.components === 'string') {
      // Handle case where components is still a JSON string (shouldn't happen, but be safe)
      try {
        const parsed = JSON.parse(build.components);
        if (Array.isArray(parsed)) {
          components = parsed.filter(c => c && typeof c === 'object');
        } else if (parsed && typeof parsed === 'object') {
          components = Object.values(parsed).filter(c => c && typeof c === 'object');
        }
      } catch (e) {
        console.error('Failed to parse components string:', e);
        components = [];
      }
    }

    // Recalculate total price from components if totalPrice is 0 or missing
    let effectiveTotalPrice = safePrice(build.totalPrice);
    if (effectiveTotalPrice <= 0 && components.length > 0) {
      const calculatedPrice = components.reduce((sum, component) => {
        const price = safePrice(component.price);
        return sum + price;
      }, 0);
      if (calculatedPrice > 0) {
        effectiveTotalPrice = calculatedPrice;
      }
    }

    // Fallback: recompute compatibility when saved value is 0/undefined and we have components
    let effectiveCompatibility = typeof build.compatibility === 'number' ? build.compatibility : 0;
    if ((!effectiveCompatibility || effectiveCompatibility === 0) && components.length > 0) {
      try {
        const keyAliases = {
          cpu: ['cpu', 'processor', 'procie'],
          motherboard: ['motherboard', 'mobo'],
          gpu: ['gpu', 'graphics card', 'graphics', 'video card', 'vga'],
          ram: ['ram', 'memory'],
          storage: ['storage', 'ssd', 'hdd', 'nvme'],
          psu: ['psu', 'power supply'],
          case: ['case', 'chassis'],
          cooler: ['cooler', 'cooling', 'aio']
        };
        const selected = {};
        components.forEach(c => {
          if (!c || typeof c !== 'object') return;
          const cat = String(c?.category || c?.name || '').toLowerCase();
          const canon = Object.keys(keyAliases).find(k => 
            k === cat || 
            keyAliases[k].some(a => cat.includes(a)) ||
            (c.name && keyAliases[k].some(a => c.name.toLowerCase().includes(a)))
          );
          if (canon) selected[canon] = c;
        });
        const comp = calcCompatibility(selected);
        if (comp && typeof comp.score === 'number' && comp.score > 0) {
          effectiveCompatibility = comp.score;
        }
      } catch (error) {
        console.error('Error calculating compatibility:', error);
      }
    }
    const compatibility = getCompatibilityStatus(effectiveCompatibility);
    const submission = submissions.find(s => s.build_id === build.id);
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{build.name}</h3>
              <p className="text-sm text-gray-600 mb-2">{build.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {safeDate(build.createdAt)}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-700">₱</span>
                  {formatCurrencyPHP(effectiveTotalPrice)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleTogglePublic(build.id)}
                disabled={togglingPublic === build.id}
                className={`p-2 rounded-lg transition-colors ${
                  build.isPublic 
                    ? 'text-green-600 hover:text-green-700 hover:bg-green-50' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                title={build.isPublic ? 'Make Private' : 'Make Public'}
              >
                {togglingPublic === build.id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                ) : build.isPublic ? (
                  <Globe className="w-4 h-4" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
              </button>
              {!build.isPublic && (
                <button
                  onClick={() => submitToCommunity(build)}
                  disabled={submission && submission.status === 'pending'}
                  className={`p-2 rounded-lg transition-colors ${submission && submission.status === 'pending' ? 'text-yellow-600 bg-yellow-50' : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'}`}
                  title={submission && submission.status === 'pending' ? 'Awaiting admin review' : 'Submit to PC Build Sharing'}
                >
                  {submission && submission.status === 'pending' ? <Clock className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                </button>
              )}
              <button 
                onClick={() => handleEditBuild(build)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button 
                data-build-id={build.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Get build ID from data attribute first (most reliable)
                  let buildId = e.currentTarget.getAttribute('data-build-id');
                  
                  // Fallback to build object if data attribute is missing
                  if (!buildId && build) {
                    buildId = build.id || build.build_id || build.ID || build.Id;
                  }
                  
                  // Debug: Log the build object to see what we're working with
                  console.log('Delete button clicked - Build ID from data:', e.currentTarget.getAttribute('data-build-id'));
                  console.log('Delete button clicked - Build ID from object:', build?.id);
                  console.log('Delete button clicked - Full build object:', build);
                  
                  // Ensure we have a valid build ID
                  if (!buildId) {
                    console.error('Build ID is missing from both data attribute and build object:', { 
                      build, 
                      'data-build-id': e.currentTarget.getAttribute('data-build-id')
                    });
                    alert('Error: Cannot delete build - invalid build ID. Please refresh the page and try again.');
                    return;
                  }
                  
                  // Convert to number if it's a string
                  if (typeof buildId === 'string') {
                    buildId = parseInt(buildId, 10);
                  }
                  
                  // Validate the ID
                  if (buildId === undefined || buildId === null || buildId <= 0 || isNaN(buildId)) {
                    console.error('Build ID is invalid after conversion:', { 
                      original: e.currentTarget.getAttribute('data-build-id'),
                      build, 
                      buildId, 
                      type: typeof buildId 
                    });
                    alert('Error: Cannot delete build - invalid build ID. Please refresh the page and try again.');
                    return;
                  }
                  
                  // Ensure it's a number
                  const numericId = typeof buildId === 'number' ? buildId : parseInt(buildId, 10);
                  if (isNaN(numericId) || numericId <= 0) {
                    console.error('Build ID conversion failed:', { 
                      original: e.currentTarget.getAttribute('data-build-id'),
                      converted: numericId 
                    });
                    alert('Error: Cannot delete build - invalid build ID. Please refresh the page and try again.');
                    return;
                  }
                  
                  console.log('Delete button clicked for build:', numericId, 'type:', typeof numericId);
                  handleDeleteBuild(numericId);
                }}
                className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                title="Delete Build"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${compatibility.bgColor}`}>
                {compatibility.icon}
                <span className={`text-sm font-medium ${compatibility.color}`}>
                  {effectiveCompatibility}% Compatible
                </span>
              </div>
              
              {build.isPublic && (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  <Globe className="w-3 h-3" />
                  Public
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Last updated:</span>
              <span className="text-sm font-medium text-gray-900">
                {safeDate(build.updatedAt)}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {components.length > 0 ? (
              components.map((component, index) => {
                if (!component || typeof component !== 'object') return null;
                const category = component.category || component.name || 'Unknown';
                const name = component.name || 'Unnamed Component';
                const price = safePrice(component.price);
                return (
                  <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs font-medium text-gray-600 mb-1">{category}</div>
                    <div className="text-sm font-semibold text-gray-900 truncate" title={name}>{name}</div>
                    <div className="text-xs text-gray-500">{formatCurrencyPHP(price)}</div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center text-sm text-gray-500 py-2">
                No components found
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
              onClick={() => handleEditBuild(build)}
              className="flex-1 border-2 border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit Build
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your builds...</p>
        </div>
      </div>
    );
  }

  const totalBuilds = builds.length;
  const totalValue = builds.reduce((sum, build) => {
    // Recalculate price from components if totalPrice is 0
    let price = safePrice(build.totalPrice);
    if (price <= 0 && build.components) {
      const components = Array.isArray(build.components) 
        ? build.components 
        : Object.values(build.components || {});
      price = components.reduce((compSum, comp) => {
        return compSum + safePrice(comp?.price);
      }, 0);
    }
    return sum + price;
  }, 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">My Builds</h1>
            <p className="text-gray-600">Manage and organize your saved PC configurations</p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => setCurrentPage('prebuilt-pcs')}
              className="border-2 border-gray-300 text-gray-700 px-5 py-2 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Share2 className="w-5 h-5" /> Browse PC Build Sharing
            </button>
            {builds.length > 0 && (
              <button className="bg-green-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
              onClick={() => setCurrentPage('pc-assembly')}>
                <Plus className="w-5 h-5" /> New Build
              </button>
            )}
          </div>
        </div>
        
        {builds.length > 0 && (
          <div className="mb-6 text-gray-700 text-lg">
            Total builds: {totalBuilds} &nbsp; • &nbsp; Total value: {formatCurrencyPHP(totalValue)}
          </div>
        )}
      </div>

      {/* Content */}
      {builds.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {builds.map((build) => (
            <BuildCard key={build.id} build={build} />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            // Close modal when clicking backdrop
            if (e.target === e.currentTarget && !deletingBuild) {
              setShowDeleteModal(false);
              setBuildToDelete(null);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Build</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this build? This action cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!deletingBuild) {
                    setShowDeleteModal(false);
                    setBuildToDelete(null);
                  }
                }}
                disabled={deletingBuild}
                className="flex-1 border-2 border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  confirmDelete(e);
                }}
                disabled={deletingBuild}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deletingBuild ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Build Details Modal */}
      {selectedBuild && (
        (() => {
          // Ensure components is always an array for the modal
          let components = [];
          if (Array.isArray(selectedBuild.components)) {
            components = selectedBuild.components.filter(c => c && typeof c === 'object');
          } else if (selectedBuild.components && typeof selectedBuild.components === 'object') {
            components = Object.values(selectedBuild.components).filter(c => c && typeof c === 'object');
          }
          
          // Recalculate total price from components if totalPrice is 0 or missing
          let effectiveTotalPrice = safePrice(selectedBuild.totalPrice);
          if (effectiveTotalPrice <= 0 && components.length > 0) {
            const calculatedPrice = components.reduce((sum, component) => {
              return sum + safePrice(component?.price);
            }, 0);
            if (calculatedPrice > 0) {
              effectiveTotalPrice = calculatedPrice;
            }
          }
          
          // Recompute compatibility if missing/zero
          let effectiveCompatibility = typeof selectedBuild.compatibility === 'number' ? selectedBuild.compatibility : 0;
          if ((!effectiveCompatibility || effectiveCompatibility === 0) && components.length > 0) {
            try {
              const keyAliases = {
                cpu: ['cpu', 'processor', 'procie'],
                motherboard: ['motherboard', 'mobo'],
                gpu: ['gpu', 'graphics card', 'graphics', 'video card', 'vga'],
                ram: ['ram', 'memory'],
                storage: ['storage', 'ssd', 'hdd', 'nvme'],
                psu: ['psu', 'power supply'],
                case: ['case', 'chassis'],
                cooler: ['cooler', 'cooling', 'aio']
              };
              const selected = {};
              components.forEach(c => {
                if (!c || typeof c !== 'object') return;
                const cat = String(c?.category || c?.name || '').toLowerCase();
                const canon = Object.keys(keyAliases).find(k => 
                  k === cat || 
                  keyAliases[k].some(a => cat.includes(a)) ||
                  (c.name && keyAliases[k].some(a => c.name.toLowerCase().includes(a)))
                );
                if (canon) selected[canon] = c;
              });
              const comp = calcCompatibility(selected);
              if (comp && typeof comp.score === 'number' && comp.score > 0) {
                effectiveCompatibility = comp.score;
              }
            } catch (error) {
              console.error('Error calculating compatibility in modal:', error);
            }
          }
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{selectedBuild.name}</h2>
                        <p className="text-gray-600">{selectedBuild.description}</p>
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
                          <p className="text-2xl font-bold text-green-600">{effectiveCompatibility}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${effectiveCompatibility}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 text-xl font-bold">₱</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Total Price</h3>
                          <p className="text-2xl font-bold text-blue-600">{formatCurrencyPHP(effectiveTotalPrice)}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">All components included</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Components</h3>
                          <p className="text-2xl font-bold text-purple-600">{components.length}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">Parts in this build</p>
                    </div>
                  </div>

                  {/* Build Timeline */}
                  <div className="bg-gray-50 rounded-xl p-6 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-gray-600" />
                      Build Timeline
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Created</p>
                          <p className="text-sm text-gray-600">{formatDate(selectedBuild.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Clock className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Last Updated</p>
                          <p className="text-sm text-gray-600">{formatDate(selectedBuild.updatedAt)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Components List */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <Package className="w-6 h-6 text-gray-600" />
                      Build Components
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {components.length > 0 ? (
                        components.map((component, idx) => {
                          if (!component || typeof component !== 'object') return null;
                          const category = component.category || 'Unknown';
                          const name = component.name || 'Unnamed Component';
                          const price = safePrice(component.price);
                          return (
                            <div key={idx} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                              <div className="flex items-start gap-4">
                                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Package className="w-8 h-8 text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                                      {category}
                                    </span>
                                    <span className="text-lg font-bold text-green-600">
                                      {formatCurrencyPHP(price)}
                                    </span>
                                  </div>
                                  <h4 className="font-semibold text-gray-900 text-lg mb-2 line-clamp-2" title={name}>
                                    {name}
                                  </h4>
                                  {component.brand && (
                                    <p className="text-sm text-gray-600 mb-2">
                                      Brand: <span className="font-medium">{component.brand}</span>
                                    </p>
                                  )}
                                  {component.specs && typeof component.specs === 'object' && (
                                    <div className="text-xs text-gray-500 space-y-1">
                                      {Object.entries(component.specs).slice(0, 3).map(([key, value]) => (
                                        <div key={key} className="flex justify-between">
                                          <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                                          <span className="font-medium">{String(value)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-full text-center text-gray-500 py-8">
                          No components found in this build
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Comments Section - Only show for public builds */}
                  {selectedBuild.isPublic && (
                    <div className="mt-8">
                      <CommentsSection 
                        buildId={selectedBuild.id} 
                        user={user}
                        className="mb-8"
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
                    <button 
                      onClick={() => handleEditBuild(selectedBuild)}
                      className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit className="w-5 h-5" />
                      Edit Build
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};

export default MyBuilds; 