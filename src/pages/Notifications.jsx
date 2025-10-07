import React, { useState } from 'react'
import { Bell, Check, Trash2, AlertCircle, Info, CheckCircle, Clock } from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'

const Notifications = ({ user }) => {
  const { 
    notifications, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    deleteAllNotifications // <-- add this
  } = useNotifications()
  const [filter, setFilter] = useState('all') // all, unread, read

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'order':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'build':
        return <AlertCircle className="w-5 h-5 text-orange-600" />
      case 'system':
        return <Info className="w-5 h-5 text-blue-600" />
      case 'promo':
        return <Bell className="w-5 h-5 text-purple-600" />
      case 'support':
        return <CheckCircle className="w-5 h-5 text-blue-600" />
      default:
        return <Bell className="w-5 h-5 text-gray-600" />
    }
  }

  const renderMessage = (message, type) => {
    if (!message) return null
    if (type === 'stock') {
      const lines = message.split('\n').filter(l => l.trim().length > 0)
      const intro = lines[0] || ''
      // Extract bullet lines starting with '-'
      const bulletLines = lines.slice(1).filter(l => l.trim().startsWith('-'))
      // Footer is any non-bullet last line
      const nonBulletTail = lines.slice(1).filter(l => !l.trim().startsWith('-'))
      const footer = nonBulletTail.length > 0 ? nonBulletTail[nonBulletTail.length - 1] : ''
      return (
        <div>
          {intro && <p className="text-sm text-gray-600 mt-1">{intro}</p>}
          {bulletLines.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-gray-600 mt-1 space-y-1">
              {bulletLines.map((l, idx) => (
                <li key={idx}>{l.replace(/^[-\s]+/, '')}</li>
              ))}
            </ul>
          )}
          {footer && <p className="text-sm text-gray-600 mt-2">{footer}</p>}
        </div>
      )
    }
    // Default: preserve newlines
    return <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{message}</p>
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500'
      case 'medium':
        return 'border-l-orange-500'
      case 'low':
        return 'border-l-blue-500'
      default:
        return 'border-l-gray-500'
    }
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp || isNaN(timestamp.getTime())) {
      return "Unknown time";
    }
    const diffMs = Date.now() - timestamp.getTime();
    const absMs = Math.abs(diffMs);
    const minutes = Math.floor(absMs / (1000 * 60));
    const hours = Math.floor(absMs / (1000 * 60 * 60));
    const days = Math.floor(absMs / (1000 * 60 * 60 * 24));

    // Clamp very small discrepancies to "just now"
    if (absMs < 60 * 1000) return 'just now';

    const inFuture = diffMs < 0;
    const suffixPast = ' ago';
    const prefixFuture = 'in ';

    if (minutes < 60) {
      return inFuture
        ? `${prefixFuture}${minutes} minute${minutes !== 1 ? 's' : ''}`
        : `${minutes} minute${minutes !== 1 ? 's' : ''}${suffixPast}`
    } else if (hours < 24) {
      return inFuture
        ? `${prefixFuture}${hours} hour${hours !== 1 ? 's' : ''}`
        : `${hours} hour${hours !== 1 ? 's' : ''}${suffixPast}`
    } else {
      return inFuture
        ? `${prefixFuture}${days} day${days !== 1 ? 's' : ''}`
        : `${days} day${days !== 1 ? 's' : ''}${suffixPast}`
    }
  }

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.read
    if (filter === 'read') return notification.read
    return true
  })

  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">All Notifications</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
            >
              Mark All as Read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete all notifications?')) {
                  deleteAllNotifications();
                }
              }}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
            >
              Delete All
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
            </h3>
            <p className="text-gray-500">
              {filter === 'all' 
                ? 'You\'ll see important updates here when they arrive.'
                : `You have no ${filter} notifications at the moment.`
              }
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white rounded-lg border border-gray-200 p-4 transition-all duration-200 hover:shadow-md ${
                !notification.read ? 'border-l-4 ' + getPriorityColor(notification.priority) : ''
              } ${!notification.read ? 'bg-blue-50' : ''}`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notification.title}
                      </h3>
                      {renderMessage(notification.message, notification.type)}
                      <div className="flex items-center mt-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatTimestamp(notification.timestamp)}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete notification"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Notifications 