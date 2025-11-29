import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, User, Trash2 } from 'lucide-react';
import { API_BASE } from '../utils/apiBase';
const CHAT_BASE = `${API_BASE}/chat.php`;

// Helper function to get auth headers (mirrors Admin/Employee chat pages)
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const ChatSupport = ({ user, customStyles = {}, hideHeader = false }) => {
  const {
    containerClass = '',
    messagesAreaClass = '',
    messagesAreaStyle = {},
    messagesMaxHeight,
    messagesWrapperClass = '',
    suggestionListClass = '',
    inputAreaClass = '',
  } = customStyles || {};
  // State declarations and hooks
  const [sessionId, setSessionId] = useState(() => {
    const stored = localStorage.getItem('builditpc_chat_session_id');
    // Convert to number if it's a valid number string, otherwise null
    if (stored && stored !== 'null' && stored !== '0') {
      const num = parseInt(stored, 10);
      return isNaN(num) ? null : num;
    }
    return null;
  });
  const [guestName, setGuestName] = useState(() => localStorage.getItem('builditpc_guest_name') || '');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('open');  // 'open' or 'resolved'
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [tempGuestName, setTempGuestName] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showQuickSuggestions, setShowQuickSuggestions] = useState(false);
  const suggestionListRef = useRef(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);
  const suggestionGroups = [
    {
      title: 'BuildIt PC System',
      items: [
        'How do I use the BuildIt PC compatibility checker?',
        'How are prebuilt PC prices calculated in your system?',
        'Where can I see current stock availability for parts?',
        'Can I get notified when an out-of-stock part is available?',
        'How do I contact support about an issue with my account?',
      ],
    },
    {
      title: 'Account & Orders',
      items: [
        'How can I reset or change my password?',
        'How do I track my order status on your site?',
        'Can I cancel an order before it is processed?',
        'How do I update my shipping address on an existing order?',
        'How do I view my past orders and invoices?',
      ],
    },
    {
      title: 'Shop Information',
      items: [
        'Where is the BuildIt PC shop located?',
        'What is the contact number for the shop?',
        'Where can I view prices for each product?',
        'What services does your shop offer?',
      ],
    },
    {
      title: 'PC Building (General)',
      items: [
        'What CPU and GPU do you recommend for 1080p gaming?',
        'How much wattage should my power supply have for my build?',
        'What RAM speed and capacity do you recommend for gaming?',
        'How do I choose a compatible motherboard for my CPU?',
        'Should I pick an SSD or HDD for my primary drive?',
      ],
    },
  ];

  // Update last seen timestamp when chat is opened
  const updateLastSeen = async () => {
    if (!user?.id || !sessionId) return;
    
    try {
      await fetch(`${CHAT_BASE}?update_last_seen`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          user_id: user.id,
          session_id: sessionId
        })
      });
    } catch (error) {
      console.error('Error updating last seen:', error);
    }
  };

  // Poll for new messages every 2 seconds
  useEffect(() => {
    if (!sessionId) return;
    
    // Update last seen when component mounts
    updateLastSeen();
    
    const fetchMessages = async () => {
      try {
        const url = `${CHAT_BASE}?messages&session_id=${sessionId}${user ? `&user_id=${user.id}` : guestName ? `&guest_name=${encodeURIComponent(guestName)}` : ''}`;
        const res = await fetch(url, {
          headers: getAuthHeaders()
        });
        const data = await res.json();
        if (data.success) {
          // If session was deleted, clear the session and reset
          if (data.session_deleted) {
            setSessionId(null);
            localStorage.removeItem('builditpc_chat_session_id');
            setMessages([]);
            setError(null);
            return;
          }
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };
    
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [sessionId, user, guestName]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (isUserAtBottom && messagesContainerRef.current) {
      // Use scrollTo for better control
      const container = messagesContainerRef.current;
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [messages, isUserAtBottom]);

  // Save guest info
  useEffect(() => {
    if (guestName) localStorage.setItem('builditpc_guest_name', guestName);
  }, [guestName]);

  // Create a new chat session in the backend
  const createSession = async (messageOverride) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${CHAT_BASE}?send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          session_id: null,
          sender: 'user',
          message: messageOverride ?? newMessage,
          guest_name: !user ? guestName : undefined,
          guest_email: null, // Email removed - using name only
          user_id: user ? user.id : undefined
        })
      });
      const data = await res.json();
      if (data.error) {
        // If session is invalid, clear it and allow retry
        if (data.error.includes('Invalid chat session')) {
          setSessionId(null);
          localStorage.removeItem('builditpc_chat_session_id');
          setMessages([]);
        }
        throw new Error(data.error);
      }
      
      // Get the session ID from the response
      if (data.session_id) {
        const sessionIdNum = parseInt(data.session_id, 10);
        if (!isNaN(sessionIdNum) && sessionIdNum > 0) {
          setSessionId(sessionIdNum);
          localStorage.setItem('builditpc_chat_session_id', sessionIdNum.toString());
          setSessionStatus('open');
        }
      }
      
      setNewMessage('');
      setIsUserAtBottom(true);
    } catch (e) {
      setError('Failed to start chat session: ' + e.message);
    }
    setLoading(false);
  };

  // Send a message to the backend
  const sendMessage = async (messageOverride) => {
    const messageToSend = (messageOverride ?? newMessage).trim();
    if (!messageToSend) return;
    setLoading(true);
    setError(null);
    
    try {
      if (!sessionId) {
        await createSession(messageToSend);
        return;
      }
      
      const res = await fetch(`${CHAT_BASE}?send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          session_id: sessionId && sessionId > 0 ? sessionId : null,
          sender: 'user',
          message: messageToSend,
          user_id: user ? user.id : undefined,
          guest_name: !user ? guestName : undefined
        })
      });
      
      const data = await res.json();
      if (data.error) {
        // If session is invalid, clear it and allow retry
        if (data.error.includes('Invalid chat session')) {
          setSessionId(null);
          localStorage.removeItem('builditpc_chat_session_id');
          setMessages([]);
        }
        throw new Error(data.error);
      }
      
      setNewMessage('');
      setIsUserAtBottom(true);
    } catch (e) {
      setError('Failed to send message: ' + e.message);
    }
    setLoading(false);
  };
  
  const handleQuickAsk = (question) => {
    if (loading || sessionStatus === 'resolved') return;
    setShowQuickSuggestions(false);
    sendMessage(question);
  };
  
  useEffect(() => {
    if (showQuickSuggestions && suggestionListRef.current) {
      suggestionListRef.current.scrollTop = 0;
    }
  }, [showQuickSuggestions]);

  // Clear conversation
  const clearConversation = async () => {
    if (!window.confirm('Are you sure you want to clear this conversation? This cannot be undone.')) {
      return;
    }
    
    try {
      await fetch(`${CHAT_BASE}?delete_session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ session_id: sessionId })
      });
      
      setSessionId(null);
      localStorage.removeItem('builditpc_chat_session_id');
      setMessages([]);
      setUnreadCount(0);
      setSessionStatus('open');
    } catch (error) {
      setError('Failed to clear conversation');
    }
  };

  const handleMessagesScroll = () => {
    if (!messagesContainerRef.current) return;
    const el = messagesContainerRef.current;
    const threshold = 64;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    setIsUserAtBottom(atBottom);
  };

  // Guest info form
  if (!user && !guestName) {
    const handleGuestContinue = () => {
      if (!tempGuestName.trim()) return;
      setGuestName(tempGuestName.trim());
    };
    
    return (
      <div className="flex flex-col items-center h-full max-h-[600px] py-4 px-6">
        <div className="bg-white rounded-lg w-full max-w-md">
          <div className="text-center mb-6">
            <MessageSquare className="w-10 h-10 text-green-600 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-gray-800 mb-1">Start Chat Support</h2>
            <p className="text-sm text-gray-600">Get help from our expert team</p>
          </div>
          
          <div className="space-y-4 px-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="Enter your name"
                value={tempGuestName}
                onChange={e => setTempGuestName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleGuestContinue(); }}
              />
            </div>
            
            <div className="pb-4">
              <button
                className="w-full bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                onClick={handleGuestContinue}
                disabled={!tempGuestName.trim()}
              >
                Start Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CSS for custom scrollbar - Enhanced visibility and responsiveness
  const scrollbarStyles = `
    :root {
      --chat-scrollbar-width: 12px;
      --chat-scrollbar-track: #dbeafe;
      --chat-scrollbar-thumb: #15803d;
      --chat-scrollbar-thumb-hover: #0f5132;
      --chat-scrollbar-thumb-active: #0a3823;
    }

    .chat-scrollbar-visible {
      scrollbar-gutter: stable both-edges;
      scrollbar-width: auto;
      scrollbar-color: var(--chat-scrollbar-thumb) var(--chat-scrollbar-track);
      -webkit-overflow-scrolling: touch;
      overflow-y: scroll !important;
      overflow-x: hidden !important;
      overscroll-behavior: contain;
    }

    .chat-scrollbar-visible::-webkit-scrollbar {
      width: var(--chat-scrollbar-width) !important;
      height: var(--chat-scrollbar-width) !important;
    }

    .chat-scrollbar-visible::-webkit-scrollbar-track {
      background: var(--chat-scrollbar-track) !important;
      border-radius: 999px !important;
      border: 1px solid #93c5fd !important;
      box-shadow: inset 0 0 6px rgba(15, 23, 42, 0.18);
    }

    .chat-scrollbar-visible::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, #22c55e, var(--chat-scrollbar-thumb)) !important;
      border-radius: 999px !important;
      border: 3px solid #ecfccb !important;
      min-height: 32px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.3);
    }

    .chat-scrollbar-visible::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(180deg, #16a34a, var(--chat-scrollbar-thumb-hover)) !important;
    }

    .chat-scrollbar-visible::-webkit-scrollbar-thumb:active {
      background: linear-gradient(180deg, #15803d, var(--chat-scrollbar-thumb-active)) !important;
    }

    .chat-scrollbar-visible::-webkit-scrollbar-corner {
      background: var(--chat-scrollbar-track) !important;
    }

    .messages-area,
    .quick-questions-scroll {
      position: relative;
      padding-right: 0.5rem;
    }

    /* Ensure messages area is scrollable */
    .messages-area {
      overflow-y: scroll !important;
      overflow-x: hidden !important;
      -webkit-overflow-scrolling: touch !important;
      will-change: scroll-position;
    }

    /* Force scrollbar to be visible when content overflows */
    .chat-messages-wrapper {
      display: flex;
      flex-direction: column;
      min-height: 0;
      flex: 1;
    }

    /* Slightly slimmer scrollbars for small screens but keep contrast */
    @media (max-width: 640px) {
      .chat-scrollbar-visible::-webkit-scrollbar {
        width: 9px !important;
        height: 9px !important;
      }
    }
  `;

  return (
    <div className={`flex flex-col h-full bg-white ${containerClass}`}>
      <style>{scrollbarStyles}</style>
      
      {/* Header with clear button (can be hidden by parent) */}
      {!hideHeader && (
        <div className="border-b border-gray-200 bg-white p-3 flex justify-end">
          {sessionId && (
            <button
              onClick={clearConversation}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors"
              title="Clear Conversation"
            >
              <Trash2 className="w-4 h-4" />
              Clear Chat
            </button>
          )}
        </div>
      )}




      {/* Chat area */}
      <div className={`relative flex flex-col overflow-hidden chat-messages-wrapper ${messagesWrapperClass}`} style={{ flexShrink: 0 }}>
        <div
          ref={messagesContainerRef}
          className={`overflow-y-scroll overflow-x-hidden custom-scrollbar chat-scrollbar-visible messages-area ${messagesAreaClass}`} 
          style={{ 
            height: messagesMaxHeight || '280px',
            maxHeight: messagesMaxHeight || '280px',
            minHeight: messagesMaxHeight || '280px',
            width: '100%',
            flexShrink: 0,
            WebkitOverflowScrolling: 'touch',
            scrollbarGutter: 'stable both-edges',
            overflowY: 'scroll',
            overflowX: 'hidden',
            position: 'relative',
            display: 'block',
            ...messagesAreaStyle
          }}
          onScroll={handleMessagesScroll}
        >
          <div className="p-6 space-y-4" style={{ minHeight: '281px' }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-start min-h-[250px] pt-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Welcome to BuildIT PC Support</h3>
              <p className="text-sm text-gray-600 text-center max-w-sm mb-6">
                Our support team is here to help! Type your message below.
              </p>
              {/* Quick questions when empty */}
              <div className="w-full max-w-3xl">
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`flex items-start gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>

                <div className={`group relative rounded-lg px-4 py-3 max-w-[80%] shadow-sm ${
                  msg.sender === 'user' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <div className="text-sm whitespace-pre-wrap">{msg.message || ''}</div>
                  <div className={`text-xs mt-1 ${
                    msg.sender === 'user' ? 'text-green-100' : 'text-gray-500'
                  }`}>
                    {new Date(msg.sent_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          
          <div ref={messagesEndRef} style={{ minHeight: '1px' }} />
        </div>
      </div>
        
        {showQuickSuggestions && (
          <div className="absolute inset-0 bg-white z-20 flex flex-col chat-messages-wrapper">
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Quick questions
              </span>
            </div>
            <div
              ref={suggestionListRef}
              className={`flex-1 overflow-y-scroll overflow-x-hidden px-6 py-4 space-y-4 custom-scrollbar chat-scrollbar-visible quick-questions-scroll ${suggestionListClass}`}
              style={{ minHeight: 0, scrollbarGutter: 'stable both-edges' }}
            >
              {suggestionGroups.map(group => (
                <div key={group.title}>
                  <div className="text-xs font-semibold text-gray-500 mb-2">{group.title}</div>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map(q => (
                      <button
                        key={q}
                        onClick={() => handleQuickAsk(q)}
                        className="text-xs md:text-sm px-3 py-2 rounded-full border border-gray-300 hover:border-green-500 hover:text-green-700 hover:bg-green-50 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className={`mt-auto border-t bg-white ${inputAreaClass}`}>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 text-center text-sm">
            {error}
          </div>
        )}
        
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Quick questions
            </span>
            <button
              type="button"
              onClick={() => setShowQuickSuggestions(prev => !prev)}
              className="text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
              disabled={loading || sessionStatus === 'resolved'}
              aria-expanded={showQuickSuggestions}
            >
              {showQuickSuggestions ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="p-4 flex items-center gap-3">
          {sessionId && (
            <button
              onClick={clearConversation}
              className="p-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              title="Clear Conversation"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <input
            type="text"
            className="flex-grow p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder={sessionStatus === 'resolved' ? 'Chat resolved. Start a new conversation...' : 'Type your message...'}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={loading || sessionStatus === 'resolved'}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !newMessage.trim() || sessionStatus === 'resolved'}
            className={`p-3 rounded-lg font-semibold flex items-center gap-2 transition-colors min-w-[90px] justify-center ${
              loading || sessionStatus === 'resolved'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            <Send className="w-5 h-5" />
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>

        {/* Session status indicator */}
        {sessionStatus === 'resolved' && (
          <div className="bg-yellow-50 border-t border-yellow-100 px-4 py-2 text-center text-sm text-yellow-700">
            This chat has been marked as resolved. Start a new conversation to continue.
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSupport; 