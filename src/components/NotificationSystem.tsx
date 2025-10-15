import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

interface NotificationSystemProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

export function NotificationSystem({ notifications, onRemove }: NotificationSystemProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 p-2">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

function NotificationItem({ notification, onRemove }: NotificationItemProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100);
    
    // Auto remove after duration
    const duration = notification.duration || 5000;
    const removeTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onRemove(notification.id), 300);
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
    };
  }, [notification.id, notification.duration, onRemove]);

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-6 h-6 text-yellow-600" />;
      case 'info':
        return <Info className="w-6 h-6 text-blue-600" />;
      default:
        return <Info className="w-6 h-6 text-gray-600" />;
    }
  };

  const getNotificationStyle = () => {
    switch (notification.type) {
      case 'success':
        return {
          background: 'linear-gradient(to right, #dcfce7, #d1fae5)',
          borderColor: '#16a34a',
          boxShadow: '0 10px 25px -5px rgba(34, 197, 94, 0.2), 0 0 0 1px rgba(34, 197, 94, 0.1)'
        };
      case 'error':
        return {
          background: 'linear-gradient(to right, #fecaca, #fecaca)',
          borderColor: '#dc2626',
          boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.2), 0 0 0 1px rgba(239, 68, 68, 0.1)'
        };
      case 'warning':
        return {
          background: 'linear-gradient(to right, #fef3c7, #fde68a)',
          borderColor: '#d97706',
          boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.2), 0 0 0 1px rgba(245, 158, 11, 0.1)'
        };
      case 'info':
        return {
          background: 'linear-gradient(to right, #dbeafe, #bfdbfe)',
          borderColor: '#2563eb',
          boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.2), 0 0 0 1px rgba(59, 130, 246, 0.1)'
        };
      default:
        return {
          background: 'linear-gradient(to right, #f3f4f6, #e5e7eb)',
          borderColor: '#6b7280',
          boxShadow: '0 10px 25px -5px rgba(107, 114, 128, 0.2), 0 0 0 1px rgba(107, 114, 128, 0.1)'
        };
    }
  };

  const notificationStyle = getNotificationStyle();
  
  return (
    <div
      className={`
        max-w-sm w-full rounded-2xl border-2 p-6 transition-all duration-300 ease-in-out
        hover:scale-105 backdrop-blur-sm transform
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
      style={{
        ...notificationStyle,
        padding: '1.5rem'
      }}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 pt-0.5">
          {getIcon()}
        </div>
        <div className="ml-4 w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800">
            {notification.title}
          </p>
          <p className="mt-1 text-sm text-gray-600 leading-relaxed">
            {notification.message}
          </p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            className="inline-flex text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 focus:outline-none focus:text-gray-600 focus:bg-gray-100 transition-all duration-200 ease-in-out"
            onClick={() => {
              setIsVisible(false);
              setTimeout(() => onRemove(notification.id), 300);
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for managing notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 11);
    const newNotification = { ...notification, id };
    setNotifications(prev => [...prev, newNotification]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll
  };
}
