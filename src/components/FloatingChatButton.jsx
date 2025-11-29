import React, { useState, useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';
import DynamicChatAccess from './DynamicChatAccess';
import { API_BASE } from '../utils/apiBase';

const FloatingChatButton = ({ user, setCurrentPage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sessionId, setSessionId] = useState(() => {
    try {
      return localStorage.getItem('builditpc_chat_session_id') || null;
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return null;
    }
  });

  // Check for unread messages
  useEffect(() => {
    if (!sessionId || !user) return;

    const checkUnreadMessages = async () => {
      try {
        const res = await fetch(`${API_BASE}/chat.php?unread_count&user_id=${user.id}`);
        const data = await res.json();
        if (data.success) {
          setUnreadCount(data.unread_count);
        }
      } catch (error) {
        console.error('Error checking unread count:', error);
      }
    };

    checkUnreadMessages();
    const interval = setInterval(checkUnreadMessages, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [sessionId, user]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  // Show floating chat for all users - admin/employee will get their management interface
  // Regular users and guests will get the customer support interface

  return (
    <>
      {/* Floating Chat Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={toggleChat}
          className="bg-green-600 hover:bg-green-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 flex items-center justify-center relative"
          title="Chat Support"
        >
          <MessageSquare className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-3 rounded-t-lg flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <span className="font-semibold">Chat Support</span>
            </div>
            <div className="flex items-center">
              <button
                onClick={toggleChat}
                className="text-white hover:text-gray-200 transition-colors p-1"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Content */}
          <div className="flex-1 overflow-hidden min-h-0 flex flex-col" style={{ height: 'calc(500px - 60px)' }}>
            <DynamicChatAccess 
              user={user} 
              customStyles={{
                containerClass: 'h-full flex flex-col',
                messagesWrapperClass: 'flex-shrink-0',
                messagesAreaClass: '',
                messagesMaxHeight: '280px',
                messagesAreaStyle: { 
                  height: '280px',
                  maxHeight: '280px',
                  minHeight: '280px',
                  overflowY: 'scroll',
                  overflowX: 'hidden',
                  display: 'block',
                  flexShrink: 0
                },
                suggestionListClass: 'pb-4',
                inputAreaClass: 'bg-gray-50 flex-shrink-0',
              }}
              hideHeader={true}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingChatButton; 