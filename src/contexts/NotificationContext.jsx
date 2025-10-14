import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { API_BASE } from '../utils/apiBase'
import { ensureValidToken, authorizedFetch } from '../utils/auth'

const NotificationContext = createContext()

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children, user }) => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const pollRef = useRef(null)

  // Local helper to check if JWT token is expired
  const isTokenExpired = (token) => {
    try {
      const part = token.split('.')[1]
      if (!part) return true
      // Convert base64url -> base64 and add padding if needed
      let b64 = part.replace(/-/g, '+').replace(/_/g, '/')
      while (b64.length % 4) b64 += '='
      const payload = JSON.parse(atob(b64))
      if (!payload.exp) return false
      return Date.now() >= payload.exp * 1000
    } catch {
      return true
    }
  }

  // Helper function to check if user has access to notifications
  const hasNotificationAccess = (user) => {
    if (!user || !user.roles) return false;
    
    // Handle both array and string roles
    let roles = [];
    if (Array.isArray(user.roles)) {
      roles = user.roles;
    } else if (typeof user.roles === 'string') {
      roles = user.roles.split(',').map(role => role.trim());
    } else {
      roles = [user.roles];
    }
    
    const hasAccess = roles.some(role => ['Admin', 'Super Admin', 'Employee'].includes(role));
    
    return hasAccess;
  };

  // Load notifications when user changes
  useEffect(() => {
    if (user && user.id && hasNotificationAccess(user)) {
      loadNotifications()
      loadUnreadCount()
      // Poll unread count every 10 seconds (reduced frequency to avoid auth issues)
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      // Add initial delay to let authentication stabilize
      setTimeout(() => {
        pollRef.current = setInterval(() => {
          loadUnreadCount()
        }, 10000)
      }, 2000)
      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      }
    } else {
      // Clear notifications for users without access (like Client users)
      setNotifications([])
      setUnreadCount(0)
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [user])

  // Listen for authentication events
  useEffect(() => {
    const handleAuthRequired = () => {
      // Authentication required, stopping polling
      setNotifications([])
      setUnreadCount(0)
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    window.addEventListener('auth:login-required', handleAuthRequired)
    window.addEventListener('auth:unauthorized', handleAuthRequired)

    return () => {
      window.removeEventListener('auth:login-required', handleAuthRequired)
      window.removeEventListener('auth:unauthorized', handleAuthRequired)
    }
  }, [])

  const loadNotifications = async () => {
    if (!user || !user.id || !hasNotificationAccess(user)) return
    
    setLoading(true)
    try {
      const token = await ensureValidToken(false)
      if (!token) {
        // No valid token available, stopping polling
        setNotifications([])
        setUnreadCount(0)
        // Stop polling to avoid repeated errors
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
        setLoading(false)
        return
      }

      const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=notifications`, { 
        method: 'GET', 
        suppressUnauthorizedEvent: true 
      })
      
      if (response.status === 401) {
        // 401 error in loadNotifications, stopping polling
        // Do not clear global token here. Just reset local state and stop.
        setNotifications([])
        setUnreadCount(0)
        // Stop polling to avoid repeated 401 console spam
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        return
      }

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Convert timestamp strings to Date objects
          const notificationsWithDates = data.data.map(notification => ({
            ...notification,
            timestamp: new Date(notification.timestamp)
          }))
          setNotifications(notificationsWithDates)
        }
      } else {
        console.warn('NotificationContext: Unexpected response status:', response.status)
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUnreadCount = async () => {
    if (!user || !user.id || !hasNotificationAccess(user)) {
      return;
    }
    
    try {
      const token = await ensureValidToken(false)
      if (!token) {
        setNotifications([])
        setUnreadCount(0)
        return
      }

      const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=notifications&count=1`, { 
        method: 'GET', 
        suppressUnauthorizedEvent: true 
      })
      
      if (response.status === 401) {
        // 401 error in loadUnreadCount, stopping polling
        // Do not clear global token here. Just reset local state and stop polling.
        setNotifications([])
        setUnreadCount(0)
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        return
      }

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setUnreadCount(data.count)
        }
      } else {
        console.warn('NotificationContext: Unexpected response status:', response.status)
      }
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }

  const markAsRead = async (notificationId) => {
    if (!user || !user.id || !hasNotificationAccess(user)) return
    
    try {
      const token = await ensureValidToken(false)
      if (!token) return

      const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId }),
        suppressUnauthorizedEvent: true
      })
      
      if (response.status === 401) {
        // Do not clear global token here.
        return
      }

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setNotifications(prev => 
            prev.map(notification => 
              notification.id === notificationId 
                ? { ...notification, read: true }
                : notification
            )
          )
          // Update unread count
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    if (!user || !user.id || !hasNotificationAccess(user)) return
    
    try {
      const token = await ensureValidToken(false)
      if (!token) return

      const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=notifications&action=mark-all-read`, {
        method: 'PUT',
        suppressUnauthorizedEvent: true
      })
      
      if (response.status === 401) {
        // Do not clear global token here.
        return
      }

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setNotifications(prev => 
            prev.map(notification => ({ ...notification, read: true }))
          )
          setUnreadCount(0)
        }
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const deleteNotification = async (notificationId) => {
    if (!user || !user.id || !hasNotificationAccess(user)) return
    try {
      const token = await ensureValidToken(false)
      if (!token) return

      const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=notifications`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId }),
        suppressUnauthorizedEvent: true
      })
      
      if (response.status === 401) {
        // Do not clear global token here.
        return
      }

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const notification = notifications.find(n => n.id === notificationId)
          setNotifications(prev => 
            prev.filter(notification => notification.id !== notificationId)
          )
          // Update unread count if the deleted notification was unread
          if (notification && !notification.read) {
            setUnreadCount(prev => Math.max(0, prev - 1))
          }
          // Immediately sync with backend
          loadUnreadCount()
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const deleteAllNotifications = async () => {
    if (!user || !user.id || !hasNotificationAccess(user)) return;
    try {
      const token = await ensureValidToken(false)
      if (!token) return
      const response = await authorizedFetch(`${API_BASE}/index.php?endpoint=notifications&all=1`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        suppressUnauthorizedEvent: true
      })
      if (response.status === 401) {
        // Do not clear global token here.
        return;
      }
      if (response.ok) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error deleting all notifications:', error);
    }
  };

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now(),
      timestamp: new Date(),
      read: false,
      ...notification
    }
    setNotifications(prev => [newNotification, ...prev])
    setUnreadCount(prev => prev + 1)
  }

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
    loadNotifications,
    loadUnreadCount,
    deleteAllNotifications
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
} 