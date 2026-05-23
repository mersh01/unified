import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

function PaginatedApplicationsList({ applications, section }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = section.limit || 10;

  const filteredApps = applications.filter(app => {
    const matchesSearch = 
      (app.application_id && app.application_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (app.user_name && app.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (app.service_type && app.service_type.replace(/_/g, ' ').toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter ? app.current_state === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const sortedApps = [...filteredApps].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
    const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
    return dateB - dateA;
  });

  const totalPages = Math.max(1, Math.ceil(sortedApps.length / itemsPerPage));
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentApps = sortedApps.slice(indexOfFirst, indexOfLast);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  return (
    <div className="dashboard-section">
      <div className="dashboard-section-header">
        <h3 className="dashboard-section-title">{section.title}</h3>
      </div>
      
      {applications.length > 0 && (
        <div className="dashboard-search-bar">
          <input 
            type="text" 
            placeholder="Search by ID, Applicant or Service..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="dashboard-search-input"
          />
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="dashboard-filter-select"
          >
            <option value="">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="VERIFICATION">Under Verification</option>
            <option value="DOCUMENT_VERIFICATION">Document Verification</option>
            <option value="PAYMENT_PENDING">Payment Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      )}

      {filteredApps.length === 0 ? (
        <div className="dashboard-empty-state">
          <div className="dashboard-empty-icon">📋</div>
          <p className="dashboard-empty-text">{applications.length === 0 ? "No applications found." : "No applications match your search."}</p>
        </div>
      ) : (
        currentApps.map(app => (
          <div key={app.application_id} className="dashboard-application-card">
            <div className="dashboard-app-info">
              <div className="dashboard-app-info-item">
                <span className="dashboard-app-info-label">ID</span>
                <span className="dashboard-app-info-value">{app.application_id}</span>
              </div>
              <div className="dashboard-app-info-item">
                <span className="dashboard-app-info-label">Service</span>
                <span className="dashboard-app-info-value">{app.service_type?.replace(/_/g, ' ').toUpperCase()}</span>
              </div>
              <div className="dashboard-app-info-item">
                <span className="dashboard-app-info-label">Applicant</span>
                <span className="dashboard-app-info-value">{app.user_name}</span>
              </div>
              <div className="dashboard-app-info-item">
                <span className="dashboard-app-info-label">Status</span>
                <span className="dashboard-app-info-value">{app.current_state}</span>
              </div>
              <div className="dashboard-app-info-item">
                <span className="dashboard-app-info-label">Submitted</span>
                <span className="dashboard-app-info-value">{new Date(app.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="dashboard-app-actions">
              <Link to={`/track?appId=${app.application_id}`} className="dashboard-view-btn">
                View Details →
              </Link>
            </div>
          </div>
        ))
      )}

      {totalPages > 1 && (
        <div className="dashboard-pagination">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
            disabled={currentPage === 1}
            className="dashboard-pagination-btn"
          >
            Previous
          </button>
          <span className="dashboard-pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
            disabled={currentPage === totalPages}
            className="dashboard-pagination-btn"
          >
            Next
          </button>
        </div>
      )}

      {section.show_view_all && applications.length > itemsPerPage && (
        <div style={{ textAlign: 'center', marginTop: '15px' }}>
          <Link to={section.view_all_link}>
            <button style={{ background: '#6b7280' }}>View All {applications.length} Applications</button>
          </Link>
        </div>
      )}
    </div>
  );
}

function DynamicDashboard({ config, user }) {
  const [sectionData, setSectionData] = useState({});
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'viewer', name: '' });
  const [roles, setRoles] = useState([]);

  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      localStorage.clear();
      window.location.href = '/';
    }
    return response;
  };

  useEffect(() => {
    loadAllSections();
    if (config.features?.can_manage_roles) {
      fetchRoles();
    }
  }, []);

  const loadAllSections = async () => {
    setLoading(true);
    const sections = config.dashboard?.sections || [];
    const data = {};
    
    for (const section of sections) {
      if (section.endpoint) {
        try {
          const response = await authFetch(`${API_URL}${section.endpoint}`);
          const result = await response.json();
          data[section.id] = result;
        } catch (error) {
          console.error(`Error loading section ${section.id}:`, error);
          data[section.id] = { error: true, data: [] };
        }
      }
    }
    
    setSectionData(data);
    setLoading(false);
  };

  const fetchRoles = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/roles`);
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const createUser = async () => {
    if (!userForm.username || !userForm.password) {
      alert('Username and password are required');
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
        loadAllSections();
        setUserForm({ username: '', password: '', role: 'viewer', name: '' });
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to create user'}`);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error creating user');
    }
  };

  const deleteUser = async (username) => {
    if (confirm(`Are you sure you want to delete user "${username}"?`)) {
      try {
        const response = await authFetch(`${API_URL}/api/admin/users/${username}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          alert('User deleted successfully!');
          loadAllSections();
        } else {
          const error = await response.json();
          alert(`Error: ${error.detail}`);
        }
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const renderSection = (section) => {
    const data = sectionData[section.id];
    
    switch (section.type) {
      case 'stats_cards':
        const stats = data || {};
        return (
          <div className="dashboard-grid">
            <div className="dashboard-stats-card">
              <div className="dashboard-stats-icon primary">📊</div>
              <div className="dashboard-stats-value">{stats.total || 0}</div>
              <div className="dashboard-stats-label">Total Applications</div>
            </div>
            <div className="dashboard-stats-card">
              <div className="dashboard-stats-icon warning">⏳</div>
              <div className="dashboard-stats-value">{stats.pending || 0}</div>
              <div className="dashboard-stats-label">In Progress</div>
            </div>
            <div className="dashboard-stats-card">
              <div className="dashboard-stats-icon success">✓</div>
              <div className="dashboard-stats-value">{stats.completed || 0}</div>
              <div className="dashboard-stats-label">Completed</div>
            </div>
          </div>
        );

      case 'quick_actions':
        return (
          <div className="card">
            <h3>{section.title}</h3>
            <div style={{ display: 'flex', gap: '15px', marginTop: '15px', flexWrap: 'wrap' }}>
              {section.actions?.map(action => (
                <Link key={action.link} to={action.link}>
                  <button>{action.icon} {action.label}</button>
                </Link>
              ))}
            </div>
          </div>
        );

      case 'applications_list':
        const applications = Array.isArray(data) ? data : data?.applications || [];
        return <PaginatedApplicationsList key={section.id} applications={applications} section={section} />;

      case 'users_table':
        const users = data || [];
        return (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>{section.title}</h3>
              <button onClick={() => setShowUserModal(true)} style={{ background: '#22c55e', padding: '10px 20px' }}>
                + Add User
              </button>
            </div>
            {users.length === 0 ? (
              <p>No users found.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                      <th style={{ padding: '12px' }}>Username</th>
                      <th style={{ padding: '12px' }}>Name</th>
                      <th style={{ padding: '12px' }}>Role</th>
                      <th style={{ padding: '12px' }}>Department</th>
                      <th style={{ padding: '12px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.username} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px' }}><code>{u.username}</code></td>
                        <td style={{ padding: '12px' }}>{u.name}</td>
                        <td style={{ padding: '12px' }}>{u.role}</td>
                        <td style={{ padding: '12px' }}>{u.department}</td>
                        <td style={{ padding: '12px' }}>
                          <button 
                            onClick={() => deleteUser(u.username)} 
                            style={{ background: '#dc2626', padding: '6px 12px' }} 
                            disabled={u.username === user?.username}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      case 'roles_table':
        const rolesList = data || [];
        return (
          <div className="card">
            <h3>{section.title}</h3>
            {rolesList.length === 0 ? (
              <p>No roles found.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                      <th style={{ padding: '12px' }}>Role ID</th>
                      <th style={{ padding: '12px' }}>Name</th>
                      <th style={{ padding: '12px' }}>Description</th>
                      <th style={{ padding: '12px' }}>Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rolesList.map(r => (
                      <tr key={r.role_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px' }}><code>{r.role_id}</code></td>
                        <td style={{ padding: '12px' }}>{r.name}</td>
                        <td style={{ padding: '12px' }}>{r.description}</td>
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
        );

      default:
        return null;
    }
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;

  return (
    <div>
      {/* Admin Info Card - Only for admins */}
      {config.dashboard.type === 'admin' && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: 'white' }}>
          <h2>Admin Dashboard</h2>
          <p>Role: {config.user.role} | Department: {config.user.department || 'All'}</p>
          {config.user.permissions?.length > 0 && (
            <div style={{ fontSize: '12px', marginTop: '10px' }}>
              <strong>Permissions:</strong> {config.user.permissions.slice(0, 6).join(', ')}...
            </div>
          )}
        </div>
      )}

      {/* Render all sections dynamically from config */}
      {config.dashboard?.sections?.map(section => (
        <div key={section.id}>
          {renderSection(section)}
        </div>
      ))}

      {/* User Creation Modal */}
      {showUserModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%' }}>
            <h3>Create New User</h3>
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={userForm.username} onChange={(e) => setUserForm({...userForm, username: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={userForm.name} onChange={(e) => setUserForm({...userForm, name: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={userForm.password} onChange={(e) => setUserForm({...userForm, password: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value})}>
                {roles.map(r => (
                  <option key={r.role_id} value={r.role_id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setShowUserModal(false)} style={{ background: '#6b7280' }}>Cancel</button>
              <button onClick={createUser} style={{ background: '#2563eb' }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DynamicDashboard;