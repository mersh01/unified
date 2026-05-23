import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

function DynamicNavigation({ user, isOpen, onToggle }) {
  const [navigation, setNavigation] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    fetchNavigation();
  }, [user]);

  const fetchNavigation = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/frontend/config`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const config = await response.json();
      
      // Determine which navigation to show based on user role
      let navItems = [];
      const isAdmin = user?.type === 'admin';
      
      if (isAdmin) {
        const role = user?.role;
        navItems = config.navigation.admin[role] || config.navigation.admin.verification_officer;
      } else {
        navItems = config.navigation.citizen;
      }
      
      setNavigation(navItems);
    } catch (error) {
      console.error('Error fetching navigation:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <aside
      className={`
        fixed left-0 top-0 z-40 h-screen
        transition-all duration-300 ease-in-out
        ${isOpen ? 'w-64' : 'w-20'}
        bg-white border-r border-gray-200
        shadow-lg
      `}
    >
      {/* Logo Section */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          {isOpen && (
            <div>
              <h1 className="text-lg font-bold text-gray-900">National Portal</h1>
              <p className="text-xs text-gray-500">Digital Services</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="mt-6 px-3 space-y-1">
        {navigation.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center px-3 py-2.5 rounded-lg
                transition-all duration-200
                ${active
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }
                ${!isOpen ? 'justify-center' : ''}
              `}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {isOpen && (
                <span className="ml-3 truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info Section */}
      {isOpen && user && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
              {user.username?.charAt(0).toUpperCase() || user.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user.full_name || user.username}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user.role || user.type}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default DynamicNavigation;