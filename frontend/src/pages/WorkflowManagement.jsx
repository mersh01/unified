import React, { useState, useEffect } from 'react';
import PageWrapper from '../components/ui/PageWrapper';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Badge from '../components/ui/Badge';
import Select from '../components/ui/Select';

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
    <PageWrapper
      title="Workflow Management"
      subtitle="Manage workflow definitions, workflow states, and active automation paths for application processing."
      actions={(
        <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? 'Cancel' : '+ New Workflow'}
        </Button>
      )}
    >
      <div className="space-y-6">
        {showForm && (
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{editingName ? 'Edit' : 'Create'} Workflow</h3>
                <p className="text-sm text-slate-600">Define workflow rules and publish them immediately into the admin catalog.</p>
              </div>
            </div>

            {!editingName && presets.length > 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2 block text-sm font-semibold text-slate-700">Load from Preset</label>
                <Select defaultValue="" onChange={(e) => {
                  const presetId = e.target.value;
                  if (!presetId) return;
                  const preset = presets.find(p => p.id === presetId);
                  if (preset) {
                    setForm(prev => ({
                      ...prev,
                      workflow_name: preset.workflow_name || prev.workflow_name,
                      definition: JSON.stringify(preset.definition, null, 2),
                    }));
                  }
                }}>
                  <option value="">-- Select a preset --</option>
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </Select>
                <p className="mt-3 text-sm text-slate-500">A preset can speed up workflow creation with prebuilt states and transitions.</p>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Workflow Name</label>
                <Input
                  value={form.workflow_name}
                  onChange={(e) => setForm({ ...form, workflow_name: e.target.value })}
                  placeholder="e.g. birth_certificate_replacement"
                  disabled={editingName !== null}
                />
              </div>
              <div className="flex items-end gap-3">
                <label className="inline-flex w-full items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-gov-primary focus:ring-govblue-500" />
                  Active
                </label>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Workflow Definition (JSON)</label>
              <div className="rounded-2xl border border-slate-300 bg-white p-3">
                <Textarea
                  value={form.definition}
                  onChange={(e) => setForm({ ...form, definition: e.target.value })}
                  className="min-h-[360px] font-mono text-xs"
                />
              </div>
              <p className="mt-2 text-sm text-slate-500">Define states, transitions, allowed permissions and workflow behavior in JSON format.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="success" onClick={saveWorkflow}>Save Workflow</Button>
              <Button variant="secondary" onClick={resetForm}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">Workflow Name</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">Start State</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">States Count</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">Status</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {workflows.map((w) => (
                <tr key={w.workflow_name} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-900"><code>{w.workflow_name}</code></td>
                  <td className="px-4 py-4 text-slate-700"><code>{w.definition?.start_state || '—'}</code></td>
                  <td className="px-4 py-4 text-slate-700">
                    <Badge variant="muted">{w.definition?.states ? Object.keys(w.definition.states).length : 0} states</Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={w.is_active ? 'success' : 'muted'}>{w.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Button variant="outline" className="px-3 py-2 text-xs" onClick={() => editWorkflow(w)}>Edit</Button>
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

export default WorkflowManagement;
