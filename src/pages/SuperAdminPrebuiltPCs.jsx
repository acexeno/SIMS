import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/apiBase';
import { authorizedFetch, ensureValidToken } from '../utils/auth';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Search, 
  Filter,
  Package,
  Zap,
  Settings,
  Thermometer,
  Cpu,
  Monitor,
  MemoryStick,
  HardDrive,
  Server,
  CheckSquare,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { formatCurrencyPHP } from '../utils/currency';

const SuperAdminPrebuiltPCs = ({ user }) => {
  const [prebuilts, setPrebuilts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPrebuilt, setEditingPrebuilt] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [components, setComponents] = useState([]);
  const [categories, setCategories] = useState([]);

  // Community Management state
  const [communitySubmissions, setCommunitySubmissions] = useState([]);
  const [submissionStats, setSubmissionStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewingSubmission, setReviewingSubmission] = useState(false);
  const [communityStatus, setCommunityStatus] = useState('pending');
  const [communityPage, setCommunityPage] = useState(1);
  const [communityPages, setCommunityPages] = useState(1);

  // Role state (derive from props, localStorage, or JWT)
  const [currentRoles, setCurrentRoles] = useState([]);
  // removed seeding controls

  useEffect(() => {
    const normalizeRoles = (r) => {
      if (!r) return [];
      if (Array.isArray(r)) return r;
      if (typeof r === 'string') return r.split(',').map(s => s.trim()).filter(Boolean);
      return [];
    };
    try {
      // 1) From prop
      let roles = normalizeRoles(user?.roles);
      // 2) From localStorage 'user'
      if (roles.length === 0) {
        const uStr = localStorage.getItem('user');
        if (uStr) {
          try {
            const uObj = JSON.parse(uStr);
            roles = normalizeRoles(uObj?.roles);
          } catch {}
        }
      }
      // 3) Decode JWT payload
      if (roles.length === 0) {
        const token = localStorage.getItem('token');
        if (token && token.split('.').length === 3) {
          const part = token.split('.')[1];
          let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
          while (b64.length % 4) b64 += '=';
          try {
            const payload = JSON.parse(atob(b64));
            roles = normalizeRoles(payload?.roles);
          } catch {}
        }
      }
      setCurrentRoles(roles);
    } catch {
      setCurrentRoles([]);
    }
  }, [user]);

  // removed seeding status check

  const isAdminOrSuper = currentRoles.includes('Admin') || currentRoles.includes('Super Admin');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'gaming',
    description: '',
    price: '',
    performance: { gaming: '', streaming: '' },
    features: [''],
    component_ids: {
      cpu: '',
      motherboard: '',
      gpu: '',
      ram: '',
      storage: '',
      psu: '',
      case: '',
      cooler: ''
    },
    in_stock: true,
    is_hidden: false
  });

  // Fetch prebuilts
  const fetchPrebuilts = async () => {
    try {
      const token = await ensureValidToken(false);
      if (!token) { 
        console.log('No valid token for fetchPrebuilts');
        setLoading(false); 
        return; 
      }
      console.log('Fetching prebuilts...');
      const response = await authorizedFetch(`${API_BASE}/prebuilts.php?all=1`);
      
      if (response.status === 401) {
        console.log('Authentication failed for prebuilts');
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      if (Array.isArray(data)) {
        setPrebuilts(data);
        console.log('Prebuilts loaded successfully');
      } else {
        console.error('Invalid prebuilts data:', data);
      }
    } catch (error) {
      console.error('Error fetching prebuilts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Safely parse JSON fields that might already be objects/arrays
  const safeParseJson = (value, fallback) => {
    try {
      if (value == null) return fallback;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return fallback;
        return JSON.parse(trimmed);
      }
      if (typeof value === 'object') return value;
      return fallback;
    } catch {
      return fallback;
    }
  };

  // removed seeding handlers

  // Fetch components for selection
  const fetchComponents = async () => {
    try {
      const response = await fetch(`${API_BASE}/get_all_components.php`);
      const data = await response.json();
      if (data.success) {
        setComponents(data.data);
      }
    } catch (error) {
      console.error('Error fetching components:', error);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE}/get_all_categories.php`);
      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    fetchPrebuilts();
    fetchComponents();
    fetchCategories();
  }, []);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      category: 'gaming',
      description: '',
      price: '',
      performance: { gaming: '', streaming: '' },
      features: [''],
      component_ids: {
        cpu: '', motherboard: '', gpu: '', ram: '', storage: '', psu: '', case: '', cooler: ''
      },
      in_stock: true,
      is_hidden: false
    });
    setEditingPrebuilt(null);
  };

  // Open modal for creating/editing
  const openModal = (prebuilt = null) => {
    if (prebuilt) {
      setFormData({
        name: prebuilt.name,
        category: prebuilt.category,
        description: prebuilt.description || '',
        price: prebuilt.price,
        performance: safeParseJson(prebuilt.performance, { gaming: '', streaming: '' }),
        features: safeParseJson(prebuilt.features, ['']),
        component_ids: safeParseJson(prebuilt.component_ids, {
          cpu: '', motherboard: '', gpu: '', ram: '', storage: '', psu: '', case: '', cooler: ''
        }),
        in_stock: prebuilt.in_stock === '1',
        is_hidden: prebuilt.is_hidden === '1'
      });
      setEditingPrebuilt(prebuilt);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate component_ids: require full set of required components
    const lowerKeys = Object.fromEntries(Object.entries(formData.component_ids || {}).map(([k,v]) => [String(k).toLowerCase(), v]));
    const required = ['cpu','motherboard','gpu','ram','storage','psu','case'];
    const missing = required.filter(k => !lowerKeys[k]);
    if (missing.length > 0) {
      alert('Please select all required components before saving this prebuilt. Missing: ' + missing.join(', '));
      return;
    }
    try {
      const token = await ensureValidToken(false);
      if (!token) { alert('Session expired. Please log in again.'); return; }
      const url = editingPrebuilt 
        ? `${API_BASE}/prebuilts.php?id=${editingPrebuilt.id}`
        : `${API_BASE}/prebuilts.php`;
      
      const method = editingPrebuilt ? 'PUT' : 'POST';
      
      const response = await authorizedFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        closeModal();
        fetchPrebuilts();
        alert(editingPrebuilt ? 'Prebuilt updated successfully!' : 'Prebuilt created successfully!');
      } else {
        alert(data.error || 'An error occurred');
      }
    } catch (error) {
      console.error('Error saving prebuilt:', error);
      alert('An error occurred while saving');
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this prebuilt?')) return;
    
    try {
      const token = await ensureValidToken(false);
      if (!token) { alert('Session expired. Please log in again.'); return; }
      const response = await authorizedFetch(`${API_BASE}/prebuilts.php?id=${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchPrebuilts();
        alert('Prebuilt deleted successfully!');
      } else {
        alert(data.error || 'An error occurred');
      }
    } catch (error) {
      console.error('Error deleting prebuilt:', error);
      alert('An error occurred while deleting');
    }
  };

  // Update form data
  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Update nested form data
  const updateNestedFormData = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  // Add feature
  const addFeature = () => {
    setFormData(prev => ({
      ...prev,
      features: [...prev.features, '']
    }));
  };

  // Remove feature
  const removeFeature = (index) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  // Update feature
  const updateFeature = (index, value) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.map((feature, i) => i === index ? value : feature)
    }));
  };

  // Filter prebuilts
  const filteredPrebuilts = prebuilts.filter(prebuilt => {
    const matchesSearch = prebuilt.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || prebuilt.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get component name by ID
  const getComponentName = (id) => {
    if (!id) return '';
    const component = components.find(c => c.id == id);
    return component ? component.name : `Component ${id}`;
  };

  // Get category icon
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'gaming': return <Zap className="w-5 h-5" />;
      case 'workstation': return <Settings className="w-5 h-5" />;
      case 'cooling': return <Thermometer className="w-5 h-5" />;
      default: return <Package className="w-5 h-5" />;
    }
  };

  // --- Community Management helpers and effects ---
  const formatDate = (date) => {
    try {
      return new Date(date).toLocaleString();
    } catch {
      return String(date || '');
    }
  };

  const getCompatibilityStatus = (compatibility) => {
    const value = Number(compatibility) || 0;
    if (value >= 90) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-4 h-4" /> };
    if (value >= 70) return { label: 'Good', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <AlertCircle className="w-4 h-4" /> };
    return { label: 'Issues', color: 'text-red-600', bg: 'bg-red-100', icon: <AlertCircle className="w-4 h-4" /> };
  };

  const fetchSubmissionStats = async () => {
    try {
      const token = await ensureValidToken(false);
      if (!token) return;
      const res = await authorizedFetch(`${API_BASE}/community_management.php?action=stats`);
      const result = await res.json();
      if (result && result.success) {
        const stats = { pending: 0, approved: 0, rejected: 0 };
        (result.data || []).forEach(row => { stats[row.status] = Number(row.count) || 0; });
        setSubmissionStats(stats);
      }
    } catch (e) {
      console.error('Error fetching submission stats:', e);
    }
  };

  const fetchCommunitySubmissions = async (status = 'pending', page = 1) => {
    try {
      const token = await ensureValidToken(false);
      if (!token) return;
      setSubmissionsLoading(true);
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('page', String(page));
      const res = await authorizedFetch(`${API_BASE}/community_management.php?action=submissions&${params.toString()}`);
      const data = await res.json();
      if (data && data.success) {
        setCommunitySubmissions(Array.isArray(data.data) ? data.data : []);
        const p = data.pagination || {};
        setCommunityPages(Number(p.pages) || 1);
      } else {
        setCommunitySubmissions([]);
        setCommunityPages(1);
      }
    } catch (e) {
      console.error('Error fetching community submissions:', e);
      setCommunitySubmissions([]);
      setCommunityPages(1);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => { fetchSubmissionStats(); }, []);
  useEffect(() => { fetchCommunitySubmissions(communityStatus, communityPage); }, [communityStatus, communityPage]);

  const handleSubmissionReview = async (submissionId, status) => {
    setReviewingSubmission(true);
    try {
      const token = await ensureValidToken(false);
      if (!token) { alert('You must be logged in to review submissions.'); return; }
      const response = await authorizedFetch(`${API_BASE}/community_management.php?action=review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, status, admin_notes: reviewNotes })
      });
      const result = await response.json();
      if (result && result.success) {
        alert(`Submission ${status} successfully!`);
        setSelectedSubmission(null);
        setReviewNotes('');
        fetchCommunitySubmissions(communityStatus, communityPage);
        fetchSubmissionStats();
      } else {
        alert('Error reviewing submission: ' + (result && result.error ? result.error : 'Unknown error'));
      }
    } catch (e) {
      console.error('Error reviewing submission:', e);
      alert('Error reviewing submission. Please try again.');
    } finally {
      setReviewingSubmission(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p>Loading prebuilts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="page-title">Prebuilt PC Management</h2>
        {isAdminOrSuper && (
          <div className="flex gap-2">
            <button
              onClick={() => openModal()}
              className="btn btn-primary shadow"
            >
              <Plus className="h-4 w-4" />
              Add Prebuilt
            </button>
          </div>
        )}
      </div>

      {/* seeding info removed */}

      {!isAdminOrSuper && (
        <div className="text-sm text-gray-600">
          Note: Curated Prebuilt actions are limited to Admins. You can still manage Community submissions below.
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search prebuilts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="gaming">Gaming</option>
            <option value="workstation">Workstation</option>
            <option value="cooling">Cooling</option>
          </select>
        </div>
      </div>

      {/* Prebuilts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPrebuilts.map((prebuilt) => (
          <div key={prebuilt.id} className="card overflow-hidden">
            <div className="relative">
              {/* Status badges */}
              <div className="absolute top-2 left-2 flex gap-2">
                {prebuilt.is_hidden === '1' && (
                  <span className="chip chip-gray">HIDDEN</span>
                )}
                {prebuilt.in_stock === '0' && (
                  <span className="chip chip-red">OUT OF STOCK</span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{prebuilt.name}</h3>
                {isAdminOrSuper && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openModal(prebuilt)}
                      className="btn btn-outline px-2 py-1"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(prebuilt.id)}
                      className="btn btn-outline px-2 py-1 text-red-600 border-red-200 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                {getCategoryIcon(prebuilt.category)}
                <span className="capitalize">{prebuilt.category}</span>
              </div>
              
              <div className="text-lg font-bold text-green-600 mb-2">
                {formatCurrencyPHP(prebuilt.price)}
              </div>
              
              {prebuilt.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{prebuilt.description}</p>
              )}

              {/* Component preview */}
              <div className="text-xs text-gray-500 space-y-1">
                {(() => { const cids = safeParseJson(prebuilt.component_ids, {}); return (
                  <>
                    <div>CPU: {getComponentName(cids.cpu)}</div>
                    <div>GPU: {getComponentName(cids.gpu)}</div>
                    <div>RAM: {getComponentName(cids.ram)}</div>
                  </>
                ); })()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredPrebuilts.length === 0 && (
        <div className="card empty-state">
          <Package className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <p>No prebuilts found</p>
        </div>
      )}

      {/* Community Management Panel */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Community Management</h3>
          </div>
          <div className="flex gap-2 text-sm">
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Pending: {submissionStats.pending || 0}</span>
            <span className="px-2 py-1 rounded-full bg-green-100 text-green-700">Approved: {submissionStats.approved || 0}</span>
            <span className="px-2 py-1 rounded-full bg-red-100 text-red-700">Rejected: {submissionStats.rejected || 0}</span>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-2 mb-4">
          {['pending','approved','rejected'].map(s => (
            <button
              key={s}
              onClick={() => { setCommunityStatus(s); setCommunityPage(1); }}
              className={`px-4 py-2 rounded-md border ${communityStatus===s ? 'bg-white text-green-600 border-green-300' : 'text-gray-600 hover:text-gray-900 border-gray-200'}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s==='pending' && (submissionStats.pending||0) > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                  {submissionStats.pending}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Submissions List */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 text-sm text-gray-600 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {submissionsLoading ? 'Loading submissions...' : `${communitySubmissions.length} ${communityStatus} submission(s)`}
          </div>
          {communitySubmissions.length === 0 && !submissionsLoading && (
            <div className="p-6 text-center text-gray-500">No {communityStatus} submissions found.</div>
          )}
          {communitySubmissions.length > 0 && (
            <div className="divide-y">
              {communitySubmissions.map(sub => {
                const compat = getCompatibilityStatus(sub.compatibility);
                return (
                  <div key={sub.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 truncate">{sub.build_name}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${compat.bg} ${compat.color}`}>
                          {compat.icon}
                          {compat.label}
                        </span>
                        <span className="text-xs text-gray-500">₱{Number(sub.total_price || 0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-2">
                        <span>By: <span className="font-medium">{sub.submitter_name || 'Unknown'}</span></span>
                        {sub.submitter_email && <span>({sub.submitter_email})</span>}
                        <span>Submitted: {formatDate(sub.submitted_at)}</span>
                        {sub.reviewer_name && sub.reviewed_at && (
                          <span>Reviewed by {sub.reviewer_name} on {formatDate(sub.reviewed_at)}</span>
                        )}
                      </div>
                      {sub.build_description && (
                        <p className="text-sm text-gray-700 mt-2 line-clamp-2">{sub.build_description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {communityStatus === 'pending' ? (
                        <button
                          onClick={() => { setSelectedSubmission(sub); setReviewNotes(sub.admin_notes || ''); }}
                          className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white"
                        >
                          Review
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">{sub.status?.toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 text-sm text-gray-600">
            <button
              onClick={() => setCommunityPage(p => Math.max(1, p - 1))}
              disabled={communityPage <= 1}
              className={`px-3 py-1 rounded border ${communityPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white'}`}
            >
              Prev
            </button>
            <span>Page {communityPage} of {communityPages}</span>
            <button
              onClick={() => setCommunityPage(p => Math.min(communityPages, p + 1))}
              disabled={communityPage >= communityPages}
              className={`px-3 py-1 rounded border ${communityPage >= communityPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white'}`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Review Submission</h3>
              <button onClick={() => setSelectedSubmission(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm text-gray-500">Build Name</div>
                <div className="text-base font-semibold text-gray-900">{selectedSubmission.build_name}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                <div>Submitter: <span className="font-medium">{selectedSubmission.submitter_name}</span></div>
                <div>Submitted: {formatDate(selectedSubmission.submitted_at)}</div>
                <div>Compatibility: {selectedSubmission.compatibility}%</div>
                <div>Total Price: ₱{Number(selectedSubmission.total_price || 0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</div>
              </div>
              {selectedSubmission.build_description && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Description</div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedSubmission.build_description}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (optional)</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Add a note to the submitter (optional)"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2 rounded-md border"
              >
                Cancel
              </button>
              <button
                disabled={reviewingSubmission}
                onClick={() => handleSubmissionReview(selectedSubmission.id, 'rejected')}
                className={`px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white ${reviewingSubmission ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                Reject
              </button>
              <button
                disabled={reviewingSubmission}
                onClick={() => handleSubmissionReview(selectedSubmission.id, 'approved')}
                className={`px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white ${reviewingSubmission ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingPrebuilt ? 'Edit Prebuilt' : 'Add New Prebuilt'}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateFormData('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => updateFormData('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="gaming">Gaming</option>
                    <option value="workstation">Workstation</option>
                    <option value="cooling">Cooling</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (₱)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => updateFormData('price', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Performance */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Performance (optional)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Gaming (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.performance.gaming}
                      onChange={(e) => updateNestedFormData('performance', 'gaming', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Streaming (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.performance.streaming}
                      onChange={(e) => updateNestedFormData('performance', 'streaming', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
                <div className="space-y-2">
                  {formData.features.map((feature, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => updateFeature(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Enter feature"
                      />
                      <button
                        type="button"
                        onClick={() => removeFeature(index)}
                        className="px-3 py-2 text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addFeature}
                    className="text-green-600 hover:text-green-700 text-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Feature
                  </button>
                </div>
              </div>

              {/* Component Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Components</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(formData.component_ids).map(([category, componentId]) => (
                    <div key={category}>
                      <label className="block text-xs text-gray-600 mb-1 capitalize">{category}</label>
                      <select
                        value={componentId}
                        onChange={(e) => updateNestedFormData('component_ids', category, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">Select {category}</option>
                        {components
                          .filter(comp => {
                            const cat = categories.find(c => c.id == comp.category_id);
                            if (!cat) return false;
                            const name = cat.name.toLowerCase();
                            switch (category) {
                              case 'cpu':
                                return name.includes('cpu') || name.includes('procie') || name.includes('processor');
                              case 'motherboard':
                                return name.includes('mobo') || name.includes('motherboard');
                              case 'gpu':
                                return name.includes('gpu') || name.includes('graphics');
                              case 'ram':
                                return name.includes('ram') || name.includes('memory');
                              case 'storage':
                                return name.includes('storage') || name.includes('ssd') || name.includes('hdd') || name.includes('hard drive');
                              case 'psu':
                                return name.includes('psu') || name.includes('power supply');
                              case 'case':
                                return name.includes('case') || name.includes('chassis');
                              case 'cooler':
                                return name.includes('cooler') || name.includes('aio') || name.includes('fan') || name.includes('heatsink');
                              default:
                                return false;
                            }
                          })
                          .map(component => (
                            <option key={component.id} value={component.id}>
                              {component.name} - {formatCurrencyPHP(component.price)}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.in_stock}
                    onChange={(e) => updateFormData('in_stock', e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">In Stock</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_hidden}
                    onChange={(e) => updateFormData('is_hidden', e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Hidden</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingPrebuilt ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPrebuiltPCs;