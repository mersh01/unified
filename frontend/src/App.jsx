import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Menu, ChevronDown, ChevronUp, Moon, Sun } from 'lucide-react';
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
import Card from './components/ui/Card';
import Button from './components/ui/Button';
import Input from './components/ui/Input';
import Select from './components/ui/Select';
import Modal from './components/ui/Modal';
import Badge from './components/ui/Badge';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Login wrapper component to handle path-based login type
function LoginWrapper({ onLogin, onAdminLogin, translations, locale, availableLocales, handleLocaleChange, theme, onToggleTheme }) {
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
    theme={theme}
    onToggleTheme={onToggleTheme}
  />;
}

// Apply wrapper to check for service_id parameter
function ApplyWrapper({ user, services = [] }) {
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('service_id');

  // If a service_id is provided, render the multi-step form for that service
  if (serviceId) {
    return <MultiStepForm user={user} />;
  }

  // Filter services for proxy users (CSR)
  const currentUserRoles = [
    ...(user?.role ? [user.role] : []),
    ...(Array.isArray(user?.roles) ? user.roles : [])
  ].filter(Boolean);
  const proxyRoles = ['citizen_service_rep', 'csr'];
  const isProxyUser = currentUserRoles.some(role => proxyRoles.includes(role));
  
  const visibleServices = isProxyUser
    ? services.filter(service =>
        service?.config?.allow_proxy_submission === true &&
        Array.isArray(service.config?.proxy_roles) &&
        service.config.proxy_roles.some(role => currentUserRoles.includes(role))
      )
    : services;

  // Otherwise render a simple services selection list so the user can choose a service
  const departments = {};
  visibleServices.forEach(s => {
    const dept = s.category || 'Other';
    if (!departments[dept]) departments[dept] = [];
    departments[dept].push(s);
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Apply for Service</h2>
      <p className="text-sm text-slate-600">Select a department and then a service to start your application.</p>

      {Object.entries(departments).length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
          {isProxyUser ? 'No proxy-enabled services are available for your role.' : 'No services available.'}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(departments).map(([dept, deptServices]) => (
            <div key={dept} className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold">{dept.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {deptServices.map(s => (
                  <Link
                    key={s.service_id}
                    to={`/apply?service_id=${s.service_id}`}
                    className="inline-block rounded-2xl px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [frontendConfig, setFrontendConfig] = useState(null);
  const [locale, setLocale] = useState(getStoredLocale());
  const [translations, setTranslations] = useState({});
  const [availableLocales, setAvailableLocales] = useState([]);
  const [theme, setTheme] = useState('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(''); // '', 'uploading', 'success', 'error'
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpdateStatus, setPasswordUpdateStatus] = useState(''); // '', 'saving', 'success', 'error'

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
          const proxyRoles = ['citizen_service_rep', 'csr'];
          const userRoles = [
            ...(userData?.role ? [userData.role] : []),
            ...(Array.isArray(userData?.roles) ? userData.roles : [])
          ].filter(Boolean);
          const isProxyUser = userRoles.some(role => proxyRoles.includes(role));
          if (userData.type === 'citizen' || userData.role === 'citizen' || isProxyUser) {
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
    
    // Fetch services if user is a proxy user (CSR)
    const proxyRoles = ['citizen_service_rep', 'csr'];
    const userRoles = [
      ...(adminData?.role ? [adminData.role] : []),
      ...(Array.isArray(adminData?.roles) ? adminData.roles : [])
    ].filter(Boolean);
    const isProxyUser = userRoles.some(role => proxyRoles.includes(role));
    
    if (isProxyUser) {
      await fetchServices(token);
    }
    
    setLoading(false);
  };

  const applyTheme = (themeKey) => {
    const isDark = themeKey === 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark);
    }
    localStorage.setItem('theme', themeKey);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const handleLocaleChange = async (newLocale) => {
    setLocale(newLocale);
    saveLocale(newLocale);
    await fetchLocalization(newLocale);
  };

  const handleLogout = () => {
    const isEmployee = user?.type === 'admin' || (user?.role && user?.role !== 'citizen');
    const savedTheme = localStorage.getItem('theme');
    const savedLocale = localStorage.getItem('locale');

    localStorage.clear();
    if (savedTheme) {
      localStorage.setItem('theme', savedTheme);
    }
    if (savedLocale) {
      localStorage.setItem('locale', savedLocale);
    }

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

  const handleSaveProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('You must be logged in to save changes.');
      return;
    }

    const trimmedName = editName.trim();
    const trimmedAddress = editAddress.trim();
    const currentName = frontendConfig?.user?.full_name || frontendConfig?.user?.name || '';
    const currentAddress = frontendConfig?.user?.address || '';

    const payload = {};
    if (trimmedName && trimmedName !== currentName) {
      payload.full_name = trimmedName;
    }
    if (trimmedAddress !== currentAddress) {
      payload.address = trimmedAddress || null;
    }

    if (Object.keys(payload).length === 0) {
      alert('No changes to save');
      return;
    }

    setSaveStatus('saving');
    try {
      const response = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchFrontendConfig(token);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(''), 2000);
      } else {
        const err = await response.json();
        alert(`Update failed: ${err.detail || 'Unknown error'}`);
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Network error during update');
      setSaveStatus('error');
    }
  };

  const handlePasswordUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('New password and confirm password do not match');
      return;
    }

    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }

    setPasswordUpdateStatus('saving');
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`${API_URL}/api/users/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      if (response.ok) {
        setPasswordUpdateStatus('success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordUpdateStatus(''), 2000);
      } else {
        const errData = await response.json();
        alert(`Password change failed: ${errData.detail || 'Unknown error'}`);
        setPasswordUpdateStatus('error');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Network error during password change');
      setPasswordUpdateStatus('error');
    }
  };

  if (loading) {
    return <div className="loading">Loading configuration...</div>;
  }

  if (!isAuthenticated) {
    return (
      <Router>
        <Routes>
          <Route path="/citizen" element={<LoginWrapper onLogin={handleLogin} onAdminLogin={handleAdminLogin} translations={translations} locale={locale} availableLocales={availableLocales} handleLocaleChange={handleLocaleChange} theme={theme} onToggleTheme={toggleTheme} />} />
          <Route path="/employee" element={<LoginWrapper onLogin={handleLogin} onAdminLogin={handleAdminLogin} translations={translations} locale={locale} availableLocales={availableLocales} handleLocaleChange={handleLocaleChange} theme={theme} onToggleTheme={toggleTheme} />} />
          <Route path="/" element={<Navigate to="/citizen" replace />} />
          <Route path="*" element={<Navigate to="/citizen" replace />} />
        </Routes>
      </Router>
    );
  }

  if (!frontendConfig) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const proxyRoles = ['citizen_service_rep', 'csr'];
  const currentUserRoles = [
    ...(frontendConfig?.user?.role ? [frontendConfig.user.role] : []),
    ...(Array.isArray(frontendConfig?.user?.roles) ? frontendConfig.user.roles : [])
  ].filter(Boolean);
  const isProxyUser = currentUserRoles.some(role => proxyRoles.includes(role));
  const canApply = frontendConfig.features?.can_apply || isProxyUser;
  const navigation = frontendConfig.navigation?.items || [];
  const isCitizen = frontendConfig.user?.type === 'citizen' || frontendConfig.user?.role === 'citizen';
  const isAdmin = !isCitizen;
  const canManageUsers = frontendConfig.features?.can_manage_users || false;
  const canManageRoles = frontendConfig.features?.can_manage_roles || false;
  const currentPath = window.location.pathname;
  const isPathActive = (path) => currentPath === path || (path !== '/' && currentPath.startsWith(path));

  const citizenMenu = [
    { label: 'Dashboard', path: '/' },
    ...(canApply ? [{ label: 'Apply for Service', path: '/apply' }] : []),
    { label: 'Track Application', path: '/track' },
  ];

  const adminMenu = [
    ...(isProxyUser ? [{ label: 'Submit Application', path: '/apply' }] : []),
    { label: 'Applications', path: '/admin/applications' },
    ...(canManageUsers ? [{ label: 'Users', path: '/admin/users' }] : []),
    ...(canManageRoles ? [{ label: 'Roles', path: '/admin/roles' }] : []),
    ...(canManageRoles ? [{ label: 'Services', path: '/admin/services' }] : []),
    ...(canManageRoles ? [{ label: 'Workflows', path: '/admin/workflows' }] : []),
    ...(canManageRoles ? [{ label: 'Localizations', path: '/admin/localizations' }] : []),
  ];

  return (
    <Router>
      <div className="app-layout">
        {/* Mobile Overlay */}
        <div 
          className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
          onClick={() => setIsSidebarOpen(false)}
        ></div>

        <aside className={`app-sidebar fixed inset-y-0 left-0 z-40 transform bg-white px-4 py-5 shadow-lg transition-transform duration-300 md:static md:translate-x-0 md:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="mb-8 flex items-center gap-3 border-b border-slate-200 pb-5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-govblue-600 text-white text-xl font-bold leading-none shadow-sm">
              <span className="leading-none">D</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Government Service</p>
              <h2 className="text-lg font-semibold text-slate-950">Digital Service Hub</h2>
            </div>
          </div>

          <nav className="space-y-1 mt-8">
            {(isCitizen ? citizenMenu : adminMenu).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) => `block rounded-3xl px-4 py-3 text-sm font-medium transition ${isActive ? 'bg-govblue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {item.icon ? <span className="mr-2 inline-flex align-middle">{item.icon}</span> : null}
                {item.label}
              </NavLink>
            ))}
          </nav>

          {user?.type === 'citizen' || user?.role === 'citizen' ? (
            <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-950">Departments</p>
              <div className="mt-3 space-y-2">
                {Object.entries(getServicesByDepartment()).map(([department, deptServices]) => (
                  <div key={department}>
                    <button
                      onClick={() => handleDepartmentClick(department)}
                      className="flex w-full items-center justify-between rounded-3xl bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-100"
                    >
                      <span>{department.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                      <span className="text-slate-500">{selectedDepartment === department ? '▾' : '▸'} {deptServices.length}</span>
                    </button>
                    {selectedDepartment === department && (
                      <div className="mt-2 space-y-1 px-3">
                        {deptServices.map(service => (
                          <Link
                            key={service.service_id}
                            to={`/apply?service_id=${service.service_id}`}
                            onClick={() => setIsSidebarOpen(false)}
                            className="block rounded-2xl px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                          >
                            {service.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <main className="app-main">
          <header className="app-header flex flex-col gap-4 px-4 py-4 md:px-6 md:flex-row md:items-start md:justify-between border-b border-slate-200 bg-white sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-govblue-500 hover:text-govblue-700 md:hidden"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label="Toggle navigation"
              >
                <Menu size={20} />
              </button>

              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Welcome back</p>
                <h1 className="text-2xl font-semibold text-slate-950">{translate(translations, 'app_title', 'Document Management System')}</h1>
                <p className="mt-1 text-sm text-slate-600">{translate(translations, 'welcome_message', 'Welcome')}, {frontendConfig.user?.name || 'User'}.</p>
                {frontendConfig.user?.role !== 'citizen' && (
                  <p className="mt-2 text-sm text-slate-500">
                    {translate(translations, 'role_label', 'Role')}: {frontendConfig.user?.role} · {translate(translations, 'department_label', 'Department')}: {frontendConfig.user?.department || 'N/A'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <Select value={locale} onChange={(e) => handleLocaleChange(e.target.value)} className="bg-transparent border-none p-2 min-w-[120px] text-sm font-medium text-slate-900">
                  {availableLocales && availableLocales.length > 0 ? (
                    availableLocales.map((loc) => {
                      const locCode = typeof loc === 'string'
                        ? loc
                        : loc?.locale || loc?.code || loc?.value || loc?.name || 'en';
                      const locLabel = typeof loc === 'string'
                        ? loc.toUpperCase()
                        : loc?.display_name || loc?.name || String(locCode);
                      return <option key={String(locCode)} value={String(locCode)}>{locLabel}</option>;
                    })
                  ) : (
                    <>
                      <option value="en">English</option>
                      <option value="am">አማርኛ</option>
                    </>
                  )}
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <NotificationsDropdown />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { 
                    setEditName(frontendConfig?.user?.full_name || frontendConfig?.user?.name || ''); 
                    setEditAddress(frontendConfig?.user?.address || '');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setIsProfileModalOpen(true); 
                  }}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                >
                  {frontendConfig?.user?.profile_picture_url ? (
                    <img src={`${API_URL}${frontendConfig.user.profile_picture_url}`} alt="Profile" className="block h-full w-full rounded-2xl object-cover" />
                  ) : (
                    (frontendConfig?.user?.full_name || frontendConfig?.user?.name || 'U').charAt(0).toUpperCase()
                  )}
                </button>

                <Button variant="danger" onClick={handleLogout}>{translate(translations, 'logout', 'Logout')}</Button>
              </div>
            </div>
          </header>

          <div className="app-content">
            <Routes>
              {/* Dashboard - Main page */}
              <Route path="/" element={<DynamicDashboard config={frontendConfig} user={user} />} />
              
              {/* Apply - Only for citizens with service_id parameter */}
              {canApply && (
                <Route path="/apply" element={<ApplyWrapper user={user} services={services} />} />
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

        <Modal
          open={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          title="Edit Profile"
          description="Update your profile information, address, and password."
        >
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
              <div className="space-y-4 rounded-3xl bg-slate-50 p-4 text-center">
                {previewUrl ? (
                  <div className="mx-auto h-28 w-28 overflow-hidden rounded-3xl bg-slate-100">
                    <img src={previewUrl} alt="Profile preview" className="block h-full w-full object-cover" />
                  </div>
                ) : frontendConfig?.user?.profile_picture_url ? (
                  <div className="mx-auto h-28 w-28 overflow-hidden rounded-3xl bg-slate-100">
                    <img src={`${API_URL}${frontendConfig.user.profile_picture_url}`} alt="Current profile" className="block h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="mx-auto grid h-28 w-28 place-items-center rounded-3xl bg-govblue-600 text-3xl font-semibold text-white">
                    {(frontendConfig?.user?.full_name || frontendConfig?.user?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <Badge variant="info">{frontendConfig?.user?.role || 'Citizen'}</Badge>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Full name</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Enter your name" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Address</label>
                  <Input 
                    value={editAddress} 
                    onChange={(e) => setEditAddress(e.target.value)} 
                    placeholder="Enter your address" 
                  />
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={saveStatus === 'saving'}
                    className="w-full"
                  >
                    {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved' : 'Save Changes'}
                  </Button>
                </div>

                {/* Profile picture - moved up for better visibility */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Profile picture</label>
                  {!previewUrl ? (
                    <button
                      type="button"
                      onClick={() => document.getElementById('profile-upload-input').click()}
                      className="flex min-h-[100px] w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500 transition hover:border-govblue-500 hover:bg-slate-100"
                    >
                      <span className="text-2xl">📸</span>
                      <span>Click to upload</span>
                      <span className="text-xs text-slate-400">JPG, PNG or WebP · max 5MB</span>
                      <input
                        id="profile-upload-input"
                        type="file"
                        accept="image/jpeg, image/png, image/webp"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </button>
                  ) : (
                    <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                      <div className="h-32 overflow-hidden rounded-3xl">
                        <img src={previewUrl} alt="Selected file" className="block h-full w-full object-cover" />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{selectedFile?.name}</p>
                          <p className="text-xs text-slate-500">{(selectedFile?.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button type="button" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="rounded-2xl border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-100">
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                  {uploadStatus === 'success' && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      Profile picture updated successfully.
                    </div>
                  )}
                  <Button onClick={handleProfileUpload} disabled={!selectedFile || uploadStatus === 'uploading' || uploadStatus === 'success'} className="w-full">
                    {uploadStatus === 'uploading' ? 'Uploading...' : uploadStatus === 'success' ? 'Done' : 'Upload Picture'}
                  </Button>
                </div>

                {/* Password change - Only for non-citizen users */}
                {frontendConfig?.user?.role !== 'citizen' && frontendConfig?.user?.type !== 'citizen' && (
                  <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">Change Password</h3>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-600">Current password</label>
                      <Input 
                        type="password" 
                        value={currentPassword} 
                        onChange={(e) => setCurrentPassword(e.target.value)} 
                        placeholder="Enter current password" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-600">New password</label>
                      <Input 
                        type="password" 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        placeholder="Min 8 characters" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-600">Confirm new password</label>
                      <Input 
                        type="password" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        placeholder="Confirm new password" 
                      />
                    </div>
                    <Button
                      onClick={handlePasswordUpdate}
                      disabled={passwordUpdateStatus === 'saving'}
                      className="w-full"
                      variant="secondary"
                    >
                      {passwordUpdateStatus === 'saving' ? 'Changing...' : passwordUpdateStatus === 'success' ? 'Changed' : 'Change Password'}
                    </Button>
                    {passwordUpdateStatus === 'success' && (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        Password changed successfully.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </Router>
  );
}

export default App;