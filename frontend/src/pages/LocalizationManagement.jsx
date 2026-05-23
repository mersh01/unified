import React, { useState, useEffect } from 'react';
import PageWrapper from '../components/ui/PageWrapper';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Badge from '../components/ui/Badge';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

function LocalizationManagement() {
  const [locales, setLocales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    locale: '',
    display_name: '',
    translations: '{}',
  });
  const [editingLocale, setEditingLocale] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');

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
    fetchLocales();
  }, []);

  const fetchLocales = async () => {
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/api/admin/config/localizations`);
      const data = await response.json();
      setLocales(Array.isArray(data.localizations) ? data.localizations : []);
    } catch (error) {
      console.error('Error fetching locales:', error);
      setLocales([]);
    } finally {
      setLoading(false);
    }
  };

  const saveLocale = async () => {
    if (!form.locale.trim()) {
      alert('Locale code is required');
      return;
    }

    let translations;
    try {
      translations = JSON.parse(form.translations);
    } catch (error) {
      alert('Invalid JSON for translations');
      return;
    }

    const response = await authFetch(`${API_URL}/api/admin/config/localizations/${form.locale.trim()}`, {
      method: 'PUT',
      body: JSON.stringify({
        display_name: form.display_name.trim() || form.locale.trim(),
        translations,
      }),
    });

    if (response.ok) {
      setShowForm(false);
      setEditingLocale(null);
      setForm({ locale: '', display_name: '', translations: '{}' });
      fetchLocales();
    } else {
      const err = await response.json().catch(() => ({}));
      alert(err.detail || 'Failed to save locale');
    }
  };

  const editLocale = (localeData) => {
    setForm({
      locale: localeData.locale,
      display_name: localeData.display_name || localeData.locale,
      translations: JSON.stringify(localeData.translations || {}, null, 2),
    });
    setEditingLocale(localeData.locale);
    setShowForm(true);
  };

  const deleteLocale = async (localeCode) => {
    if (!window.confirm(`Delete locale ${localeCode}?`)) return;
    const response = await authFetch(`${API_URL}/api/admin/config/localizations/${localeCode}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      fetchLocales();
    } else {
      const err = await response.json().catch(() => ({}));
      alert(err.detail || 'Failed to delete locale');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingLocale(null);
    setForm({ locale: '', display_name: '', translations: '{}' });
  };

  if (loading) return <div className="loading">Loading localization settings...</div>;

  const filteredLocales = locales.filter(l => {
    const searchMatch = !searchQuery ||
      (l.locale && l.locale.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.display_name && l.display_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return searchMatch;
  });

  return (
    <PageWrapper
      title="Localization Management"
      subtitle="Manage supported locales, display names, and translation payloads for your platform." 
      actions={(
        <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm(prev => !prev)}>
          {showForm ? 'Cancel' : '+ New Locale'}
        </Button>
      )}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="text"
              placeholder="Search locales..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-900 outline-none"
            />
          </div>
        </div>

        {showForm && (
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{editingLocale ? 'Edit Locale' : 'Create Locale'}</h3>
                <p className="text-sm text-slate-600">Add or update a language locale and its translation keys.</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Locale Code</label>
                <Input
                  value={form.locale}
                  onChange={(e) => setForm({ ...form, locale: e.target.value })}
                  placeholder="e.g. en, am, fr"
                  disabled={Boolean(editingLocale)}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Display Name</label>
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="e.g. English"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Translations JSON</label>
              <Textarea
                value={form.translations}
                onChange={(e) => setForm({ ...form, translations: e.target.value })}
                className="min-h-[280px] font-mono text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="success" onClick={saveLocale}>Save Locale</Button>
              <Button variant="secondary" onClick={resetForm}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">Locale</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">Display Name</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">Translation Keys</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.12em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredLocales.map((localeData) => (
                <tr key={localeData.locale} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-900"><code>{localeData.locale}</code></td>
                  <td className="px-4 py-4 text-slate-700">{localeData.display_name}</td>
                  <td className="px-4 py-4 text-slate-700">
                    <Badge variant="muted">{localeData.translations ? Object.keys(localeData.translations).length : 0}</Badge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="px-3 py-2 text-xs" onClick={() => editLocale(localeData)}>Edit</Button>
                      <Button variant="danger" className="px-3 py-2 text-xs" onClick={() => deleteLocale(localeData.locale)}>Delete</Button>
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

export default LocalizationManagement;
