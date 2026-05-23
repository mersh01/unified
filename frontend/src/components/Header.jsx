import React, { useState } from 'react';
import NotificationsDropdown from './NotificationsDropdown';

const Header = ({ user, onLogout, onToggleSidebar, onProfileClick, locale, availableLocales, onLocaleChange, translations, translate }) => {
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  return (
    <header className="fixed top-0 right-0 left-0 z-30 h-16 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
            aria-label="Toggle sidebar"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="hidden lg:block">
            <h1 className="text-xl font-bold text-gray-900">National Digital Services Portal</h1>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-2 lg:space-x-4">
          {/* Locale Selector */}
          {availableLocales && availableLocales.length > 0 && (
            <select
              value={locale}
              onChange={(e) => onLocaleChange(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {availableLocales.map((localeEntry) => (
                <option key={localeEntry.locale} value={localeEntry.locale}>
                  {localeEntry.display_name || localeEntry.locale}
                </option>
              ))}
            </select>
          )}

          {/* Notifications */}
          <NotificationsDropdown />

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="User menu"
            >
              {user?.profile_picture_url ? (
                <img
                  src={user.profile_picture_url}
                  alt="Profile"
                  className="w-9 h-9 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                  {(user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden lg:block text-left">
                <p className="text-sm font-semibold text-gray-900">
                  {user?.full_name || user?.username || 'User'}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user?.role || user?.type}
                </p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isProfileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-slideDown">
                <div className="px-4 py-3 border-b border-gray-200">
                  <p className="text-sm font-semibold text-gray-900">
                    {user?.full_name || user?.username || 'User'}
                  </p>
                  <p className="text-xs text-gray-500">{user?.email || user?.phone_number || ''}</p>
                </div>
                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    onProfileClick();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Edit Profile</span>
                </button>
                <button
                  onClick={onLogout}
                  className="w-full px-4 py-2 text-left text-sm text-danger-600 hover:bg-danger-50 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>{translate(translations, 'logout', 'Logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
