import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:8000';

function UserManagement({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'viewer',
    name: '',
    phone_number: '0000000000',
  });
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [extraRole, setExtraRole] = useState('');
  const [roles, setRoles] = useState([]);
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
    fetchUsers(0);
    fetchRoles();
  }, []);

  const fetchUsers = async (pageNumber = 0) => {
    setLoading(true);
    try {
      const offset = pageNumber * pageSize;
      const response = await authFetch(`${API_URL}/api/admin/users?limit=${pageSize}&offset=${offset}`);
      const data = await response.json();
      const list = Array.isArray(data.users) ? data.users : [];
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

  const createUser = async () => {
    if (!userForm.username || !userForm.password) {
      alert('Username and password are required');
      return;
    }
    try {
      const response = await authFetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        body: JSON.stringify({
          username: userForm.username,
          full_name: userForm.name || userForm.username,
          phone_number: userForm.phone_number || '0000000000',
          role: userForm.role,
          password: userForm.password,
        }),
      });
      if (response.ok) {
        alert('User created successfully!');
        setShowModal(false);
        fetchUsers();
        setUserForm({ username: '', password: '', role: 'viewer', name: '', phone_number: '0000000000' });
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to create user'}`);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error creating user');
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
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>User Management</h2>
          <button onClick={() => setShowModal(true)} style={{ background: '#22c55e', padding: '10px 20px' }}>
            + Add New User
          </button>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Username</th>
                <th style={{ padding: '12px' }}>Name</th>
                <th style={{ padding: '12px' }}>Role</th>
                <th style={{ padding: '12px' }}>Also has</th>
                <th style={{ padding: '12px' }}>Department</th>
                <th style={{ padding: '12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id || u.username} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px' }}><code>{u.username}</code></td>
                  <td style={{ padding: '12px' }}>{u.full_name || u.name}</td>
                  <td style={{ padding: '12px' }}>{u.role}</td>
                  <td style={{ padding: '12px', fontSize: '12px' }}>
                    {(u.extra_roles || [])
                      .filter((r) => r !== u.role)
                      .join(', ') || '—'}
                  </td>
                  <td style={{ padding: '12px' }}>{u.department}</td>
                  <td style={{ padding: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setRoleModalUser(u)}
                      style={{ background: '#2563eb', padding: '6px 12px', marginRight: '8px' }}
                    >
                      + Role
                    </button>
                    <button 
                      onClick={() => deleteUser(u.user_id || u.username, u.full_name || u.name || u.username)} 
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <div style={{ fontSize: '14px', color: '#374151' }}>
            Showing {users.length} of {totalUsers} users
          </div>
          <div>
            <button
              type="button"
              onClick={() => fetchUsers(Math.max(0, page - 1))}
              disabled={page === 0}
              style={{ marginRight: '8px', padding: '8px 12px', background: page === 0 ? '#9ca3af' : '#2563eb' }}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => fetchUsers(page + 1)}
              disabled={(page + 1) * pageSize >= totalUsers}
              style={{ padding: '8px 12px', background: (page + 1) * pageSize >= totalUsers ? '#9ca3af' : '#2563eb' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showModal && (
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
              <label>Phone (10 digits)</label>
              <input value={userForm.phone_number} onChange={(e) => setUserForm({ ...userForm, phone_number: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Primary role</label>
              <select value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value})}>
                {roles.map(r => (
                  <option key={r.role_id} value={r.role_id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setShowModal(false)} style={{ background: '#6b7280' }}>Cancel</button>
              <button onClick={createUser} style={{ background: '#2563eb' }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {roleModalUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%' }}>
            <h3>Assign role to {roleModalUser.username}</h3>
            <p style={{ fontSize: '13px', color: '#6b7280' }}>Adds an additional role. Primary role stays on the user record; permissions combine at login (re-login to refresh token).</p>
            <div className="form-group">
              <label>Role</label>
              <select value={extraRole} onChange={(e) => setExtraRole(e.target.value)}>
                <option value="">Select…</option>
                {roles.map((r) => (
                  <option key={r.role_id} value={r.role_id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" onClick={() => { setRoleModalUser(null); setExtraRole(''); }} style={{ background: '#6b7280' }}>Cancel</button>
              <button type="button" onClick={assignExtraRole} style={{ background: '#2563eb' }}>Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;