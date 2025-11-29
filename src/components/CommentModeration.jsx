import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  User, 
  Clock,
  AlertTriangle,
  Shield
} from 'lucide-react';
import { API_BASE } from '../utils/apiBase';
import { authorizedFetch } from '../utils/auth';

const CommentModeration = ({ user, className = '' }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'approved', 'rejected'
  const [selectedComment, setSelectedComment] = useState(null);
  const [moderating, setModerating] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  // Fetch comments for moderation
  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await authorizedFetch(`${API_BASE}/build_comments.php?action=moderation&filter=${filter}`);
      const result = await response.json();
      
      if (result.success) {
        setComments(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch moderation stats
  const fetchStats = async () => {
    try {
      const response = await authorizedFetch(`${API_BASE}/build_comments.php?action=moderation_stats`);
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchComments();
    fetchStats();
  }, [filter]);

  // Moderate comment (approve/reject)
  const moderateComment = async (commentId, action) => {
    try {
      setModerating(true);
      const response = await authorizedFetch(`${API_BASE}/build_comments.php?action=moderate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment_id: commentId,
          action: action // 'approve' or 'reject'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        await fetchComments();
        await fetchStats();
        setSelectedComment(null);
      }
    } catch (err) {
      console.error('Failed to moderate comment:', err);
    } finally {
      setModerating(false);
    }
  };

  // Delete comment
  const deleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) return;
    
    try {
      const response = await authorizedFetch(`${API_BASE}/build_comments.php?action=delete&comment_id=${commentId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        await fetchComments();
        await fetchStats();
        setSelectedComment(null);
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Get user display name
  const getUserDisplayName = (comment) => {
    if (comment.first_name && comment.last_name) {
      return `${comment.first_name} ${comment.last_name}`;
    }
    return comment.username || 'Anonymous';
  };

  // Get status badge
  const getStatusBadge = (isApproved) => {
    if (isApproved === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3" />
          Approved
        </span>
      );
    } else if (isApproved === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <AlertTriangle className="w-3 h-3" />
          Pending
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Comment Moderation</h3>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Comments</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pending Review</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <div className="text-sm text-gray-600">Approved</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-sm text-gray-600">Rejected</div>
          </div>
        </div>
        
        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {[
            { id: 'all', label: 'All Comments' },
            { id: 'pending', label: 'Pending' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' }
          ].map(filterOption => (
            <button
              key={filterOption.id}
              onClick={() => setFilter(filterOption.id)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                filter === filterOption.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Comments List */}
      <div className="p-6">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No comments found for the selected filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map(comment => (
              <div key={comment.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {getUserDisplayName(comment)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(comment.created_at)}</span>
                        {comment.is_edited && (
                          <span className="text-xs text-gray-400">(edited)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getStatusBadge(comment.is_approved)}
                    <button
                      onClick={() => setSelectedComment(comment)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="text-gray-800 mb-3">
                  {comment.comment_text}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Build ID: {comment.build_id}
                  </div>
                  
                  {comment.is_approved === 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => moderateComment(comment.id, 'approve')}
                        disabled={moderating}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        onClick={() => moderateComment(comment.id, 'reject')}
                        disabled={moderating}
                        className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Comment Detail Modal */}
      {selectedComment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Comment Details</h3>
                <button
                  onClick={() => setSelectedComment(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">{getUserDisplayName(selectedComment)}</span>
                  {getStatusBadge(selectedComment.is_approved)}
                </div>
                <div className="text-sm text-gray-500">
                  {formatDate(selectedComment.created_at)}
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-gray-800 whitespace-pre-wrap">
                  {selectedComment.comment_text}
                </div>
              </div>
              
              <div className="flex gap-3">
                {selectedComment.is_approved === 0 && (
                  <>
                    <button
                      onClick={() => moderateComment(selectedComment.id, 'approve')}
                      disabled={moderating}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => moderateComment(selectedComment.id, 'reject')}
                      disabled={moderating}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => deleteComment(selectedComment.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentModeration;
