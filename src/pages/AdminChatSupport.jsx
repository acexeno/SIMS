import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Search, CheckCircle, Trash2, User, UserCheck, User2, AlertTriangle, Clock, BarChart3, RefreshCw, Send, MoreVertical, Phone, Video } from 'lucide-react';
import { API_BASE } from '../utils/apiBase';
const CHAT_BASE = `${API_BASE}/chat.php`;

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Accept user prop for role/status coloring
const AdminChatSupport = ({ user }) => {
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [search, setSearch] = useState('');
  const [reply, setReply] = useState('');
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      
      if (isAtBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Helper for role badge color
  const getRoleBadge = (roles) => {
    if (!roles) return null;
    if (roles.includes('Admin')) return <span className="inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold ml-2">Admin</span>;
    if (roles.includes('Employee')) return <span className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold ml-2">Employee</span>;
    return null;
  };

  // Helper for status badge color
  const getStatusBadge = (isActive) => {
    return isActive
      ? <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold ml-2">Active</span>
      : <span className="inline-block bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-semibold ml-2">Disabled</span>;
  };

  // Helper for priority badge
  const getPriorityBadge = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-700',
      normal: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700'
    };
    return (
      <span className={`inline-block ${colors[priority] || colors.normal} px-2 py-0.5 rounded-full text-xs font-semibold`}>
        {priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Normal'}
      </span>
    );
  };

  // Fetch chat statistics
  const fetchStats = async () => {
    try {
      const res = await fetch(`${CHAT_BASE}?stats`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch all chat sessions
  const fetchChats = async (skipLoadingState = false) => {
    if (!skipLoadingState) setLoadingChats(true);
    try {
      const res = await fetch(`${CHAT_BASE}?sessions`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        const newChats = data.sessions || [];
        // Only update state if chats actually changed to prevent unnecessary re-renders
        setChats(prevChats => {
          const prevJson = JSON.stringify(prevChats);
          const newJson = JSON.stringify(newChats);
          if (prevJson !== newJson) {
            return newChats;
          }
          return prevChats; // Return previous to prevent re-render
        });
        // Only set selectedChatId if chats changed and we don't have one selected
        if (newChats.length > 0 && !selectedChatId) {
          setSelectedChatId(newChats[0].id);
        }
      } else if (data.error) {
        setError(data.error);
      }
    } catch (error) {
        setError('Failed to load chat sessions.');
    }
    if (!skipLoadingState) setLoadingChats(false);
  };

  // Fetch messages for selected chat
  const fetchMessages = async (skipLoadingState = false) => {
    if (!selectedChatId) return;
    if (!skipLoadingState) setLoadingMessages(true);
    try {
      const res = await fetch(`${CHAT_BASE}?messages&session_id=${selectedChatId}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        const newMessages = data.messages || [];
        // Only update state if messages actually changed to prevent unnecessary re-renders
        setMessages(prevMessages => {
          const prevJson = JSON.stringify(prevMessages);
          const newJson = JSON.stringify(newMessages);
          if (prevJson !== newJson) {
            return newMessages;
          }
          return prevMessages; // Return previous to prevent re-render
        });
      }
    } catch (error) {
        setError('Failed to load messages.');
    }
    if (!skipLoadingState) setLoadingMessages(false);
  };

  // Initial load
  useEffect(() => {
    fetchChats();
    fetchStats();
  }, []);

  // Filter chats based on search and remove debug/test users
  const filteredChats = chats.filter(chat => {
    const searchTerm = search.toLowerCase();
    const username = (chat.username || '').toLowerCase();
    const guestName = (chat.guest_name || '').toLowerCase();
    const email = (chat.guest_email || '').toLowerCase();

    // Exclude debug/test users
    const isDebugOrTestUser = [
      'debug test user',
      'test user',
      'debug@test.com',
      'test@example.com'
    ].some(str => guestName === str || email === str || username === str);
    if (isDebugOrTestUser) return false;

    // Existing search filter logic (if any)
    return (
      !searchTerm ||
      username.includes(searchTerm) ||
      guestName.includes(searchTerm) ||
      email.includes(searchTerm)
    );
  });

  // After filteredChats is defined
  useEffect(() => {
    // If the selected chat is not in the filtered list, update selection
    if (filteredChats.length === 0) {
      setSelectedChatId(null);
    } else if (!filteredChats.some(chat => chat.id === selectedChatId)) {
      setSelectedChatId(filteredChats[0].id);
    }
    // Only run this effect when filteredChats or selectedChatId changes
  }, [filteredChats, selectedChatId]);

  // Fetch messages when chat selection changes
  useEffect(() => {
    if (selectedChatId) {
      fetchMessages();
    }
  }, [selectedChatId]);

  // Auto-refresh chats every 15 seconds (increased to reduce blinking)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchChats(true); // Skip loading state to prevent UI flicker
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh messages every 8 seconds (increased to reduce blinking)
  useEffect(() => {
    if (!selectedChatId) return;
    const interval = setInterval(() => {
      fetchMessages(true); // Skip loading state to prevent UI flicker
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedChatId]);

  // Get selected chat details
  const selectedChat = chats.find(chat => chat.id === selectedChatId);

  // Send reply
  const handleSendReply = async () => {
    if (!reply.trim() || !selectedChatId) return;
    
    try {
      const res = await fetch(`${CHAT_BASE}?send`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
        body: JSON.stringify({
          session_id: selectedChatId,
          message: reply.trim(),
          sender: 'admin'
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setReply('');
        fetchMessages();
        fetchChats(); // Refresh chat list to update unread counts
      }
    } catch (error) {
      setError('Failed to send message.');
    }
  };

  // Mark chat as resolved
  const handleMarkResolved = async () => {
    setShowResolveModal(true);
  };

  // Reopen chat
  const handleReopenChat = async () => {
    try {
      const res = await fetch(`${CHAT_BASE}?reopen`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ session_id: selectedChatId })
      });
      
      const data = await res.json();
      if (data.success) {
        fetchChats();
        fetchMessages();
      }
    } catch (error) {
      setError('Failed to reopen chat.');
    }
  };

  // Update priority
  const handleUpdatePriority = async (priority) => {
    try {
      const res = await fetch(`${CHAT_BASE}?update_priority`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ session_id: selectedChatId, priority })
      });
      
      const data = await res.json();
      if (data.success) {
        fetchChats();
      }
    } catch (error) {
      setError('Failed to update priority.');
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId) => {
    // Validate message ID before proceeding
    if (!messageId || messageId === null || messageId === undefined || messageId === 0) {
      setError('Invalid message ID');
      console.error('Cannot delete message: messageId is', messageId);
      return;
    }
    
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    try {
      const res = await fetch(`${CHAT_BASE}?delete_message`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ message_id: Number(messageId) })
    });
      
      const data = await res.json();
      if (data.success) {
        fetchMessages();
      } else {
        setError(data.error || 'Failed to delete message.');
      }
    } catch (error) {
      setError('Failed to delete message: ' + error.message);
      console.error('Delete message error:', error);
    }
  };

  // Delete chat session
  const handleDeleteSession = async (chatId) => {
    // Validate chatId before proceeding
    if (!chatId || chatId === 0 || chatId === '0') {
      setError('Invalid chat session ID');
      console.error('Cannot delete: chatId is', chatId);
      return;
    }
    
    if (!confirm('Are you sure you want to delete this chat session? This action cannot be undone.')) return;
    
    try {
      const res = await fetch(`${CHAT_BASE}?delete_session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ session_id: parseInt(chatId, 10) })
      });
      
      const data = await res.json();
      if (data.success) {
        if (selectedChatId === chatId) {
          setSelectedChatId(null);
          setMessages([]);
        }
        fetchChats();
      } else {
        setError(data.error || 'Failed to delete chat session.');
        console.error('Delete session error:', data);
      }
    } catch (error) {
      setError('Failed to delete chat session: ' + error.message);
      console.error('Delete session error:', error);
    }
  };

  // Confirm resolve with notes
  const confirmResolve = async () => {
    try {
      const res = await fetch(`${CHAT_BASE}?resolve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ 
          session_id: selectedChatId, 
          resolution_notes: resolutionNotes 
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setShowResolveModal(false);
        setResolutionNotes('');
        fetchChats();
        fetchMessages();
      }
    } catch (error) {
      setError('Failed to resolve chat.');
    }
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden" style={{ margin: 0, padding: 0 }}>
      {/* Sidebar: Chat List */}
      <div className="w-1/3 min-w-[350px] max-w-sm border-r bg-white flex flex-col shadow-lg h-full">
        {/* Header with stats toggle */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="page-title">Chat Support</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStats(!showStats)}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Toggle Statistics"
            >
              <BarChart3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => { fetchChats(); fetchStats(); }}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Statistics Panel */}
        {showStats && stats && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 border-b border-blue-200 flex-shrink-0">
            <h3 className="font-semibold text-blue-800 mb-2 text-sm">Today's Statistics</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2 rounded-lg border shadow-sm">
                <div className="text-blue-600 font-bold text-lg">{stats.open_sessions}</div>
                <div className="text-gray-600 text-xs">Open Chats</div>
              </div>
              <div className="bg-white p-2 rounded-lg border shadow-sm">
                <div className="text-green-600 font-bold text-lg">{stats.today_sessions}</div>
                <div className="text-gray-600 text-xs">Today's Total</div>
              </div>
              <div className="bg-white p-2 rounded-lg border shadow-sm">
                <div className="text-purple-600 font-bold text-lg">{stats.total_sessions}</div>
                <div className="text-gray-600 text-xs">All Time</div>
              </div>
              <div className="bg-white p-2 rounded-lg border shadow-sm">
                <div className="text-orange-600 font-bold text-lg">{stats.avg_response_time}m</div>
                <div className="text-gray-600 text-xs">Avg Response</div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search user or email..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent bg-gray-50"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {loadingChats ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Loading chats...
            </div>
          ) : (
            <div className="p-4">
              {filteredChats.map(chat => (
                <div
                  key={chat.id}
                  className={`p-4 rounded-lg cursor-pointer transition-all duration-200 mb-2 ${
                    selectedChatId === chat.id 
                      ? 'bg-green-50 border-2 border-green-500 shadow-lg' 
                      : 'hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedChatId(chat.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="font-semibold truncate flex items-center gap-2">
                          {!chat.user_id
                            ? (<><User2 className="inline w-5 h-5 text-gray-400" title="Guest" />{chat.guest_name || 'Guest'}</>)
                            : (<><UserCheck className="inline w-5 h-5 text-green-500" title="Registered User" />{chat.username || `User #${chat.user_id}`}</>)}
                        </div>
                        {getPriorityBadge(chat.priority)}
                      </div>
                      <div className="text-sm text-gray-500 truncate mb-1">{chat.guest_email || ''}</div>
                      <div className="text-xs text-gray-400">
                        {chat.last_message_time ? new Date(chat.last_message_time).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        }) : ''}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-3">
                      {Number(chat.unread_messages || 0) > 0 && (
                        <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold min-w-[22px] text-center">
                          {Number(chat.unread_messages)}
                        </div>
                      )}
                      
                      {chat.status === 'resolved' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" title="Resolved" />
                      ) : (
                        <MessageSquare className="w-5 h-5 text-blue-500" title="Open" />
                      )}
                      
                      <button
                        className="text-red-400 hover:text-red-600 opacity-80 hover:opacity-100 transition-opacity"
                        title="Delete chat session"
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteSession(chat.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredChats.length === 0 && !loadingChats && (
                <div className="text-center py-12 text-gray-400">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <div className="text-lg font-medium mb-2">No chats found</div>
                  <div className="text-sm">Start a conversation to see it here</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden h-full min-h-0">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 text-center text-sm flex-shrink-0">
            {error}
          </div>
        )}
        
        {selectedChat ? (
          <div className="flex flex-col h-full min-h-0">
            {/* Header Bar */}
            <div className="flex items-center justify-between bg-white px-6 py-6 border-b border-gray-200 shadow-sm flex-shrink-0">
              <div className="flex-1">
                <div className="font-bold text-xl flex items-center gap-3 mb-2">
                  {!selectedChat.user_id
                    ? (<><User2 className="inline w-6 h-6 text-gray-400" title="Guest" />{selectedChat.guest_name || 'Guest'}</>)
                    : (<><UserCheck className="inline w-6 h-6 text-green-500" title="Registered User" />{selectedChat.username || `User #${selectedChat.user_id}`}</>)}
                  {getRoleBadge(user?.roles || [])}
                  {/* Show chat session status instead of account status */}
                  <span className={`inline-block ${selectedChat.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'} px-2 py-0.5 rounded-full text-xs font-semibold`}>
                    {selectedChat.status === 'resolved' ? 'Resolved' : 'Open'}
                  </span>
                  {/* Only show account status if explicitly provided as boolean */}
                  {typeof user?.is_active === 'boolean' && getStatusBadge(!!user.is_active)}
                  {getPriorityBadge(selectedChat.priority)}
                </div>
                <div className="text-sm text-gray-500 mb-1">{selectedChat.guest_email || ''}</div>
                <div className="text-xs text-gray-400">
                  Created {selectedChat.created_at ? new Date(selectedChat.created_at).toLocaleDateString() : ''}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Priority Selector */}
                <select
                  value={selectedChat.priority || 'normal'}
                  onChange={(e) => handleUpdatePriority(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                >
                  <option value="low">Low Priority</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                
                {selectedChat.status === 'resolved' ? (
                  <button
                    className="bg-blue-500 text-white px-6 py-2 rounded-lg flex items-center hover:bg-blue-600 transition-colors shadow-sm"
                    onClick={handleReopenChat}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Reopen
                  </button>
                ) : (
                  <button
                    className="bg-green-500 text-white px-6 py-2 rounded-lg flex items-center hover:bg-green-600 transition-colors shadow-sm"
                    onClick={handleMarkResolved}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" /> Resolve
                  </button>
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 p-4 min-h-0"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#9ca3af #f1f5f9',
                flex: '1 1 auto',
                minHeight: '0px'
              }}
            >
              {loadingMessages ? (
                <div className="flex items-center justify-center h-32 text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <div className="text-lg font-medium mb-2">No messages yet</div>
                    <div className="text-sm">Start the conversation by sending a message</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div key={msg.id || idx} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`group relative max-w-xs lg:max-w-md xl:max-w-lg ${
                        msg.sender === 'admin' ? 'ml-auto' : 'mr-auto'
                      }`}>
                        {/* Chat Bubble */}
                        <div className={`relative rounded-2xl px-5 py-4 shadow-sm ${
                          msg.sender === 'admin' 
                            ? 'bg-green-500 text-white' 
                            : msg.message_type === 'system'
                            ? 'bg-gray-200 text-gray-700 border border-gray-300'
                            : 'bg-white text-gray-800 border border-gray-200'
                        }`}>
                          {/* Delete button - visible on hover */}
                          {(msg.id && msg.id > 0) ? (
                            <button
                              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 z-10 shadow-lg"
                              title="Delete message"
                              onClick={() => handleDeleteMessage(msg.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : null}
                          
                          {/* Message content */}
                          <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                            {msg.message || ''}
                          </div>
                          
                          {/* Message type indicator */}
                          {msg.message_type !== 'text' && (
                            <div className="text-xs opacity-70 mt-2 pt-2 border-t border-opacity-20">
                              {msg.message_type}
                            </div>
                          )}
                        </div>
                        
                        {/* Timestamp */}
                        <div className={`text-xs text-gray-500 mt-2 ${
                          msg.sender === 'admin' ? 'text-right' : 'text-left'
                        }`}>
                          {msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          }) : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area - Fixed at bottom */}
            <div className="px-6 py-4 border-t border-gray-200 bg-white flex-shrink-0 sticky bottom-0">
              <div className="flex items-center gap-3">
                                  <div className="flex-1 relative">
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-2xl px-6 py-3 pr-16 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent resize-none text-base"
                      placeholder="Type your reply..."
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { 
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply(); 
                        }
                      }}
                    />
                  </div>
                <button
                  className="bg-green-500 text-white p-2 rounded-full hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  onClick={handleSendReply}
                  disabled={!reply.trim()}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="w-24 h-24 mx-auto mb-6 opacity-50" />
              <div className="text-2xl font-medium mb-3">Select a chat to view messages</div>
              <div className="text-base">Choose a conversation from the sidebar to start responding</div>
            </div>
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">Resolve Chat Session</h3>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
              placeholder="Add resolution notes (optional)..."
              value={resolutionNotes}
              onChange={e => setResolutionNotes(e.target.value)}
              rows={4}
            />
            <div className="flex gap-3 justify-end">
              <button
                className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                onClick={() => {
                  setShowResolveModal(false);
                  setResolutionNotes('');
                }}
              >
                Cancel
              </button>
              <button
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                onClick={confirmResolve}
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminChatSupport; 