import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, User, Trash2 } from 'lucide-react';
import { API_BASE } from '../utils/apiBase';
const CHAT_BASE = `${API_BASE}/chat.php`;

// Helper function to get auth headers (mirrors Admin/Employee chat pages)
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const ChatSupport = ({ user, customStyles = {} }) => {
  // State declarations and hooks
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('builditpc_chat_session_id') || null);
  const [guestName, setGuestName] = useState(() => localStorage.getItem('builditpc_guest_name') || '');
  const [guestEmail, setGuestEmail] = useState(() => localStorage.getItem('builditpc_guest_email') || '');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('open');  // 'open' or 'resolved'
  const messagesEndRef = useRef(null);
  const [tempGuestName, setTempGuestName] = useState('');
  const [tempGuestEmail, setTempGuestEmail] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

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
        const res = await fetch(`${CHAT_BASE}?messages&session_id=${sessionId}${user ? `&user_id=${user.id}` : ''}`, {
          headers: getAuthHeaders()
        });
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages || []);
          // Scroll to bottom for new messages
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };
    
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [sessionId, user]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save guest info
  useEffect(() => {
    if (guestName) localStorage.setItem('builditpc_guest_name', guestName);
    if (guestEmail) localStorage.setItem('builditpc_guest_email', guestEmail);
  }, [guestName, guestEmail]);

  // Create a new chat session in the backend
  const createSession = async () => {
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
          message: newMessage,
          guest_name: !user ? guestName : undefined,
          guest_email: !user ? guestEmail : undefined,
          user_id: user ? user.id : undefined
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Get the session ID from the response
      if (data.session_id) {
        setSessionId(data.session_id);
        localStorage.setItem('builditpc_chat_session_id', data.session_id);
        setSessionStatus('open');
      }
      
      setNewMessage('');
    } catch (e) {
      setError('Failed to start chat session: ' + e.message);
    }
    setLoading(false);
  };

  // Send a message to the backend
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setLoading(true);
    setError(null);
    
    try {
      if (!sessionId) {
        await createSession();
        return;
      }
      
      const res = await fetch(`${CHAT_BASE}?send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          session_id: sessionId,
          sender: 'user',
          message: newMessage
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setNewMessage('');
      setIsTyping(false);
    } catch (e) {
      setError('Failed to send message: ' + e.message);
    }
    setLoading(false);
  };

  // Handle typing indicator
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!isTyping && e.target.value.length > 0) {
      setIsTyping(true);
    } else if (isTyping && e.target.value.length === 0) {
      setIsTyping(false);
    }
  };

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

  // Guest info form
  if (!user && !guestName) {
    const handleGuestContinue = () => {
      if (!tempGuestName.trim()) return;
      setGuestName(tempGuestName.trim());
      if (tempGuestEmail.trim()) {
        setGuestEmail(tempGuestEmail.trim());
      }
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
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="Enter your email"
                value={tempGuestEmail}
                onChange={e => setTempGuestEmail(e.target.value)}
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

  // CSS for custom scrollbar
  const scrollbarStyles = `
    /* Common scrollbar styles */
    .custom-scrollbar::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 6px;
      border: 2px solid #f1f1f1;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
    
    /* Firefox */
    .custom-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: #c1c1c1 #f1f1f1;
    }
    
    /* Ensure smooth scrolling on all devices */
    .custom-scrollbar {
      -webkit-overflow-scrolling: touch;
      -ms-overflow-style: -ms-autohiding-scrollbar;
      overflow-y: auto;
    }
    
    /* Messages area specific styles */
    .messages-area::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border: 2px solid #ffffff;
    }
    
    /* For smaller screens */
    @media (max-width: 640px) {
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
    }
  `;

  return (
    <div className="flex flex-col h-full bg-white">
      <style>{scrollbarStyles}</style>
      
      {/* Header with clear button */}
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




      {/* Chat area */}
      <div className="flex-grow overflow-y-auto custom-scrollbar messages-area" 
           style={{ maxHeight: 'calc(100vh - 250px)', WebkitOverflowScrolling: 'touch' }}>
        <div className="p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-start min-h-[250px] pt-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Welcome to BuildIT PC Support</h3>
              <p className="text-sm text-gray-600 text-center max-w-sm mb-6">
                Our support team is here to help! Type your message below.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`flex items-start gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>

                <div className={`group relative rounded-lg px-4 py-3 max-w-[80%] shadow-sm ${
                  msg.sender === 'user' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <div className="text-sm whitespace-pre-wrap">{msg.message}</div>
                  <div className={`text-xs mt-1 ${
                    msg.sender === 'user' ? 'text-green-100' : 'text-gray-500'
                  }`}>
                    {new Date(msg.sent_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="mt-auto border-t bg-white">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 text-center text-sm">
            {error}
          </div>
        )}
        
        <div className="p-4 flex items-center gap-3">
          <input
            type="text"
            className="flex-grow p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder={sessionStatus === 'resolved' ? 'Chat resolved. Start a new conversation...' : 'Type your message...'}
            value={newMessage}
            onChange={handleTyping}
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