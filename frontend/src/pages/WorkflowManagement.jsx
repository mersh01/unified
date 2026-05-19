import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

function WorkflowManagement() {
  const [workflows, setWorkflows] = useState([]);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    workflow_name: '',
    definition: JSON.stringify({ states: {}, start_state: '' }, null, 2),
    is_active: true,
  });
  const [editingName, setEditingName] = useState(null);

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
    fetchWorkflows();
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/config/presets/workflows`);
      const data = await response.json();
      setPresets(data.presets || []);
    } catch (error) {
      console.error('Error fetching presets:', error);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/config/workflows`);
      const data = await response.json();
      setWorkflows(Array.isArray(data.workflows) ? data.workflows : []);
    } catch (error) {
      console.error('Error fetching workflows:', error);
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  const saveWorkflow = async () => {
    if (!form.workflow_name.trim()) {
      alert('Workflow name is required');
      return;
    }
    try {
      let definition = {};
      try {
        definition = JSON.parse(form.definition);
      } catch {
        alert('Invalid JSON in definition field');
        return;
      }

      const res = await authFetch(`${API_URL}/api/admin/config/workflows/${form.workflow_name.trim()}`, {
        method: 'PUT',
        body: JSON.stringify({
          definition,
          is_active: form.is_active,
        }),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingName(null);
        setForm({
          workflow_name: '',
          definition: JSON.stringify({ states: {}, start_state: '' }, null, 2),
          is_active: true,
        });
        fetchWorkflows();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Failed to save workflow');
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert('Error saving workflow');
    }
  };

  const editWorkflow = (workflow) => {
    setForm({
      workflow_name: workflow.workflow_name,
      definition: JSON.stringify(workflow.definition, null, 2),
      is_active: workflow.is_active,
    });
    setEditingName(workflow.workflow_name);
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({
      workflow_name: '',
      definition: JSON.stringify({ states: {}, start_state: '' }, null, 2),
      is_active: true,
    });
    setEditingName(null);
    setShowForm(false);
  };

  if (loading) return <div className="loading">Loading workflows...</div>;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Workflow Management</h2>
          <button
            type="button"
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            style={{ background: '#2563eb', padding: '10px 20px' }}
          >
            {showForm ? 'Cancel' : '+ New Workflow'}
          </button>
        </div>

        {showForm && (
          <div style={{ marginBottom: '24px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>{editingName ? 'Edit' : 'Create'} Workflow</h3>
            <div className="form-group">
              <label>Workflow Name</label>
              <input
                value={form.workflow_name}
                onChange={(e) => setForm({ ...form, workflow_name: e.target.value })}
                placeholder="e.g. birth_certificate_replacement"
                disabled={editingName !== null}
              />
            </div>
            <div className="form-group">
              <label>
                Workflow Definition (JSON)
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  Define states, transitions, actions, and role requirements. Use assigned_role for specific role requirements and allowed_roles for workflow validation.
                </div>
              </label>
              <textarea
                value={form.definition}
                onChange={(e) => setForm({ ...form, definition: e.target.value })}
                placeholder={JSON.stringify(
                  {
                    start_state: 'submitted',
                    states: {
                      submitted: {
                        assigned_role: 'citizen',
                        allowed_roles: ['citizen'],
                        actions: ['submit_application'],
                        next_states: ['verification'],
                        sla_days: 1,
                      },
                      verification: {
                        assigned_role: 'verifier',
                        allowed_roles: ['verifier', 'regional_manager'],
                        actions: ['approve', 'reject'],
                        next_states: ['approved', 'rejected'],
                        allowed_hierarchy_levels: ['country', 'region'],
                        sla_days: 5,
                      },
                    },
                  },
                  null,
                  2
                )}
                style={{ height: '400px', fontFamily: 'monospace', fontSize: '12px' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={saveWorkflow} style={{ background: '#16a34a', padding: '10px 20px' }}>
                Save Workflow
              </button>
              <button type="button" onClick={resetForm} style={{ background: '#6b7280', padding: '10px 20px' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Workflow Name</th>
                <th style={{ padding: '12px' }}>Start State</th>
                <th style={{ padding: '12px' }}>States Count</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((w) => (
                <tr key={w.workflow_name} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px' }}><code>{w.workflow_name}</code></td>
                  <td style={{ padding: '12px' }}>
                    <code>{w.definition?.start_state || '—'}</code>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ background: '#e5e7eb', padding: '2px 8px', borderRadius: '20px', fontSize: '12px' }}>
                      {w.definition?.states ? Object.keys(w.definition.states).length : 0} states
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ background: w.is_active ? '#d1fae5' : '#fee2e2', color: w.is_active ? '#065f46' : '#991b1b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                      {w.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      type="button"
                      onClick={() => editWorkflow(w)}
                      style={{ background: '#2563eb', padding: '6px 12px', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
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

export default WorkflowManagement;
