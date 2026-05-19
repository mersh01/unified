import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    role_name: '',
    display_name: '',
    description: '',
    permissions: '',
    departments: '',
    priority: 10,
    can_assign_roles: false,
  });

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
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/roles`);
      const data = await response.json();
      setRoles(Array.isArray(data.roles) ? data.roles : []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const createRole = async () => {
    if (!form.role_name.trim() || !form.display_name.trim()) {
      alert('Role name and display name are required');
      return;
    }
    const permissions = form.permissions.split(',').map((s) => s.trim()).filter(Boolean);
    const departments = form.departments.split(',').map((s) => s.trim()).filter(Boolean);
    const res = await authFetch(`${API_URL}/api/admin/roles`, {
      method: 'POST',
      body: JSON.stringify({
        role_name: form.role_name.trim().toLowerCase().replace(/\s+/g, '_'),
        display_name: form.display_name.trim(),
        description: form.description,
        permissions,
        departments,
        priority: Number(form.priority) || 0,
        can_assign_roles: form.can_assign_roles,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({
        role_name: '',
        display_name: '',
        description: '',
        permissions: '',
        departments: '',
        priority: 10,
        can_assign_roles: false,
      });
      fetchRoles();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || 'Failed to create role');
    }
  };

  if (loading) return <div className="loading">Loading roles...</div>;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Role Management</h2>
          <button type="button" onClick={() => setShowForm(!showForm)} style={{ background: '#2563eb', padding: '10px 20px' }}>
            {showForm ? 'Cancel' : '+ New role'}
          </button>
        </div>

        {showForm && (
          <div style={{ marginBottom: '24px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>Create role</h3>
            <div className="form-group">
              <label>Role id (slug)</label>
              <input value={form.role_name} onChange={(e) => setForm({ ...form, role_name: e.target.value })} placeholder="e.g. regional_auditor" />
            </div>
            <div className="form-group">
              <label>Display name</label>
              <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Permissions (comma-separated)</label>
              <input value={form.permissions} onChange={(e) => setForm({ ...form, permissions: e.target.value })} placeholder="view_department_applications, add_comments" />
            </div>
            <div className="form-group">
              <label>Departments (comma-separated)</label>
              <input value={form.departments} onChange={(e) => setForm({ ...form, departments: e.target.value })} placeholder="verification" />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={form.can_assign_roles} onChange={(e) => setForm({ ...form, can_assign_roles: e.target.checked })} />
              Can assign roles
            </label>
            <button type="button" onClick={createRole} style={{ marginTop: '16px', background: '#16a34a', padding: '10px 20px' }}>
              Save role
            </button>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Role ID</th>
                <th style={{ padding: '12px' }}>Name</th>
                <th style={{ padding: '12px' }}>Description</th>
                <th style={{ padding: '12px' }}>Departments</th>
                <th style={{ padding: '12px' }}>Permissions Count</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
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
      </div>
    </div>
  );
}

export default RoleManagement;
