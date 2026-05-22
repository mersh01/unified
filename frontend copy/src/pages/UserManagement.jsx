import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

function UserManagement({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editUserId, setEditUserId] = useState(null);

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'system_admin';

  const initialFormState = {
    username: '',
    password: '',
    role: 'viewer',
    name: '',
    phone_number: '',
    email: '',
    department: isSuperAdmin ? '' : (user?.department || ''),
    hierarchy_country: isSuperAdmin ? 'ETH' : (user?.hierarchy_country || 'ETH'),
    hierarchy_region: isSuperAdmin ? '' : (user?.hierarchy_region || ''),
    hierarchy_zone: isSuperAdmin ? '' : (user?.hierarchy_zone || ''),
    hierarchy_woreda: isSuperAdmin ? '' : (user?.hierarchy_woreda || ''),
    hierarchy_kebele: isSuperAdmin ? '' : (user?.hierarchy_kebele || ''),
  };

  const [userForm, setUserForm] = useState(initialFormState);
  const [preset, setPreset] = useState('custom');

  const [roleModalUser, setRoleModalUser] = useState(null);
  const [extraRole, setExtraRole] = useState('');
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  
  // Hierarchy
  const [hierarchyData, setHierarchyData] = useState({
    regions: {},
    zones: {},
    woredas: {},
    kebeles: {}
  });

  const [page, setPage] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const pageSize = 20;

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
    fetchUsers(0, searchQuery, filterRole, filterDept);
  }, [filterRole, filterDept]); // Refetch when dropdown filters change

  useEffect(() => {
    fetchUsers(0);
    fetchRoles();
    fetchDepartments();
    fetchHierarchy('regions');
  }, []);

  const fetchUsers = async (pageNumber = 0, search = searchQuery, role = filterRole, dept = filterDept) => {
    setLoading(true);
    try {
      const offset = pageNumber * pageSize;
      let url = `${API_URL}/api/admin/users?limit=${pageSize}&offset=${offset}`;
      if (role) url += `&role=${role}`;
      if (dept) url += `&department=${dept}`;
      
      const response = await authFetch(url);
      const data = await response.json();
      let list = Array.isArray(data.users) ? data.users : [];
      
      if (search) {
        const lowerSearch = search.toLowerCase();
        list = list.filter(u => 
          (u.username && u.username.toLowerCase().includes(lowerSearch)) || 
          (u.full_name && u.full_name.toLowerCase().includes(lowerSearch)) ||
          (u.name && u.name.toLowerCase().includes(lowerSearch))
        );
      }
      
      setUsers(list);
      setTotalUsers(data.total || 0);
      setPage(pageNumber);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
      setTotalUsers(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/roles`);
      const data = await response.json();
      setRoles(Array.isArray(data.roles) ? data.roles : []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/departments`);
      if (response.ok) {
        const data = await response.json();
        setDepartments(Array.isArray(data.departments) ? data.departments : []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchHierarchy = async (level, parentId = null) => {
    try {
      let url = `${API_URL}/api/hierarchy/${level}`;
      if (parentId) url += `?parent_id=${encodeURIComponent(parentId)}`;
      
      const response = await authFetch(url);
      if (response.ok) {
        const data = await response.json();
        setHierarchyData(prev => ({ ...prev, [level]: data.data || {} }));
      }
    } catch (error) {
      console.error(`Error fetching hierarchy ${level}:`, error);
    }
  };

  // Preset templates handler
  const handlePresetChange = (presetName) => {
    setPreset(presetName);
    if (presetName === 'national') {
      setUserForm(prev => ({
        ...prev,
        hierarchy_country: 'ETH',
        hierarchy_region: '',
        hierarchy_zone: '',
        hierarchy_woreda: '',
        hierarchy_kebele: ''
      }));
    } else if (presetName === 'regional') {
      setUserForm(prev => ({
        ...prev,
        hierarchy_country: 'ETH',
        hierarchy_region: 'OROMIA',
        hierarchy_zone: '',
        hierarchy_woreda: '',
        hierarchy_kebele: ''
      }));
    } else if (presetName === 'zone') {
      setUserForm(prev => ({
        ...prev,
        hierarchy_country: 'ETH',
        hierarchy_region: 'OROMIA',
        hierarchy_zone: 'BALE',
        hierarchy_woreda: '',
        hierarchy_kebele: ''
      }));
    } else if (presetName === 'woreda') {
      setUserForm(prev => ({
        ...prev,
        hierarchy_country: 'ETH',
        hierarchy_region: 'OROMIA',
        hierarchy_zone: 'BALE',
        hierarchy_woreda: 'SINANA',
        hierarchy_kebele: ''
      }));
    }
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setEditUserId(null);
    setPreset('custom');
    setUserForm(initialFormState);
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setIsEditing(true);
    setEditUserId(u.user_id);
    
    // Determine preset based on hierarchy fields
    let detectedPreset = 'custom';
    if (u.hierarchy_country === 'ETH' && !u.hierarchy_region) {
      detectedPreset = 'national';
    } else if (u.hierarchy_country === 'ETH' && u.hierarchy_region === 'OROMIA' && !u.hierarchy_zone) {
      detectedPreset = 'regional';
    } else if (u.hierarchy_country === 'ETH' && u.hierarchy_region === 'OROMIA' && u.hierarchy_zone === 'BALE' && !u.hierarchy_woreda) {
      detectedPreset = 'zone';
    } else if (u.hierarchy_country === 'ETH' && u.hierarchy_region === 'OROMIA' && u.hierarchy_zone === 'BALE' && u.hierarchy_woreda === 'SINANA') {
      detectedPreset = 'woreda';
    }

    setPreset(detectedPreset);
    setUserForm({
      username: u.username || '',
      password: '', // Leave empty to not change password
      role: u.role || 'viewer',
      name: u.full_name || u.name || '',
      phone_number: u.phone_number || '',
      email: u.email || '',
      department: u.department || '',
      hierarchy_country: u.hierarchy_country || 'ETH',
      hierarchy_region: u.hierarchy_region || '',
      hierarchy_zone: u.hierarchy_zone || '',
      hierarchy_woreda: u.hierarchy_woreda || '',
      hierarchy_kebele: u.hierarchy_kebele || '',
    });
    
    // Fetch relevant hierarchy data if editing existing geographic info
    if (u.hierarchy_region) fetchHierarchy('zones', u.hierarchy_region);
    if (u.hierarchy_zone) fetchHierarchy('woredas', u.hierarchy_zone);
    if (u.hierarchy_woreda) fetchHierarchy('kebeles', u.hierarchy_woreda);

    setShowModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userForm.username) {
      alert('Username is required');
      return;
    }
    if (!isEditing && !userForm.password) {
      alert('Password is required for new users');
      return;
    }
    if (!userForm.phone_number) {
      alert('Phone number is required');
      return;
    }

    const payload = {
      username: userForm.username,
      full_name: userForm.name || userForm.username,
      phone_number: userForm.phone_number,
      role: userForm.role,
      email: userForm.email || null,
      department: userForm.department || null,
      hierarchy_country: userForm.hierarchy_country || null,
      hierarchy_region: userForm.hierarchy_region || null,
      hierarchy_zone: userForm.hierarchy_zone || null,
      hierarchy_woreda: userForm.hierarchy_woreda || null,
      hierarchy_kebele: userForm.hierarchy_kebele || null,
    };

    if (userForm.password) {
      payload.password = userForm.password;
    }

    try {
      let response;
      if (isEditing) {
        response = await authFetch(`${API_URL}/api/admin/users/${editUserId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        response = await authFetch(`${API_URL}/api/admin/users`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        alert(isEditing ? 'User updated successfully!' : 'User created successfully!');
        setShowModal(false);
        fetchUsers(page);
        setUserForm(initialFormState);
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to save user'}`);
      }
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error saving user');
    }
  };

  const assignExtraRole = async () => {
    if (!roleModalUser || !extraRole) return;
    const res = await authFetch(`${API_URL}/api/admin/users/${roleModalUser.user_id}/roles`, {
      method: 'POST',
      body: JSON.stringify({ role_name: extraRole }),
    });
    if (res.ok) {
      setExtraRole('');
      setRoleModalUser(null);
      fetchUsers(page);
      alert('Role assigned. User must log in again to refresh JWT with all roles.');
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || 'Failed to assign role');
    }
  };

  const deleteUser = async (userId, username) => {
    if (confirm(`Are you sure you want to delete user "${username}"?`)) {
      try {
        const response = await authFetch(`${API_URL}/api/admin/users/${userId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          alert('User deleted successfully!');
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

  if (loading) return <div className="loading">Loading users...</div>;

  return (
    <div>
      <div className="card" style={{ border: '1px solid #e5e7eb', boxShadow: 'var(--glass-shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-main)', fontWeight: 700 }}>User Management</h2>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              Create and manage administrative user accounts, roles, departments, and geographic jurisdictions.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: '#f8fafc', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0', gap: '8px' }}>
              <input 
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers(0)}
                style={{ border: 'none', background: 'transparent', padding: '6px 12px', outline: 'none', fontSize: '13px', width: '150px' }}
              />
              <select 
                value={filterRole} 
                onChange={(e) => setFilterRole(e.target.value)}
                style={{ border: 'none', background: '#fff', borderRadius: '4px', padding: '6px', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="">All Roles</option>
                {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.name}</option>)}
              </select>
              <select 
                value={filterDept} 
                onChange={(e) => setFilterDept(e.target.value)}
                style={{ border: 'none', background: '#fff', borderRadius: '4px', padding: '6px', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </div>
            <button 
              onClick={openCreateModal} 
              style={{ 
                background: 'linear-gradient(135deg, #10b981, #059669)', 
                padding: '10px 24px', 
                borderRadius: '8px', 
                boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)',
                fontWeight: '600',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              + Add New User
            </button>
          </div>
        </div>
        
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Username</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Name</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Role</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Department</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Jurisdiction</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id || u.username} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', color: '#0f172a', fontWeight: '600' }}>
                      {u.username}
                    </code>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-main)', fontWeight: '500' }}>
                    {u.full_name || u.name}
                    {u.email && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{u.email}</div>}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span className="badge badge-blue" style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px' }}>
                      {u.role}
                    </span>
                    {(u.extra_roles || []).filter(r => r !== u.role).map(r => (
                      <span key={r} className="badge" style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', marginLeft: '4px' }}>
                        +{r}
                      </span>
                    ))}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {u.department ? (
                      <span style={{ color: '#0369a1', background: '#e0f2fe', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
                        {u.department}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>
                    {u.hierarchy_country ? (
                      <div>
                        <strong>{u.hierarchy_country}</strong>
                        {u.hierarchy_region && ` / ${u.hierarchy_region}`}
                        {u.hierarchy_zone && ` / ${u.hierarchy_zone}`}
                        {u.hierarchy_woreda && ` / ${u.hierarchy_woreda}`}
                        {u.hierarchy_kebele && ` / ${u.hierarchy_kebele}`}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Global</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => openEditModal(u)}
                        style={{ 
                          background: '#f1f5f9', 
                          color: '#1e293b', 
                          padding: '6px 14px', 
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoleModalUser(u)}
                        style={{ 
                          background: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
                          padding: '6px 14px', 
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}
                      >
                        + Role
                      </button>
                      <button 
                        onClick={() => deleteUser(u.user_id || u.username, u.full_name || u.name || u.username)} 
                        style={{ 
                          background: 'linear-gradient(135deg, #ef4444, #dc2626)', 
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '500'
                        }} 
                        disabled={u.username === user?.username}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Showing {users.length} of {totalUsers} users
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => fetchUsers(Math.max(0, page - 1))}
              disabled={page === 0}
              style={{ padding: '8px 16px', background: page === 0 ? '#cbd5e1' : 'var(--primary)', color: page === 0 ? '#64748b' : 'white', borderRadius: '6px', fontWeight: '500' }}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => fetchUsers(page + 1)}
              disabled={(page + 1) * pageSize >= totalUsers}
              style={{ padding: '8px 16px', background: (page + 1) * pageSize >= totalUsers ? '#cbd5e1' : 'var(--primary)', color: (page + 1) * pageSize >= totalUsers ? '#64748b' : 'white', borderRadius: '6px', fontWeight: '500' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--glass-border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <h3 style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '20px', fontWeight: '700', fontSize: '22px' }}>
              {isEditing ? `Edit User: ${userForm.username}` : 'Create New Administrative User'}
            </h3>
            
            <form onSubmit={handleSaveUser}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Username</label>
                  <input 
                    type="text" 
                    value={userForm.username} 
                    onChange={(e) => setUserForm({...userForm, username: e.target.value.trim().toLowerCase()})} 
                    disabled={isEditing}
                    style={{ background: isEditing ? '#f8fafc' : '#fff' }}
                    placeholder="e.g. jdoe"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    value={userForm.name} 
                    onChange={(e) => setUserForm({...userForm, name: e.target.value})} 
                    placeholder="e.g. John Doe"
                    required
                  />
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Password {isEditing && <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 'normal' }}>(leave blank to keep current)</span>}</label>
                  <input 
                    type="password" 
                    value={userForm.password} 
                    onChange={(e) => setUserForm({...userForm, password: e.target.value})} 
                    placeholder={isEditing ? '••••••••' : 'Enter strong password'}
                    required={!isEditing}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Phone Number (10 digits)</label>
                  <input 
                    type="text"
                    pattern="[0-9]{9,12}"
                    value={userForm.phone_number} 
                    onChange={(e) => setUserForm({ ...userForm, phone_number: e.target.value })} 
                    placeholder="e.g. 0912345678"
                    required
                  />
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    value={userForm.email} 
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})} 
                    placeholder="e.g. jdoe@example.com"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Primary Role</label>
                  <select value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value})}>
                    {roles.map(r => (
                      <option key={r.role_id} value={r.role_id}>{r.name} ({r.role_id})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label>Primary Department</label>
                <select 
                  value={userForm.department} 
                  onChange={(e) => setUserForm({...userForm, department: e.target.value})}
                  disabled={!isSuperAdmin && !!user?.department}
                >
                  <option value="">No Department (Global/Admin)</option>
                  <option value="all">All Departments</option>
                  {departments.map(d => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Geographic Hierarchy Section */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontWeight: '600', color: '#1e293b' }}>Geographic Jurisdiction</h4>
                  
                  {/* Preset Dropdown */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Presets:</span>
                    <select 
                      value={preset} 
                      onChange={(e) => handlePresetChange(e.target.value)}
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', borderRadius: '6px' }}
                    >
                      <option value="custom">Custom / Manual</option>
                      <option value="national">National Office (ETH)</option>
                      <option value="regional">Oromia Regional Office</option>
                      <option value="zone">Bale Zone Office</option>
                      <option value="woreda">Sinana Woreda Office</option>
                    </select>
                  </div>
                </div>

                <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '12px', color: '#475569' }}>Country</label>
                    <input 
                      type="text" 
                      value={userForm.hierarchy_country} 
                      onChange={(e) => setUserForm({...userForm, hierarchy_country: e.target.value.toUpperCase(), preset: 'custom'})} 
                      placeholder="ETH"
                      disabled={!isSuperAdmin && !!user?.hierarchy_country}
                      style={{ padding: '8px', fontSize: '14px' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '12px', color: '#475569' }}>Region</label>
                    <select 
                      value={userForm.hierarchy_region} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setUserForm({
                          ...userForm, 
                          hierarchy_region: val,
                          hierarchy_zone: '',
                          hierarchy_woreda: '',
                          hierarchy_kebele: '',
                          preset: 'custom'
                        });
                        if (val) fetchHierarchy('zones', val);
                        else setHierarchyData(prev => ({ ...prev, zones: {}, woredas: {}, kebeles: {} }));
                      }} 
                      disabled={!isSuperAdmin && !!user?.hierarchy_region}
                      style={{ padding: '8px', fontSize: '14px', width: '100%' }}
                    >
                      <option value="">-- All Regions --</option>
                      {Object.entries(hierarchyData.regions || {}).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '12px', color: '#475569' }}>Zone</label>
                    <select 
                      value={userForm.hierarchy_zone} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setUserForm({
                          ...userForm, 
                          hierarchy_zone: val,
                          hierarchy_woreda: '',
                          hierarchy_kebele: '',
                          preset: 'custom'
                        });
                        if (val) fetchHierarchy('woredas', val);
                        else setHierarchyData(prev => ({ ...prev, woredas: {}, kebeles: {} }));
                      }} 
                      disabled={(!isSuperAdmin && !!user?.hierarchy_zone) || !userForm.hierarchy_region}
                      style={{ padding: '8px', fontSize: '14px', width: '100%' }}
                    >
                      <option value="">-- All Zones --</option>
                      {Object.entries(hierarchyData.zones || {}).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '12px', color: '#475569' }}>Woreda</label>
                    <select 
                      value={userForm.hierarchy_woreda} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setUserForm({
                          ...userForm, 
                          hierarchy_woreda: val,
                          hierarchy_kebele: '',
                          preset: 'custom'
                        });
                        if (val) fetchHierarchy('kebeles', val);
                        else setHierarchyData(prev => ({ ...prev, kebeles: {} }));
                      }} 
                      disabled={(!isSuperAdmin && !!user?.hierarchy_woreda) || !userForm.hierarchy_zone}
                      style={{ padding: '8px', fontSize: '14px', width: '100%' }}
                    >
                      <option value="">-- All Woredas --</option>
                      {Object.entries(hierarchyData.woredas || {}).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '12px', color: '#475569' }}>Kebele</label>
                    <select 
                      value={userForm.hierarchy_kebele} 
                      onChange={(e) => setUserForm({...userForm, hierarchy_kebele: e.target.value, preset: 'custom'})} 
                      disabled={(!isSuperAdmin && !!user?.hierarchy_kebele) || !userForm.hierarchy_woreda}
                      style={{ padding: '8px', fontSize: '14px', width: '100%' }}
                    >
                      <option value="">-- All Kebeles --</option>
                      {Object.entries(hierarchyData.kebeles || {}).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  Jurisdictions restrict administrative operations to the assigned region, zone, or woreda. Leave empty for national scope.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', padding: '10px 24px', borderRadius: '8px', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', padding: '10px 32px', borderRadius: '8px', fontWeight: '600', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)' }}
                >
                  {isEditing ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Extra Role Modal */}
      {roleModalUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', border: '1px solid var(--glass-border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontWeight: '700' }}>Assign Role to {roleModalUser.username}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.4' }}>
              Adds an additional secondary role. The primary role remains unchanged. Permissions combine at next login.
            </p>
            <div className="form-group">
              <label>Role to Assign</label>
              <select value={extraRole} onChange={(e) => setExtraRole(e.target.value)}>
                <option value="">Select Role…</option>
                {roles.map((r) => (
                  <option key={r.role_id} value={r.role_id}>{r.name} ({r.role_id})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button 
                type="button" 
                onClick={() => { setRoleModalUser(null); setExtraRole(''); }} 
                style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={assignExtraRole} 
                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', padding: '8px 20px', borderRadius: '6px', fontWeight: '600' }}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;