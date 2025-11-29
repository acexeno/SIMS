import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  Send, 
  Edit2, 
  Trash2, 
  Reply, 
  MoreVertical,
  User,
  Clock,
  CheckCircle
} from 'lucide-react';
import { API_BASE } from '../utils/apiBase';
import { authorizedFetch } from '../utils/auth';

const CommentsSection = ({ 
  buildId, 
  user, 
  className = '' 
}) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');
  const [showActions, setShowActions] = useState({});
  const [error, setError] = useState('');

  // Fetch comments
  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/build_comments.php?action=list&build_id=${buildId}`);
      const result = await response.json();
      
      if (result.success) {
        setComments(result.data);
      } else {
        setError(result.error || 'Failed to load comments');
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
      setError('Failed to load comments. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (buildId) {
      fetchComments();
    }
  }, [buildId]);

  // Submit new comment
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    
    if (!newComment.trim() || submitting) return;
    
    try {
      setSubmitting(true);
      setError('');
      
      const response = await authorizedFetch(`${API_BASE}/build_comments.php?action=add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          build_id: buildId,
          comment_text: newComment.trim(),
          parent_id: replyingTo
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setNewComment('');
        setReplyingTo(null);
        await fetchComments(); // Refresh comments
      } else {
        setError(result.error || 'Failed to submit comment');
      }
    } catch (err) {
      console.error('Comment submission error:', err);
      setError('Failed to submit comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit comment
  const handleEditComment = async (commentId) => {
    if (!editText.trim()) return;
    
    try {
      const response = await authorizedFetch(`${API_BASE}/build_comments.php?action=edit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment_id: commentId,
          comment_text: editText.trim()
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setEditingComment(null);
        setEditText('');
        await fetchComments();
      } else {
        setError(result.error || 'Failed to update comment');
      }
    } catch (err) {
      setError('Failed to update comment');
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      const response = await authorizedFetch(`${API_BASE}/build_comments.php?action=delete&comment_id=${commentId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        await fetchComments();
      } else {
        setError(result.error || 'Failed to delete comment');
      }
    } catch (err) {
      setError('Failed to delete comment');
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    
    return date.toLocaleDateString();
  };

  // Get user display name
  const getUserDisplayName = (comment) => {
    if (comment.first_name && comment.last_name) {
      return `${comment.first_name} ${comment.last_name}`;
    }
    return comment.username || 'Anonymous';
  };

  // Check if user can edit/delete comment
  const canModifyComment = (comment) => {
    return user && (user.id === comment.user_id || user.role === 'admin' || user.role === 'super_admin');
  };

  // Render comment
  const renderComment = (comment, depth = 0) => {
    const isReply = depth > 0;
    
    return (
      <div key={comment.id} className={`${isReply ? 'ml-8 mt-3' : 'mb-4'}`}>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 mb-2">
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
            
            {canModifyComment(comment) && (
              <div className="relative">
                <button
                  onClick={() => setShowActions(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                  className="p-1 hover:bg-gray-200 rounded-full"
                >
                  <MoreVertical className="w-4 h-4 text-gray-500" />
                </button>
                
                {showActions[comment.id] && (
                  <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => {
                        setEditingComment(comment.id);
                        setEditText(comment.comment_text);
                        setShowActions(prev => ({ ...prev, [comment.id]: false }));
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        handleDeleteComment(comment.id);
                        setShowActions(prev => ({ ...prev, [comment.id]: false }));
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {editingComment === comment.id ? (
            <div className="mt-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg resize-none"
                rows="3"
                maxLength="1000"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleEditComment(comment.id)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingComment(null);
                    setEditText('');
                  }}
                  className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-800 whitespace-pre-wrap">
              {comment.comment_text}
            </div>
          )}
          
          {!isReply && user && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setReplyingTo(comment.id)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Reply className="w-3 h-3" />
                Reply
              </button>
            </div>
          )}
          
          {/* Render replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3">
              {comment.replies.map(reply => renderComment(reply, depth + 1))}
            </div>
          )}
        </div>
      </div>
    );
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
          <MessageCircle className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Comments ({comments.length})
          </h3>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        
        {/* Add comment form */}
        {user ? (
          <form onSubmit={handleSubmitComment} className="mb-6">
            <div className="space-y-3">
              <div>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="3"
                  maxLength="1000"
                  required
                />
                <div className="flex justify-between items-center mt-1">
                  <div className="text-xs text-gray-500">
                    {newComment.length}/1000 characters
                  </div>
                  <button
                    type="submit"
                    disabled={!newComment.trim() || submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                  >
                    {submitting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {replyingTo ? 'Reply' : 'Comment'}
                  </button>
                </div>
              </div>
            </div>
            
            {replyingTo && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel reply
                </button>
              </div>
            )}
          </form>
        ) : (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-gray-600">
              Please <a href="/login" className="text-blue-600 hover:underline">login</a> to comment
            </p>
          </div>
        )}
      </div>
      
      {/* Comments list */}
      <div className="p-6">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map(comment => renderComment(comment))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentsSection;
