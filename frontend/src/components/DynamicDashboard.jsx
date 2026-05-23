import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import Badge from './ui/Badge';

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
    <div className="card">
      <h3>{section.title}</h3>
      
      {applications.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ID, Applicant or Service..."
            className="min-w-[240px] flex-1"
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-w-[200px]">
            <option value="">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="VERIFICATION">Under Verification</option>
            <option value="DOCUMENT_VERIFICATION">Document Verification</option>
            <option value="PAYMENT_PENDING">Payment Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
        </div>
      )}

      {filteredApps.length === 0 ? (
        <p className="text-sm text-slate-600">{applications.length === 0 ? 'No applications found.' : 'No applications match your search.'}</p>
      ) : (
        currentApps.map(app => (
          <Card key={app.application_id} className="mb-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
              <div className="space-y-2 text-sm text-slate-700">
                <p><span className="font-semibold text-slate-900">ID:</span> {app.application_id}</p>
                <p><span className="font-semibold text-slate-900">Service:</span> {app.service_type?.replace(/_/g, ' ').toUpperCase()}</p>
                <p><span className="font-semibold text-slate-900">Applicant:</span> {app.user_name}</p>
                <p><span className="font-semibold text-slate-900">Submitted:</span> {new Date(app.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col items-start gap-3 sm:items-end">
                <Badge variant="info">{app.current_state}</Badge>
                <Link to={`/track?appId=${app.application_id}`}>
                  <Button variant="outline">View Details →</Button>
                </Link>
              </div>
            </div>
          </Card>
        ))
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap justify-center items-center gap-3 mt-5">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-600">Page {currentPage} of {totalPages}</span>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {section.show_view_all && applications.length > itemsPerPage && (
        <div className="text-center mt-5">
          <Link to={section.view_all_link}>
            <Button variant="secondary">View All {applications.length} Applications</Button>
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
      case 'stats_cards': {
        const stats = data || {};
        // Backend returns `completed` which currently includes rejected; compute successful completed separately
        const rejectedCount = stats.rejected || 0;
        const completedOnly = Math.max(0, (stats.completed || 0) - rejectedCount);
        return (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4 mb-6">
            <Card className="text-center">
              <div className="text-3xl font-bold text-govblue-700">{stats.total || 0}</div>
              <div className="text-slate-600 mt-2">Total Applications</div>
            </Card>
            <Card className="text-center">
              <div className="text-3xl font-bold text-amber-600">{stats.pending || 0}</div>
              <div className="text-slate-600 mt-2">In Progress</div>
            </Card>
            <Card className="text-center">
              <div className="text-3xl font-bold text-emerald-600">{completedOnly}</div>
              <div className="text-slate-600 mt-2">Completed</div>
            </Card>
            <Card className="text-center">
              <div className="text-3xl font-bold text-red-600">{rejectedCount}</div>
              <div className="text-slate-600 mt-2">Rejected</div>
            </Card>
          </div>
        );
      }

      case 'quick_actions':
        // Quick actions intentionally hidden in dashboard per design request
        return null;

      case 'applications_list':
        const applications = Array.isArray(data) ? data : data?.applications || [];
        return <PaginatedApplicationsList key={section.id} applications={applications} section={section} />;

      case 'users_table': {
        const users = data || [];
        return (
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <h3>{section.title}</h3>
              <Button onClick={() => setShowUserModal(true)} variant="secondary">
                + Add User
              </Button>
            </div>
            {users.length === 0 ? (
              <p>No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead className="bg-slate-100 text-slate-700 text-sm uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Username</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-left">Department</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.username} className="border-b border-slate-200 last:border-0">
                        <td className="px-4 py-3"><code>{u.username}</code></td>
                        <td className="px-4 py-3">{u.name}</td>
                        <td className="px-4 py-3">{u.role}</td>
                        <td className="px-4 py-3">{u.department}</td>
                        <td className="px-4 py-3">
                          <Button
                            variant="danger"
                            onClick={() => deleteUser(u.username)}
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
      }

      case 'roles_table': {
        const rolesList = data || [];
        return (
          <Card>
            <h3>{section.title}</h3>
            {rolesList.length === 0 ? (
              <p>No roles found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead className="bg-slate-100 text-slate-700 text-sm uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Role ID</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-left">Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rolesList.map(r => (
                      <tr key={r.role_id} className="border-b border-slate-200 last:border-0">
                        <td className="px-4 py-3"><code>{r.role_id}</code></td>
                        <td className="px-4 py-3">{r.name}</td>
                        <td className="px-4 py-3">{r.description}</td>
                        <td className="px-4 py-3">
                          <Badge variant="muted">{r.permissions?.length || 0} permissions</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      }

      default:
        return null;
    }
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      {/* Admin Info Card - Only for admins */}
      {config.dashboard.type === 'admin' && (
        <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-govblue-700 text-white">
          <h2>Admin Dashboard</h2>
          <p className="text-sm text-slate-100">Role: {config.user.role} | Department: {config.user.department || 'All'}</p>
          {config.user.permissions?.length > 0 && (
            <div className="text-xs text-slate-200 mt-3">
              <span className="font-semibold">Permissions:</span> {config.user.permissions.slice(0, 6).join(', ')}...
            </div>
          )}
        </Card>
      )}

      {/* Render all sections dynamically from config */}
      {config.dashboard?.sections?.map(section => (
        <div key={section.id}>{renderSection(section)}</div>
      ))}

      {/* User Creation Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <Card className="w-full max-w-lg">
            <div className="flex items-center justify-between gap-4 mb-6">
              <h3>Create New User</h3>
              <Button variant="ghost" onClick={() => setShowUserModal(false)}>
                Close
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Username</label>
                <Input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Name</label>
                <Input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <Select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                >
                  {roles.map(r => (
                    <option key={r.role_id} value={r.role_id}>{r.name}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 justify-end">
              <Button variant="secondary" onClick={() => setShowUserModal(false)}>
                Cancel
              </Button>
              <Button onClick={createUser}>Create</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default DynamicDashboard;