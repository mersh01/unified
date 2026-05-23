import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Badge, Button } from './ui';

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

  const getStatusColor = (status) => {
    const colors = {
      'SUBMITTED': 'warning',
      'VERIFICATION': 'info',
      'DOCUMENT_VERIFICATION': 'info',
      'PAYMENT_PENDING': 'warning',
      'COMPLETED': 'success',
      'REJECTED': 'danger',
      'ASSIGNED': 'primary',
      'RESOLVED': 'success',
    };
    return colors[status] || 'default';
  };

  return (
    <Card title={section.title}>
      {applications.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          <input 
            type="text" 
            placeholder="Search by ID, Applicant or Service..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
        <div className="text-center py-12 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">{applications.length === 0 ? "No applications found." : "No applications match your search."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {currentApps.map(app => (
            <div key={app.application_id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-semibold text-gray-900">{app.application_id}</span>
                    <Badge variant={getStatusColor(app.current_state)}>{app.current_state}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Service:</span> {app.service_type?.replace(/_/g, ' ').toUpperCase()}
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Applicant:</span> {app.user_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Submitted:</span> {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Link to={`/track?appId=${app.application_id}`}>
                  <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium">
                    View Details →
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
            disabled={currentPage === 1}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            Next
          </button>
        </div>
      )}

      {section.show_view_all && applications.length > itemsPerPage && (
        <div className="text-center mt-6">
          <Link to={section.view_all_link}>
            <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium">
              View All {applications.length} Applications
            </button>
          </Link>
        </div>
      )}
    </Card>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card variant="elevated" className="text-center py-8">
              <div className="text-4xl font-bold text-primary-600 mb-2">{stats.total || 0}</div>
              <div className="text-gray-600 font-medium">Total Applications</div>
            </Card>
            <Card variant="elevated" className="text-center py-8">
              <div className="text-4xl font-bold text-warning-600 mb-2">{stats.pending || 0}</div>
              <div className="text-gray-600 font-medium">In Progress</div>
            </Card>
            <Card variant="elevated" className="text-center py-8">
              <div className="text-4xl font-bold text-success-600 mb-2">{stats.completed || 0}</div>
              <div className="text-gray-600 font-medium">Completed</div>
            </Card>
          </div>
        );

      case 'quick_actions':
        return (
          <Card variant="elevated">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">{section.title}</h3>
            <div className="flex gap-3 flex-wrap">
              {section.actions?.map(action => (
                <Link key={action.link} to={action.link}>
                  <Button variant="outline" className="flex items-center gap-2">
                    <span>{action.icon}</span>
                    <span>{action.label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </Card>
        );

      case 'applications_list':
        const applications = Array.isArray(data) ? data : data?.applications || [];
        return <PaginatedApplicationsList key={section.id} applications={applications} section={section} />;

      case 'users_table':
        const users = data || [];
        return (
          <Card variant="elevated">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">{section.title}</h3>
              <Button onClick={() => setShowUserModal(true)} variant="primary">
                + Add User
              </Button>
            </div>
            {users.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 font-semibold text-gray-700">Username</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Role</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Department</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.username} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">{u.username}</code></td>
                        <td className="px-4 py-3">{u.name}</td>
                        <td className="px-4 py-3"><Badge variant="primary">{u.role}</Badge></td>
                        <td className="px-4 py-3">{u.department}</td>
                        <td className="px-4 py-3">
                          <Button 
                            onClick={() => deleteUser(u.username)} 
                            variant="danger"
                            size="sm"
                            disabled={u.username === user?.username}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );

      case 'roles_table':
        const rolesList = data || [];
        return (
          <Card variant="elevated">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">{section.title}</h3>
            {rolesList.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No roles found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 font-semibold text-gray-700">Role ID</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Description</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rolesList.map(r => (
                      <tr key={r.role_id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">{r.role_id}</code></td>
                        <td className="px-4 py-3">{r.name}</td>
                        <td className="px-4 py-3">{r.description}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{r.permissions?.length || 0} permissions</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
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