import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:8000';

function AdminDashboard({ user }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  const [availableActions, setAvailableActions] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [activeTab, setActiveTab] = useState('applications');
  
  // State for Application Pagination & Filtering
  const [appSearchTerm, setAppSearchTerm] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [appCurrentPage, setAppCurrentPage] = useState(1);
  const appItemsPerPage = 10;
  
  // State for User Management
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ 
    username: '', 
    email: '', 
    phone_number: '', 
    full_name: '', 
    role: 'citizen', 
    department: '', 
    hierarchy_country: '',
    hierarchy_region: '',
    hierarchy_zone: '',
    hierarchy_woreda: '',
    hierarchy_kebele: '',
    password: '' 
  });
  
  // State for Role Management
  const [roles, setRoles] = useState([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleForm, setRoleForm] = useState({ 
    role_name: '', 
    display_name: '', 
    description: '', 
    permissions: [], 
    is_system_role: false
  });

  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.reload();
      throw new Error('Session expired');
    }
    return response;
  };

  // Check if user has specific permission
  const hasPermission = (permission) => {
    return userPermissions.includes(permission);
  };

  useEffect(() => {
    fetchDashboardData();
    fetchUserPermissions();
    fetchStatusConfig();
  }, []);

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === 'users' && hasPermission('manage_users')) {
      fetchUsers();
    }
    if (activeTab === 'roles' && hasPermission('manage_roles')) {
      fetchRoles();
    }
  }, [activeTab]);

  // Reset application page on filter change
  useEffect(() => {
    setAppCurrentPage(1);
  }, [appSearchTerm, appStatusFilter]);

  const fetchUserPermissions = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/permissions`);
      const data = await response.json();
      setUserPermissions(data.permissions || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/dashboard/department`);
      const data = await response.json();
      setDashboardData(data);
      setApplications(data.applications || []);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

const fetchUsers = async () => {
  try {
    console.log('Fetching users...');
    console.log('Has manage_users permission?', hasPermission('manage_users'));
    console.log('User permissions:', userPermissions);
    
    const response = await authFetch(`${API_URL}/api/admin/users`);
    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Users data:', data);
    setUsers(data.users || []);
  } catch (error) {
    console.error('Error fetching users:', error);
  }
};

  const fetchRoles = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/roles`);
      const data = await response.json();
      setRoles(data.roles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const createUser = async () => {
    if (!userForm.phone_number || !userForm.full_name) {
      alert('Phone number and full name are required');
      return;
    }
    try {
      const response = await authFetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        body: JSON.stringify(userForm)
      });
      if (response.ok) {
        alert('User created successfully!');
        setShowUserModal(false);
        fetchUsers();
        setUserForm({ 
          username: '', 
          email: '', 
          phone_number: '', 
          full_name: '', 
          role: 'citizen', 
          department: '', 
          hierarchy_country: '',
          hierarchy_region: '',
          hierarchy_zone: '',
          hierarchy_woreda: '',
          hierarchy_kebele: '',
          password: '' 
        });
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to create user'}`);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error creating user');
    }
  };

  const updateUser = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/users/${editingUser.user_id}`, {
        method: 'PUT',
        body: JSON.stringify(userForm)
      });
      if (response.ok) {
        alert('User updated successfully!');
        setShowUserModal(false);
        setEditingUser(null);
        fetchUsers();
        setUserForm({ 
          username: '', 
          email: '', 
          phone_number: '', 
          full_name: '', 
          role: 'citizen', 
          department: '', 
          hierarchy_country: '',
          hierarchy_region: '',
          hierarchy_zone: '',
          hierarchy_woreda: '',
          hierarchy_kebele: '',
          password: '' 
        });
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const deleteUser = async (userId, username) => {
    if (confirm(`Are you sure you want to delete user "${username}"?`)) {
      try {
        const response = await authFetch(`${API_URL}/api/admin/users/${userId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          alert('User deactivated successfully!');
          fetchUsers();
        } else {
          const error = await response.json();
          alert(`Error: ${error.detail}`);
        }
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const createRole = async () => {
    if (!roleForm.role_name || !roleForm.display_name) {
      alert('Role name and display name are required');
      return;
    }
    try {
      const response = await authFetch(`${API_URL}/api/admin/roles`, {
        method: 'POST',
        body: JSON.stringify({
          role_name: roleForm.role_name,
          display_name: roleForm.display_name,
          description: roleForm.description,
          permissions: roleForm.permissions,
          is_system_role: roleForm.is_system_role
        })
      });
      if (response.ok) {
        alert('Role created successfully!');
        setShowRoleModal(false);
        fetchRoles();
        setRoleForm({ 
          role_name: '', 
          display_name: '', 
          description: '', 
          permissions: [], 
          is_system_role: false 
        });
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to create role'}`);
      }
    } catch (error) {
      console.error('Error creating role:', error);
      alert('Error creating role');
    }
  };

  const getAvailableActionsForApp = async (applicationId, currentState) => {
    try {
      const response = await authFetch(`${API_URL}/api/applications/${applicationId}/available-actions`);
      const data = await response.json();
      setAvailableActions(data.actions || []);
    } catch (error) {
      console.error('Error fetching actions:', error);
    }
  };

  const updateApplicationStatus = async (applicationId, action, comment, assignTo = null) => {
    try {
      const response = await authFetch(`${API_URL}/api/applications/${applicationId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          action: action,
          user_id: user?.username || user?.user_id,
          comment: comment,
          assign_to: assignTo
        })
      });
      
      if (response.ok) {
        alert(`Application ${action} successfully!`);
        setSelectedApp(null);
        fetchDashboardData();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to update status'}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating application status');
    }
  };

  const [statusConfig, setStatusConfig] = useState({ names: {}, colors: {} });

  const fetchStatusConfig = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/workflow/status-config`);
      const data = await response.json();
      setStatusConfig(data);
    } catch (error) {
      console.error('Error fetching status config:', error);
    }
  };

  const getStatusColor = (status) => {
    return statusConfig.colors[status] || '#6b7280';
  };

  const getStatusDisplayName = (status) => {
    return statusConfig.names[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };


  // Application Filtering and Pagination Logic
  const filteredApps = applications.filter(app => {
    const matchesSearch = 
      (app.application_id && app.application_id.toLowerCase().includes(appSearchTerm.toLowerCase())) ||
      (app.user_name && app.user_name.toLowerCase().includes(appSearchTerm.toLowerCase())) ||
      (app.service_type && app.service_type.replace(/_/g, ' ').toLowerCase().includes(appSearchTerm.toLowerCase()));
    
    const matchesStatus = appStatusFilter ? app.current_state === appStatusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const sortedApps = [...filteredApps].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
    const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
    return dateB - dateA;
  });

  const appTotalPages = Math.max(1, Math.ceil(sortedApps.length / appItemsPerPage));
  const appIndexOfLast = appCurrentPage * appItemsPerPage;
  const appIndexOfFirst = appIndexOfLast - appItemsPerPage;
  const currentApps = sortedApps.slice(appIndexOfFirst, appIndexOfLast);

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div>
      {/* Role Info Card */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: 'white' }}>
        <h2>Admin Dashboard</h2>
        <p>Welcome, {user?.name || user?.username}!</p>
        <p>Role: <strong>{user?.role}</strong> | Department: <strong>{user?.department}</strong></p>
        {userPermissions.length > 0 && (
          <div style={{ marginTop: '10px', fontSize: '12px' }}>
            <strong>Your Permissions:</strong> {userPermissions.join(', ')}
          </div>
        )}
        <div style={{ display: 'flex', gap: '20px', marginTop: '15px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{dashboardData?.stats?.total || 0}</div>
            <div style={{ fontSize: '12px' }}>Available Applications</div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fbbf24' }}>{dashboardData?.stats?.pending || 0}</div>
            <div style={{ fontSize: '12px' }}>Pending</div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4ade80' }}>{dashboardData?.stats?.completed || 0}</div>
            <div style={{ fontSize: '12px' }}>Completed</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="card">
        <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #e5e7eb', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('applications')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'applications' ? '#2563eb' : 'transparent',
              color: activeTab === 'applications' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer'
            }}
          >
            📋 Applications ({applications.length})
          </button>
          
          {hasPermission('manage_users') && (
            <button
              onClick={() => setActiveTab('users')}
              style={{
                padding: '10px 20px',
                background: activeTab === 'users' ? '#2563eb' : 'transparent',
                color: activeTab === 'users' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer'
              }}
            >
              👥 User Management ({users.length})
            </button>
          )}
          
          {hasPermission('manage_roles') && (
            <button
              onClick={() => setActiveTab('roles')}
              style={{
                padding: '10px 20px',
                background: activeTab === 'roles' ? '#2563eb' : 'transparent',
                color: activeTab === 'roles' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer'
              }}
            >
              🎭 Role Management ({roles.length})
            </button>
          )}
        </div>

        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <div>
            <h3>Applications to Process</h3>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                placeholder="Search by ID, Applicant or Service..." 
                value={appSearchTerm}
                onChange={(e) => setAppSearchTerm(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', flex: 1, minWidth: '200px' }}
              />
              <select 
                value={appStatusFilter} 
                onChange={(e) => setAppStatusFilter(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="">All Statuses</option>
                {Object.entries(statusConfig.names || {}).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            
            {filteredApps.length === 0 ? (
              <p>{applications.length === 0 ? "No applications available for your department." : "No applications match your search."}</p>
            ) : (
              <div>
                {currentApps.map(app => (
                <div key={app.application_id} style={{ 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px', 
                  padding: '15px', 
                  marginBottom: '15px',
                  background: selectedApp?.application_id === app.application_id ? '#f3f4f6' : 'white'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <p><strong>ID:</strong> {app.application_id}</p>
                      <p><strong>Service:</strong> {app.service_type?.replace('_', ' ').toUpperCase()}</p>
                      <p><strong>Applicant:</strong> {app.user_name}</p>
                      <p><strong>Submitted:</strong> {new Date(app.created_at).toLocaleDateString()}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ 
                        background: getStatusColor(app.current_state), 
                        color: 'white', 
                        padding: '4px 12px', 
                        borderRadius: '20px',
                        fontSize: '12px',
                        display: 'inline-block'
                      }}>
                        {getStatusDisplayName(app.current_state)}
                      </span>
                      <button 
                        onClick={() => {
                          setSelectedApp(selectedApp?.application_id === app.application_id ? null : app);
                          if (selectedApp?.application_id !== app.application_id) {
                            getAvailableActionsForApp(app.application_id, app.current_state);
                          }
                        }}
                        style={{ marginLeft: '10px', padding: '6px 12px', fontSize: '12px' }}
                      >
                        {selectedApp?.application_id === app.application_id ? 'Close' : 'Take Action'}
                      </button>
                    </div>
                  </div>

                  {selectedApp?.application_id === app.application_id && (
                    <div style={{ marginTop: '15px', borderTop: '1px solid #e5e7eb', paddingTop: '15px' }}>
                      <h4>Application Details</h4>
                      
                      {/* Display form data in a readable format */}
                      {app.form_data && (
                        <div style={{ marginBottom: '20px' }}>
                          <h5 style={{ marginBottom: '10px', color: '#374151' }}>Submitted Information:</h5>
                          <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                            {Object.entries(app.form_data).map(([key, value]) => {
                              // If value is an object (like step data) or a URL, render it nicely
                              if (typeof value === 'object' && value !== null) {
                                return (
                                  <div key={key} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 'bold', color: '#374151', textTransform: 'capitalize' }}>
                                      {key.replace(/_/g, ' ')}:
                                    </span>
                                    <pre style={{ background: '#e5e7eb', padding: '5px', borderRadius: '4px', fontSize: '11px', marginTop: '5px' }}>
                                      {JSON.stringify(value, null, 2)}
                                    </pre>
                                  </div>
                                );
                              }
                              // Handle MinIO URLs
                              if (typeof value === 'string' && value.startsWith('http')) {
                                return (
                                  <div key={key} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 'bold', color: '#374151', textTransform: 'capitalize' }}>
                                      {key.replace(/_/g, ' ')}:
                                    </span>
                                    <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
                                      View File
                                    </a>
                                  </div>
                                );
                              }
                              return (
                                <div key={key} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontWeight: 'bold', color: '#374151', textTransform: 'capitalize' }}>
                                    {key.replace(/_/g, ' ')}:
                                  </span>
                                  <span style={{ color: '#6b7280' }}>
                                    {value || 'Not provided'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Raw JSON for debugging */}
                      <details style={{ marginBottom: '15px' }}>
                        <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#6b7280' }}>
                          View Raw Data (JSON)
                        </summary>
                        <pre style={{ background: '#f9fafb', padding: '10px', borderRadius: '8px', overflow: 'auto', fontSize: '11px', maxHeight: '150px', marginTop: '5px' }}>
                          {JSON.stringify(app.form_data, null, 2)}
                        </pre>
                      </details>
                      
                      <h4 style={{ marginTop: '15px' }}>Available Actions</h4>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                        {availableActions.map(action => {
                          const actionDef = statusConfig.action_definitions?.[action] || {};
                          const label = actionDef.display_label || action.replace(/_/g, ' ');
                          return (
                          <button
                            key={action}
                            onClick={() => {
                              let assignTo = null;
                              if (action === 'ASSIGN_TO_LME') {
                                assignTo = prompt(`Enter specific LME User ID, or leave blank to make available to all LMEs in department:`);
                                if (assignTo === null) return; // User cancelled
                              }
                              const comment = prompt(`Enter comment for ${label}:`);
                              if (comment !== null) {
                                updateApplicationStatus(app.application_id, action, comment, assignTo);
                              }
                            }}
                            style={{
                              background: action.includes('REJECT') || action.includes('CANCEL') ? '#dc2626' : '#2563eb',
                              padding: '8px 16px'
                            }}
                          >
                            {label}
                          </button>
                          );
                        })}
                      </div>
                      
                      {app.history && app.history.length > 0 && (
                        <>
                          <h4 style={{ marginTop: '15px' }}>History</h4>
                          <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                            {app.history.map((entry, idx) => (
                              <div key={idx} style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', fontSize: '12px' }}>
                                <strong>{entry.state}</strong> - {new Date(entry.timestamp).toLocaleString()}
                                {entry.comment && <div style={{ color: '#6b7280' }}>Comment: {entry.comment}</div>}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Pagination Controls */}
              {appTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
                  <button 
                    onClick={() => setAppCurrentPage(prev => Math.max(prev - 1, 1))} 
                    disabled={appCurrentPage === 1}
                    style={{ padding: '6px 12px', background: appCurrentPage === 1 ? '#e5e7eb' : '#2563eb', color: appCurrentPage === 1 ? '#9ca3af' : 'white', border: 'none', borderRadius: '4px', cursor: appCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: '14px' }}>
                    Page {appCurrentPage} of {appTotalPages}
                  </span>
                  <button 
                    onClick={() => setAppCurrentPage(prev => Math.min(prev + 1, appTotalPages))} 
                    disabled={appCurrentPage === appTotalPages}
                    style={{ padding: '6px 12px', background: appCurrentPage === appTotalPages ? '#e5e7eb' : '#2563eb', color: appCurrentPage === appTotalPages ? '#9ca3af' : 'white', border: 'none', borderRadius: '4px', cursor: appCurrentPage === appTotalPages ? 'not-allowed' : 'pointer' }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
            )}
          </div>
        )}

        {/* Users Tab - User Management */}
        {activeTab === 'users' && hasPermission('manage_users') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h3>System Users</h3>
              <button 
                onClick={() => {
                  setEditingUser(null);
                  setUserForm({ username: '', password: '', role: 'viewer', name: '' });
                  setShowUserModal(true);
                }}
                style={{ background: '#22c55e', padding: '10px 20px' }}
              >
                + Add New User
              </button>
            </div>
            
            {users.length === 0 ? (
              <p>No users found. Click "Add New User" to create one.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                      <th style={{ padding: '12px' }}>Phone Number</th>
                      <th style={{ padding: '12px' }}>Full Name</th>
                      <th style={{ padding: '12px' }}>Username</th>
                      <th style={{ padding: '12px' }}>Role</th>
                      <th style={{ padding: '12px' }}>Department</th>
                      <th style={{ padding: '12px' }}>Status</th>
                      <th style={{ padding: '12px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.user_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px' }}><code>{u.phone_number}</code></td>
                        <td style={{ padding: '12px' }}>{u.full_name}</td>
                        <td style={{ padding: '12px' }}>{u.username || '-'}</td>
                        <td style={{ padding: '12px' }}>{u.role}</td>
                        <td style={{ padding: '12px' }}>{u.department || '-'}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            background: u.is_active ? '#dcfce7' : '#fee2e2', 
                            color: u.is_active ? '#166534' : '#991b1b',
                            padding: '2px 8px', 
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <button 
                            onClick={() => {
                              setEditingUser(u);
                              setUserForm({ 
                                username: u.username || '', 
                                email: u.email || '',
                                phone_number: u.phone_number,
                                full_name: u.full_name,
                                role: u.role, 
                                department: u.department || '',
                                hierarchy_country: u.hierarchy_country || '',
                                hierarchy_region: u.hierarchy_region || '',
                                hierarchy_zone: u.hierarchy_zone || '',
                                hierarchy_woreda: u.hierarchy_woreda || '',
                                hierarchy_kebele: u.hierarchy_kebele || '',
                                password: '' 
                              });
                              setShowUserModal(true);
                            }}
                            style={{ background: '#f59e0b', marginRight: '10px', padding: '6px 12px' }}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => deleteUser(u.user_id, u.full_name)}
                            style={{ background: '#dc2626', padding: '6px 12px' }}
                            disabled={u.user_id === user?.user_id}
                            title={u.user_id === user?.user_id ? "Cannot delete yourself" : ""}
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Roles Tab - Role Management */}
        {activeTab === 'roles' && hasPermission('manage_roles') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h3>System Roles</h3>
              <button 
                onClick={() => {
                  setRoleForm({ 
                    role_name: '', 
                    display_name: '', 
                    description: '', 
                    permissions: [], 
                    is_system_role: false 
                  });
                  setShowRoleModal(true);
                }}
                style={{ background: '#22c55e', padding: '10px 20px' }}
              >
                + Create New Role
              </button>
            </div>
            
            {roles.length === 0 ? (
              <p>No roles found. Click "Create New Role" to create one.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                      <th style={{ padding: '12px' }}>Role ID</th>
                      <th style={{ padding: '12px' }}>Name</th>
                      <th style={{ padding: '12px' }}>Description</th>
                      <th style={{ padding: '12px' }}>Departments</th>
                      <th style={{ padding: '12px' }}>Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map(r => (
                      <tr key={r.role_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px' }}><code>{r.role_id}</code></td>
                        <td style={{ padding: '12px' }}>{r.name}</td>
                        <td style={{ padding: '12px' }}>{r.description}</td>
                        <td style={{ padding: '12px' }}>{r.departments?.join(', ') || '-'}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: '#e5e7eb', padding: '2px 8px', borderRadius: '20px', fontSize: '12px' }}>
                            {r.permissions?.length || 0} permissions
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Modal - Create/Edit User */}
      {showUserModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000 
        }}>
          <div className="card" style={{ maxWidth: '600px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3>{editingUser ? 'Edit User' : 'Create New User'}</h3>
            
            <div className="form-group">
              <label>Phone Number *</label>
              <input 
                type="text" 
                value={userForm.phone_number} 
                onChange={(e) => setUserForm({...userForm, phone_number: e.target.value})}
                disabled={editingUser}
                placeholder="Enter phone number"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Full Name *</label>
              <input 
                type="text" 
                value={userForm.full_name} 
                onChange={(e) => setUserForm({...userForm, full_name: e.target.value})}
                placeholder="Enter full name"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Username (optional)</label>
              <input 
                type="text" 
                value={userForm.username} 
                onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                placeholder="Enter username for admin login"
              />
            </div>
            
            <div className="form-group">
              <label>Email (optional)</label>
              <input 
                type="email" 
                value={userForm.email} 
                onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                placeholder="Enter email address"
              />
            </div>
            
            <div className="form-group">
              <label>Role *</label>
              <select 
                value={userForm.role} 
                onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                required
              >
                <option value="citizen">Citizen</option>
                <option value="verification_officer">Verification Officer</option>
                <option value="verification_supervisor">Verification Supervisor</option>
                <option value="senior_verifier">Senior Verifier</option>
                <option value="document_verifier">Document Verifier</option>
                <option value="document_specialist">Document Specialist</option>
                <option value="payment_officer">Payment Officer</option>
                <option value="issuance_officer">Certificate Officer</option>
                <option value="quality_checker">Quality Checker</option>
                <option value="system_admin">System Administrator</option>
                <option value="super_admin">Super Administrator</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Department</label>
              <input 
                type="text" 
                value={userForm.department} 
                onChange={(e) => setUserForm({...userForm, department: e.target.value})}
                placeholder="Enter department"
              />
            </div>
            
            {/* Hierarchy fields for admin users */}
            {userForm.role !== 'citizen' && (
              <>
                <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#374151' }}>Geographic Jurisdiction</h4>
                <div className="form-group">
                  <label>Country</label>
                  <input 
                    type="text" 
                    value={userForm.hierarchy_country} 
                    onChange={(e) => setUserForm({...userForm, hierarchy_country: e.target.value})}
                    placeholder="e.g., ETH"
                  />
                </div>
                <div className="form-group">
                  <label>Region</label>
                  <input 
                    type="text" 
                    value={userForm.hierarchy_region} 
                    onChange={(e) => setUserForm({...userForm, hierarchy_region: e.target.value})}
                    placeholder="e.g., oromia"
                  />
                </div>
                <div className="form-group">
                  <label>Zone</label>
                  <input 
                    type="text" 
                    value={userForm.hierarchy_zone} 
                    onChange={(e) => setUserForm({...userForm, hierarchy_zone: e.target.value})}
                    placeholder="e.g., bale"
                  />
                </div>
                <div className="form-group">
                  <label>Woreda</label>
                  <input 
                    type="text" 
                    value={userForm.hierarchy_woreda} 
                    onChange={(e) => setUserForm({...userForm, hierarchy_woreda: e.target.value})}
                    placeholder="e.g., sinana"
                  />
                </div>
                <div className="form-group">
                  <label>Kebele</label>
                  <input 
                    type="text" 
                    value={userForm.hierarchy_kebele} 
                    onChange={(e) => setUserForm({...userForm, hierarchy_kebele: e.target.value})}
                    placeholder="e.g., kebele name"
                  />
                </div>
              </>
            )}
            
            <div className="form-group">
              <label>Password {editingUser && '(leave blank to keep unchanged)'}</label>
              <input 
                type="password" 
                value={userForm.password} 
                onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                placeholder={editingUser ? 'Enter new password' : 'Enter password'}
                required={!editingUser}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setShowUserModal(false)} style={{ background: '#6b7280' }}>Cancel</button>
              <button onClick={editingUser ? updateUser : createUser} style={{ background: '#2563eb' }}>
                {editingUser ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Modal - Create Role */}
      {showRoleModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000 
        }}>
          <div className="card" style={{ maxWidth: '600px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3>Create New Role</h3>
            <div className="form-group">
              <label>Role Name (unique identifier) *</label>
              <input 
                type="text" 
                value={roleForm.role_name} 
                onChange={(e) => setRoleForm({...roleForm, role_name: e.target.value.toLowerCase().replace(/\s/g, '_')})}
                placeholder="e.g., compliance_officer"
                required
              />
            </div>
            <div className="form-group">
              <label>Display Name *</label>
              <input 
                type="text" 
                value={roleForm.display_name} 
                onChange={(e) => setRoleForm({...roleForm, display_name: e.target.value})}
                placeholder="e.g., Compliance Officer"
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea 
                value={roleForm.description} 
                onChange={(e) => setRoleForm({...roleForm, description: e.target.value})}
                rows="2"
                placeholder="Describe what this role does"
              />
            </div>
            <div className="form-group">
              <label>
                <input 
                  type="checkbox" 
                  checked={roleForm.is_system_role} 
                  onChange={(e) => setRoleForm({...roleForm, is_system_role: e.target.checked})}
                />
                System Role (cannot be modified by regular admins)
              </label>
            </div>
            <div className="form-group">
              <label>Permissions</label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '10px', 
                maxHeight: '300px', 
                overflow: 'auto', 
                padding: '10px', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px' 
              }}>
                {[
                  'view_all_applications', 'view_department_applications', 'update_status', 'delete_applications',
                  'verify_applications', 'reject_applications', 'process_payments', 'issue_certificates',
                  'view_admin_dashboard', 'manage_users', 'manage_roles', 'export_data', 'generate_reports',
                  'add_comments', 'audit_applications', 'flag_issues'
                ].map(perm => (
                  <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      checked={roleForm.permissions.includes(perm)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRoleForm({...roleForm, permissions: [...roleForm.permissions, perm]});
                        } else {
                          setRoleForm({...roleForm, permissions: roleForm.permissions.filter(p => p !== perm)});
                        }
                      }}
                    />
                    {perm}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setShowRoleModal(false)} style={{ background: '#6b7280' }}>Cancel</button>
              <button onClick={createRole} style={{ background: '#2563eb' }}>Create Role</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;