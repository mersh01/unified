import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
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

const API_URL = 'http://localhost:8000';

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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [frontendConfig, setFrontendConfig] = useState(null);
  const [locale, setLocale] = useState(getStoredLocale());
  const [translations, setTranslations] = useState({});
  const [availableLocales, setAvailableLocales] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [loading, setLoading] = useState(true);

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
        <aside className="app-sidebar">
          <div className="sidebar-header">
            <h2>DMS</h2>
          </div>
          <nav className="sidebar-nav">
            {user?.type === 'citizen' || user?.role === 'citizen' ? (
              <>
                <Link to="/">Dashboard</Link>
                <Link to="/track">Track Applications</Link>
                <div style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '0.75rem', color: '#9ca3af', padding: '0 16px', letterSpacing: '0.05em' }}>DEPARTMENTS</div>
                {Object.entries(getServicesByDepartment()).map(([department, deptServices]) => (
                  <div key={department}>
                    <button 
                      className={`department-item ${selectedDepartment === department ? 'selected' : ''}`}
                      onClick={() => handleDepartmentClick(department)}
                    >
                      <span>
                        {department.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {selectedDepartment === department ? '▼' : '▶'} ({deptServices.length})
                      </span>
                    </button>
                    {selectedDepartment === department && (
                      <div>
                        {deptServices.map(service => (
                          <Link 
                            key={service.service_id} 
                            to={`/apply?service_id=${service.service_id}`}
                            className="service-item"
                          >
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
                <Link key={item.path} to={item.path}>
                  {item.icon} {item.label}
                </Link>
              ))
            )}
          </nav>
        </aside>

        <main className="app-main">
          <header className="app-header">
            <div className="header-info">
              <h1>📄 {translate(translations, 'app_title', 'Document Management System')}</h1>
              <p>{translate(translations, 'welcome_message', 'Welcome')}, {frontendConfig.user?.name || 'User'}!</p>
              {frontendConfig.user?.role !== 'citizen' && (
                <p style={{ fontSize: '12px' }}>
                  {translate(translations, 'role_label', 'Role')}: {frontendConfig.user?.role} | {translate(translations, 'department_label', 'Department')}: {frontendConfig.user?.department || 'N/A'}
                </p>
              )}
            </div>
            <div className="header-actions">
              <select
                value={locale}
                onChange={(e) => handleLocaleChange(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
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
              <button onClick={handleLogout} style={{ background: '#dc2626', padding: '8px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}>
                {translate(translations, 'logout', 'Logout')}
              </button>
            </div>
          </header>

          <div className="app-content">
            <Routes>
              {/* Dashboard - Main page */}
              <Route path="/" element={<DynamicDashboard config={frontendConfig} user={user} />} />
              
              {/* Apply - Only for citizens */}
              {canApply && (
                <Route path="/apply" element={<MultiStepForm user={user} />} />
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
      </div>
    </Router>
  );
}

export default App;