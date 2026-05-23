import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import Login from './components/Login';
import DynamicDashboard from './components/DynamicDashboard';
import DynamicForm from './components/DynamicForm';
import MultiStepForm from './components/MultiStepForm';
import Track from './pages/Track';
import UserManagement from './pages/UserManagement';
import RoleManagement from './pages/RoleManagement';
import ServiceManagement from './pages/ServiceManagement';
import WorkflowManagement from './pages/WorkflowManagement';
import LocalizationManagement from './pages/LocalizationManagement';
import NotificationsDropdown from './components/NotificationsDropdown';
import { translate, getStoredLocale, saveLocale } from './utils/i18n';

// Simple SVG Icons (monochrome)
const Icons = {
  Dashboard: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
    </svg>
  ),
  Track: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  ),
  Users: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  ),
  Roles: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
  ),
  Services: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
    </svg>
  ),
  Workflow: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  ),
  Localization: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  ),
  Menu: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  ),
  Logout: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  ),
  Document: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
  ),
  Camera: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <circle cx="12" cy="13" r="4"></circle>
    </svg>
  ),
  Close: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  )
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Login wrapper component to handle path-based login type
function LoginWrapper({ onLogin, onAdminLogin, translations, locale, availableLocales, handleLocaleChange }) {
  const location = useLocation();
  const loginType = location.pathname === '/employee' ? 'admin' : 'citizen';
  
  return <Login 
    loginType={loginType} 
    onLogin={onLogin} 
    onAdminLogin={onAdminLogin}
    translations={translations}
    locale={locale}
    availableLocales={availableLocales}
    onLocaleChange={handleLocaleChange}
  />;
}

// Apply wrapper to check for service_id parameter
function ApplyWrapper({ user }) {
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('service_id');
  
  if (!serviceId) {
    return <Navigate to="/" replace />;
  }
  
  return <MultiStepForm user={user} />;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [frontendConfig, setFrontendConfig] = useState(null);
  const [locale, setLocale] = useState(getStoredLocale());
  const [translations, setTranslations] = useState({});
  const [availableLocales, setAvailableLocales] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(''); // '', 'uploading', 'success', 'error'
  const [editName, setEditName] = useState('');
  const [nameUpdateStatus, setNameUpdateStatus] = useState(''); // '', 'saving', 'success', 'error'

  useEffect(() => {
    const initApp = async () => {
      await fetchLocalization(locale);
      
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      if (token && savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setIsAuthenticated(true);
          await fetchFrontendConfig(token);
          if (userData.type === 'citizen' || userData.role === 'citizen') {
              await fetchServices(token);
          }
        } catch (e) {
          console.error('Error parsing user data:', e);
          localStorage.clear();
        }
      }
      setLoading(false);
    };

    initApp();
  }, []);

  const fetchFrontendConfig = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/frontend/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const config = await response.json();
      setFrontendConfig(config);
      if (Array.isArray(config.localization?.available_locales) && config.localization.available_locales.length > 0) {
        setAvailableLocales(config.localization.available_locales);
      }
    } catch (error) {
      console.error('Error fetching frontend config:', error);
    }
  };

  const fetchServices = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/frontend/services`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setServices(data.services || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  // Group services by department/category
  const getServicesByDepartment = () => {
    const departments = {};
    services.forEach(service => {
      const department = service.category || 'Other';
      if (!departments[department]) {
        departments[department] = [];
      }
      departments[department].push(service);
    });
    return departments;
  };

  const handleDepartmentClick = (department) => {
    setSelectedDepartment(selectedDepartment === department ? null : department);
  };

  const fetchLocalization = async (localeToLoad) => {
    try {
      const localeResponse = await fetch(`${API_URL}/api/frontend/localization/locales`);
      const localeData = await localeResponse.json();
      setAvailableLocales(Array.isArray(localeData.locales) ? localeData.locales : []);

      const response = await fetch(`${API_URL}/api/frontend/localization?locale=${encodeURIComponent(localeToLoad)}`);
      const data = await response.json();
      setTranslations(data.translations || {});
      setLocale(data.locale || localeToLoad);
      saveLocale(data.locale || localeToLoad);
    } catch (error) {
      console.error('Error fetching localization:', error);
      setTranslations({});
    }
  };

  const handleLogin = async (userData) => {
    userData.type = 'citizen';
    setUser(userData);
    setIsAuthenticated(true);
    const token = localStorage.getItem('token');
    await fetchFrontendConfig(token);
    await fetchServices(token);
    setLoading(false);
  };

  const handleAdminLogin = async (adminData) => {
    setUser(adminData);
    setIsAuthenticated(true);
    const token = localStorage.getItem('token');
    await fetchFrontendConfig(token);
    setLoading(false);
  };

  const handleLocaleChange = async (newLocale) => {
    setLocale(newLocale);
    saveLocale(newLocale);
    await fetchLocalization(newLocale);
  };

  const handleLogout = () => {
    const isEmployee = user?.type === 'admin' || (user?.role && user?.role !== 'citizen');
    localStorage.clear();
    setUser(null);
    setIsAuthenticated(false);
    setFrontendConfig(null);
    if (isEmployee) {
      window.location.href = '/employee';
    } else {
      window.location.href = '/citizen';
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUploadStatus('');
    }
  };

  const handleProfileUpload = async () => {
    if (!selectedFile) return;
    
    setUploadStatus('uploading');
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_URL}/api/users/profile-picture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setUploadStatus('success');
        
        // Refresh config to get new picture URL
        await fetchFrontendConfig(token);
        
        setTimeout(() => {
          setIsProfileModalOpen(false);
          setUploadStatus('');
          setSelectedFile(null);
          setPreviewUrl(null);
        }, 1500);
      } else {
        const errData = await response.json();
        alert(`Upload failed: ${errData.detail || 'Unknown error'}`);
        setUploadStatus('error');
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('Network error during upload');
      setUploadStatus('error');
    }
  };

  const handleNameUpdate = async () => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    
    setNameUpdateStatus('saving');
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ full_name: trimmed })
      });

      if (response.ok) {
        setNameUpdateStatus('success');
        await fetchFrontendConfig(token);
        setTimeout(() => setNameUpdateStatus(''), 2000);
      } else {
        const errData = await response.json();
        alert(`Update failed: ${errData.detail || 'Unknown error'}`);
        setNameUpdateStatus('error');
      }
    } catch (error) {
      console.error('Error updating name:', error);
      alert('Network error during update');
      setNameUpdateStatus('error');
    }
  };

  if (loading) {
    return <div className="loading">Loading configuration...</div>;
  }

  if (!isAuthenticated) {
    return (
      <Router>
        <Routes>
          <Route path="/citizen" element={<LoginWrapper onLogin={handleLogin} onAdminLogin={handleAdminLogin} translations={translations} locale={locale} availableLocales={availableLocales} handleLocaleChange={handleLocaleChange} />} />
          <Route path="/employee" element={<LoginWrapper onLogin={handleLogin} onAdminLogin={handleAdminLogin} translations={translations} locale={locale} availableLocales={availableLocales} handleLocaleChange={handleLocaleChange} />} />
          <Route path="/" element={<Navigate to="/citizen" replace />} />
          <Route path="*" element={<Navigate to="/citizen" replace />} />
        </Routes>
      </Router>
    );
  }

  if (!frontendConfig) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const canApply = frontendConfig.features?.can_apply || false;
  const navigation = frontendConfig.navigation?.items || [];
  const isAdmin = frontendConfig.user?.type === 'admin';
  const canManageUsers = frontendConfig.features?.can_manage_users || false;
  const canManageRoles = frontendConfig.features?.can_manage_roles || false;

  return (
    <Router>
      <div className="app-layout">
        {/* Mobile Overlay */}
        <div 
          className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
          onClick={() => setIsSidebarOpen(false)}
        ></div>

        <aside className={`app-sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-user-section" onClick={() => { setEditName(frontendConfig?.user?.full_name || frontendConfig?.user?.name || ''); setIsProfileModalOpen(true); }}>
            <div className="sidebar-avatar-container">
              {frontendConfig?.user?.profile_picture_url ? (
                <img 
                  src={`${API_URL}${frontendConfig.user.profile_picture_url}`} 
                  alt="Profile" 
                  className="sidebar-avatar"
                />
              ) : (
                <div className="sidebar-avatar-placeholder">
                  {(frontendConfig?.user?.full_name || frontendConfig?.user?.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="sidebar-avatar-badge"></span>
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {frontendConfig?.user?.full_name || frontendConfig?.user?.name || 'User'}
              </div>
              <div className="sidebar-user-role">
                {frontendConfig?.user?.phone_number || ''}
              </div>
            </div>
          </div>
          <div className="sidebar-header">
            <h2>DMS</h2>
          </div>
          <nav className="sidebar-nav">
            {user?.type === 'citizen' || user?.role === 'citizen' ? (
              <>
                <Link to="/" onClick={() => setIsSidebarOpen(false)}>
                  <span className="sidebar-nav-icon"><Icons.Dashboard /></span>
                  <span>Dashboard</span>
                </Link>
                <Link to="/track" onClick={() => setIsSidebarOpen(false)}>
                  <span className="sidebar-nav-icon"><Icons.Track /></span>
                  <span>Track Applications</span>
                </Link>
                <div className="sidebar-section-label">DEPARTMENTS</div>
                {Object.entries(getServicesByDepartment()).map(([department, deptServices]) => (
                  <div key={department}>
                    <button 
                      className={`department-item ${selectedDepartment === department ? 'selected' : ''}`}
                      onClick={() => handleDepartmentClick(department)}
                    >
                      <span>
                        {department.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="department-chevron">
                        {selectedDepartment === department ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
                        <span className="department-count">({deptServices.length})</span>
                      </span>
                    </button>
                    {selectedDepartment === department && (
                      <div>
                        {deptServices.map(service => (
                          <Link 
                            key={service.service_id} 
                            to={`/apply?service_id=${service.service_id}`}
                            className="service-item"
                            onClick={() => setIsSidebarOpen(false)}
                          >
                            <span className="sidebar-nav-icon"><Icons.Document /></span>
                            {service.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              navigation.map(item => (
                <Link key={item.path} to={item.path} onClick={() => setIsSidebarOpen(false)}>
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))
            )}
          </nav>
        </aside>

        <main className="app-main">
          <header className="app-header">
            <div className="app-header-left">
              <button 
                className="mobile-menu-btn" 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <Icons.Menu />
              </button>
              <div className="header-info">
                <h1><span className="header-title-icon"><Icons.Document /></span> {translate(translations, 'app_title', 'Document Management System')}</h1>
                <p>{translate(translations, 'welcome_message', 'Welcome')}, {frontendConfig.user?.name || 'User'}!</p>
                {frontendConfig.user?.role !== 'citizen' && (
                <p className="header-role-info">
                  {translate(translations, 'role_label', 'Role')}: {frontendConfig.user?.role} | {translate(translations, 'department_label', 'Department')}: {frontendConfig.user?.department || 'N/A'}
                </p>
                )}
            </div>
            </div>
            <div className="header-actions">
              {frontendConfig?.user?.profile_picture_url ? (
                <img 
                  src={`${API_URL}${frontendConfig.user.profile_picture_url}`} 
                  alt="Profile" 
                  className="header-user-avatar"
                  onClick={() => { setEditName(frontendConfig?.user?.full_name || frontendConfig?.user?.name || ''); setIsProfileModalOpen(true); }}
                  title="Update Profile"
                />
              ) : (
                <div 
                  className="header-user-avatar header-avatar-placeholder"
                  onClick={() => { setEditName(frontendConfig?.user?.full_name || frontendConfig?.user?.name || ''); setIsProfileModalOpen(true); }}
                  title="Update Profile Picture"
                >
                  {(frontendConfig?.user?.full_name || frontendConfig?.user?.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <select
                value={locale}
                onChange={(e) => handleLocaleChange(e.target.value)}
                className="header-language-select"
              >
                {availableLocales.length > 0 ? (
                  availableLocales.map((localeEntry) => (
                    <option key={localeEntry.locale} value={localeEntry.locale}>
                      {localeEntry.display_name || localeEntry.locale}
                    </option>
                  ))
                ) : (
                  <option value="en">English</option>
                )}
              </select>
              <NotificationsDropdown />
              <button onClick={handleLogout} className="header-logout-btn">
                <Icons.Logout />
                {translate(translations, 'logout', 'Logout')}
              </button>
            </div>
          </header>

          <div className="app-content">
            <Routes>
              {/* Dashboard - Main page */}
              <Route path="/" element={<DynamicDashboard config={frontendConfig} user={user} />} />
              
              {/* Apply - Only for citizens with service_id parameter */}
              {canApply && (
                <Route path="/apply" element={<ApplyWrapper user={user} />} />
              )}
              
              {/* Track - Everyone can track */}
              <Route path="/track" element={<Track user={user} />} />
              
              {/* Admin Pages - Separate routes */}
              {isAdmin && (
                <>
                  <Route path="/admin/applications" element={<DynamicDashboard config={frontendConfig} user={user} t={(key, fallback) => translate(translations, key, fallback)} />} />
                  {canManageUsers && (
                    <Route path="/admin/users" element={<UserManagement user={user} translations={translations} />} />
                  )}
                  {canManageRoles && (
                    <Route path="/admin/roles" element={<RoleManagement user={user} translations={translations} />} />
                  )}
                  {canManageRoles && (
                    <>
                      <Route path="/admin/services" element={<ServiceManagement user={user} translations={translations} />} />
                      <Route path="/admin/workflows" element={<WorkflowManagement user={user} translations={translations} />} />
                      <Route path="/admin/localizations" element={<LocalizationManagement user={user} translations={translations} />} />
                    </>
                  )}
                </>
              )}
              
              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>

        {/* Profile Modal */}
        <div className={`profile-modal-overlay ${isProfileModalOpen ? 'visible' : ''}`} onClick={(e) => {
          if (e.target.className.includes('profile-modal-overlay')) setIsProfileModalOpen(false);
        }}>
          <div className="profile-modal">
            <div className="profile-modal-header">
              <div className="profile-modal-title">Edit Profile</div>
              <button className="profile-modal-close" onClick={() => setIsProfileModalOpen(false)}><Icons.Close /></button>
            </div>
            
            <div className="profile-modal-avatar-section">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="profile-modal-avatar" />
              ) : frontendConfig?.user?.profile_picture_url ? (
                <img src={`${API_URL}${frontendConfig.user.profile_picture_url}`} alt="Current" className="profile-modal-avatar" />
              ) : (
                <div className="profile-modal-avatar-placeholder">
                  {(frontendConfig?.user?.full_name || frontendConfig?.user?.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="profile-modal-role-badge">{frontendConfig?.user?.role}</div>
            </div>

            <div className="profile-edit-section">
              <label className="profile-edit-label">Full Name</label>
              <div className="profile-edit-row">
                <input
                  type="text"
                  className="profile-edit-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter your name"
                />
                <button
                  className="profile-edit-save-btn"
                  disabled={!editName.trim() || editName.trim() === (frontendConfig?.user?.full_name || frontendConfig?.user?.name) || nameUpdateStatus === 'saving'}
                  onClick={handleNameUpdate}
                >
                  {nameUpdateStatus === 'saving' ? 'Saving...' : nameUpdateStatus === 'success' ? 'Saved!' : 'Update'}
                </button>
              </div>
            </div>

            <div className="profile-edit-section">
              <label className="profile-edit-label">Profile Picture</label>
              {!previewUrl ? (
                <div className="profile-upload-zone" onClick={() => document.getElementById('profile-upload-input').click()}>
                  <div className="profile-upload-zone-icon"><Icons.Camera /></div>
                  <div className="profile-upload-zone-text">Click to browse or drag image here</div>
                  <div className="profile-upload-zone-hint">JPG, PNG or WebP (max. 5MB)</div>
                  <input 
                    type="file" 
                    id="profile-upload-input" 
                    accept="image/jpeg, image/png, image/webp" 
                    style={{ display: 'none' }} 
                    onChange={handleFileSelect}
                  />
                </div>
              ) : (
                <div className="profile-upload-preview">
                  <img src={previewUrl} alt="Selected" />
                  <div className="profile-upload-preview-info">
                    <div className="profile-upload-preview-name">{selectedFile?.name}</div>
                    <div className="profile-upload-preview-size">{(selectedFile?.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                  <button className="profile-upload-remove" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}>Remove</button>
                </div>
              )}
            </div>

            {uploadStatus === 'success' && (
              <div className="profile-upload-success">
                Profile picture updated successfully!
              </div>
            )}

            <button 
              className={`profile-upload-btn ${uploadStatus === 'uploading' ? 'uploading' : ''}`}
              disabled={!selectedFile || uploadStatus === 'uploading' || uploadStatus === 'success'}
              onClick={handleProfileUpload}
            >
              {uploadStatus === 'uploading' ? 'Uploading...' : uploadStatus === 'success' ? 'Done' : 'Upload Picture'}
            </button>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;