import React, { useState, useEffect } from 'react'
import { X, Bell, CheckCircle, AlertCircle, Info } from 'lucide-react'

const NotificationToast = ({ notification, onClose, onMarkAsRead }) => {
  const [isVisible, setIsVisible] = useState(true)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Auto-hide after 5 seconds
    const timer = setTimeout(() => {
      handleClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      setIsVisible(false)
      onClose()
    }, 300)
  }

  const handleMarkAsRead = () => {
    onMarkAsRead()
    handleClose()
  }

  const getIcon = (type) => {
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

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500 bg-red-50'
      case 'medium':
        return 'border-l-orange-500 bg-orange-50'
      case 'low':
        return 'border-l-blue-500 bg-blue-50'
      default:
        return 'border-l-gray-500 bg-gray-50'
    }
  }

  if (!isVisible) return null

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm w-full transform transition-all duration-300 ${
        isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      }`}
    >
      <div className={`bg-white rounded-lg shadow-lg border-l-4 p-4 ${getPriorityStyles(notification.priority)}`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(notification.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900">
              {notification.title}
            </h4>
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">
              {notification.message}
            </p>
          </div>
          
          <div className="flex items-center space-x-1">
            {!notification.read && (
              <button
                onClick={handleMarkAsRead}
                className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                title="Mark as read"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotificationToast 