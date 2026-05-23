import React, { useState, useEffect } from 'react';
import PageWrapper from '../components/ui/PageWrapper';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import Badge from '../components/ui/Badge';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

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
    <PageWrapper
      title="Service Management"
      subtitle="Configure backend service definitions, catalog metadata, and activation status for your national digital government platform."
      actions={(
        <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? 'Cancel' : '+ New Service'}
        </Button>
      )}
    >
      <div className="space-y-6">
        {showForm && (
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit' : 'Create'} Service</h3>
                <p className="text-sm text-slate-600">Manage service metadata, JSON configuration and publishing state.</p>
              </div>
            </div>

            {!editingId && presets.length > 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2 block text-sm font-semibold text-slate-700">Load from Preset (Optional)</label>
                <Select defaultValue="" onChange={(e) => {
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
                }}>
                  <option value="">-- Select a preset --</option>
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </Select>
                <p className="mt-3 text-sm text-slate-500">Selecting a preset will auto-fill the Service ID and JSON configuration.</p>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Service ID</label>
                <Input
                  value={form.service_id}
                  onChange={(e) => setForm({ ...form, service_id: e.target.value })}
                  placeholder="e.g. birth_certificate"
                  disabled={editingId !== null}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Service Kind</label>
                <Select value={form.service_kind} onChange={(e) => setForm({ ...form, service_kind: e.target.value })}>
                  <option value="document">Document</option>
                  <option value="service">Service</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Configuration (JSON)</label>
              <Textarea
                value={form.config}
                onChange={(e) => setForm({ ...form, config: e.target.value })}
                placeholder='{"name": "Birth Certificate", "category": "document_replacement"}'
                className="min-h-[240px] font-mono text-xs"
              />
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-gov-primary focus:ring-govblue-500" />
                Active
              </label>

              <div className="flex flex-wrap gap-3">
                <Button variant="success" onClick={saveService}>Save Service</Button>
                <Button variant="secondary" onClick={resetForm}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">Service ID</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">Kind</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">Status</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">Config Keys</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {services.map((s) => (
                <tr key={s.service_id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-900">{s.service_id}</td>
                  <td className="px-4 py-4 text-slate-700">{s.service_kind}</td>
                  <td className="px-4 py-4">
                    <Badge variant={s.is_active ? 'success' : 'muted'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-4 text-slate-700">{s.config ? Object.keys(s.config || {}).length : 0}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="px-3 py-2 text-xs" onClick={() => editService(s)}>Edit</Button>
                      <Button variant="danger" className="px-3 py-2 text-xs" onClick={() => deleteService(s.service_id)}>Deactivate</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}

export default ServiceManagement;
