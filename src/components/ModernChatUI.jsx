import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Search, 
  MoreVertical, 
  Phone, 
  Video, 
  Image, 
  Smile, 
  Paperclip, 
  Mic,
  Edit3,
  Bell,
  CheckCircle,
  Clock
} from 'lucide-react';

const ModernChatUI = ({ 
  user, 
  chats = [], 
  messages = [], 
  onSendMessage, 
  newMessage = '', 
  onNewMessageChange, 
  loading = false, 
  error = null, 
  sessionStatus = 'open',
  customStyles = {} 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || loading) return;
    onSendMessage();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedChat = chats.find(chat => chat.selected);

  return (
    <div className="flex h-screen bg-gray-50">
      {error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {error}
        </div>
      )}
      {/* Left Column - Chat List */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">Chats</h1>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Edit3 className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Messenger"
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Horizontal User List */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex space-x-4 overflow-x-auto pb-2">
            {chats.slice(0, 5).map((chat) => (
              <div key={chat.id} className="flex flex-col items-center space-y-2 min-w-[60px]">
                <div className="relative">
                  <img
                    src={chat.avatar}
                    alt={chat.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                  />
                  {chat.online && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <span className="text-xs text-gray-600 text-center truncate w-full">{chat.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`flex items-center p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                chat.selected ? 'bg-blue-50 border-r-2 border-blue-500' : ''
              }`}
            >
              <div className="relative mr-3">
                <img
                  src={chat.avatar}
                  alt={chat.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                {chat.online && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-800 truncate">{chat.name}</h3>
                  <div className="flex items-center space-x-2">
                    {chat.unread && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                    <span className="text-xs text-gray-500">- {chat.time}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 truncate">{chat.lastMessage}</p>
              </div>
              
              <div className="ml-2">
                {chat.unread ? (
                  <Bell className="w-4 h-4 text-gray-400" />
                ) : (
                  <div className="w-4 h-4"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column - Chat Conversation */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src={selectedChat?.avatar}
                alt={selectedChat?.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              {selectedChat?.online && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">{selectedChat?.name}</h2>
              <p className="text-sm text-gray-500">
                {selectedChat?.online ? 'Active now' : 'Last seen recently'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Phone className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Video className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md ${
                message.sender === 'me' ? 'ml-auto' : 'mr-auto'
              }`}>
                {/* Message Bubble */}
                <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                  message.sender === 'me' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {message.type === 'image' && (
                    <div className="mb-2">
                      <img
                        src={message.imageUrl}
                        alt="Shared image"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    </div>
                  )}
                  
                  {message.type === 'attachment' && (
                    <div className="flex items-center space-x-2 mb-2">
                      <Paperclip className="w-4 h-4" />
                      <span className="text-sm">Attachment</span>
                    </div>
                  )}
                  
                  {message.type === 'reply' && (
                    <div className="text-xs opacity-70 mb-1 italic">
                      {message.content}
                    </div>
                  )}
                  
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                </div>
                
                {/* Message Actions */}
                {message.sender === 'other' && (
                  <div className="flex items-center space-x-2 mt-2 opacity-0 hover:opacity-100 transition-opacity">
                    <button className="p-1 hover:bg-gray-200 rounded">
                      <MoreVertical className="w-3 h-3 text-gray-500" />
                    </button>
                    <button className="p-1 hover:bg-gray-200 rounded">
                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                    <button className="p-1 hover:bg-gray-200 rounded">
                      <Smile className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                )}
                
                {/* Timestamp */}
                <div className={`text-xs text-gray-500 mt-1 ${
                  message.sender === 'me' ? 'text-right' : 'text-left'
                }`}>
                  {message.time}
                  {message.sender === 'me' && (
                    <span className="ml-1">
                      <CheckCircle className="w-3 h-3 inline" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

                 {/* Input Area */}
         <div className="px-4 py-3 border-t border-gray-200">
                     <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Mic className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Image className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Smile className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </button>
            </div>
            
                         <div className="flex-1 relative">
               <input
                 type="text"
                 placeholder={sessionStatus === 'resolved' ? 'Chat resolved. Start a new conversation...' : 'Aa'}
                 className="w-full px-4 py-2 bg-gray-100 border-0 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                 value={newMessage}
                 onChange={(e) => onNewMessageChange(e.target.value)}
                 onKeyPress={handleKeyPress}
                 disabled={loading || sessionStatus === 'resolved'}
               />
             </div>
            
                         <div className="flex items-center space-x-2">
               <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                 <Smile className="w-5 h-5 text-gray-600" />
               </button>
               <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                 <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                 </svg>
               </button>
               <button
                 className={`p-2 rounded-lg transition-colors ${
                   loading || !newMessage.trim() || sessionStatus === 'resolved'
                     ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                     : 'bg-green-500 text-white hover:bg-green-600'
                 }`}
                 onClick={handleSendMessage}
                 disabled={loading || !newMessage.trim() || sessionStatus === 'resolved'}
               >
                 {loading ? (
                   <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                 ) : (
                   <Send className="w-5 h-5" />
                 )}
               </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernChatUI; 