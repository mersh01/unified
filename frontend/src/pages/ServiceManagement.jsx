import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:8000';

function ServiceManagement() {
  const [services, setServices] = useState([]);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    service_id: '',
    service_kind: 'document',
    config: '{}',
    is_active: true,
  });
  const [editingId, setEditingId] = useState(null);

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
    fetchServices();
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/config/presets/services`);
      const data = await response.json();
      setPresets(data.presets || []);
    } catch (error) {
      console.error('Error fetching presets:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/config/services`);
      const data = await response.json();
      setServices(Array.isArray(data.services) ? data.services : []);
    } catch (error) {
      console.error('Error fetching services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const saveService = async () => {
    if (!form.service_id.trim()) {
      alert('Service ID is required');
      return;
    }
    try {
      let config = {};
      try {
        config = JSON.parse(form.config);
      } catch {
        alert('Invalid JSON in config field');
        return;
      }

      const res = await authFetch(`${API_URL}/api/admin/config/services/${form.service_id.trim()}`, {
        method: 'PUT',
        body: JSON.stringify({
          service_kind: form.service_kind,
          config,
          is_active: form.is_active,
        }),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm({
          service_id: '',
          service_kind: 'document',
          config: '{}',
          is_active: true,
        });
        fetchServices();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Failed to save service');
      }
    } catch (error) {
      console.error('Error saving service:', error);
      alert('Error saving service');
    }
  };

  const editService = (service) => {
    setForm({
      service_id: service.service_id,
      service_kind: service.service_kind,
      config: JSON.stringify(service.config, null, 2),
      is_active: service.is_active,
    });
    setEditingId(service.service_id);
    setShowForm(true);
  };

  const deleteService = async (serviceId) => {
    if (!confirm(`Are you sure you want to deactivate service "${serviceId}"?`)) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/config/services/${serviceId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchServices();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Failed to delete service');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Error deleting service');
    }
  };

  const resetForm = () => {
    setForm({
      service_id: '',
      service_kind: 'document',
      config: '{}',
      is_active: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  if (loading) return <div className="loading">Loading services...</div>;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Service Management</h2>
          <button
            type="button"
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            style={{ background: '#2563eb', padding: '10px 20px' }}
          >
            {showForm ? 'Cancel' : '+ New Service'}
          </button>
        </div>

        {showForm && (
          <div style={{ marginBottom: '24px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit' : 'Create'} Service</h3>
            
            {!editingId && presets.length > 0 && (
              <div className="form-group" style={{ marginBottom: '24px', background: '#eff6ff', padding: '16px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <label style={{ color: '#1e40af' }}>Load from Preset (Optional)</label>
                <select 
                  onChange={(e) => {
                    const presetId = e.target.value;
                    if (!presetId) return;
                    const preset = presets.find(p => p.id === presetId);
                    if (preset) {
                      setForm(prev => ({
                        ...prev,
                        service_id: preset.id,
                        config: JSON.stringify(preset.config, null, 2)
                      }));
                    }
                  }}
                  defaultValue=""
                >
                  <option value="">-- Select a preset --</option>
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
                <p style={{ fontSize: '12px', color: '#3b82f6', marginTop: '8px' }}>Selecting a preset will auto-fill the Service ID and Configuration.</p>
              </div>
            )}

            <div className="form-group">
              <label>Service ID</label>
              <input
                value={form.service_id}
                onChange={(e) => setForm({ ...form, service_id: e.target.value })}
                placeholder="e.g. birth_certificate"
                disabled={editingId !== null}
              />
            </div>
            <div className="form-group">
              <label>Service Kind</label>
              <select value={form.service_kind} onChange={(e) => setForm({ ...form, service_kind: e.target.value })}>
                <option value="document">Document</option>
                <option value="service">Service</option>
              </select>
            </div>
            <div className="form-group">
              <label>Configuration (JSON)</label>
              <textarea
                value={form.config}
                onChange={(e) => setForm({ ...form, config: e.target.value })}
                placeholder='{"name": "Birth Certificate", "category": "document_replacement"}'
                style={{ height: '200px', fontFamily: 'monospace', fontSize: '12px' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={saveService} style={{ background: '#16a34a', padding: '10px 20px' }}>
                Save Service
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
                <th style={{ padding: '12px' }}>Service ID</th>
                <th style={{ padding: '12px' }}>Kind</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Config Keys</th>
                <th style={{ padding: '12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.service_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px' }}><code>{s.service_id}</code></td>
                  <td style={{ padding: '12px' }}>{s.service_kind}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ background: s.is_active ? '#d1fae5' : '#fee2e2', color: s.is_active ? '#065f46' : '#991b1b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px' }}>
                    {s.config && typeof s.config === 'object' ? Object.keys(s.config).join(', ') : '—'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      type="button"
                      onClick={() => editService(s)}
                      style={{ background: '#2563eb', padding: '6px 12px', marginRight: '8px', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteService(s.service_id)}
                      style={{ background: '#dc2626', padding: '6px 12px', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                      Deactivate
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

export default ServiceManagement;
