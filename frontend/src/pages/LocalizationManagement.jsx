import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:8000';

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

  const editLocale = (locale) => {
    setForm({
      locale: locale.locale,
      display_name: locale.display_name || locale.locale,
      translations: JSON.stringify(locale.translations || {}, null, 2),
    });
    setEditingLocale(locale.locale);
    setShowForm(true);
  };

  const deleteLocale = async (locale) => {
    if (!window.confirm(`Delete locale ${locale}?`)) return;
    const response = await authFetch(`${API_URL}/api/admin/config/localizations/${locale}`, {
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

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Localization Management</h2>
          <button type="button" onClick={() => setShowForm(!showForm)} style={{ background: '#2563eb', padding: '10px 20px' }}>
            {showForm ? 'Cancel' : '+ New Locale'}
          </button>
        </div>

        {showForm && (
          <div style={{ marginBottom: '24px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>{editingLocale ? 'Edit Locale' : 'Create Locale'}</h3>
            <div className="form-group">
              <label>Locale code</label>
              <input
                value={form.locale}
                onChange={(e) => setForm({ ...form, locale: e.target.value })}
                placeholder="e.g. en, am, fr"
                disabled={Boolean(editingLocale)}
              />
            </div>
            <div className="form-group">
              <label>Display name</label>
              <input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="e.g. English"
              />
            </div>
            <div className="form-group">
              <label>Translations JSON</label>
              <textarea
                value={form.translations}
                onChange={(e) => setForm({ ...form, translations: e.target.value })}
                style={{ height: '260px', fontFamily: 'monospace', fontSize: '13px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={saveLocale} style={{ background: '#16a34a', padding: '10px 20px' }}>
                Save Locale
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
                <th style={{ padding: '12px' }}>Locale</th>
                <th style={{ padding: '12px' }}>Display Name</th>
                <th style={{ padding: '12px' }}>Translation Keys</th>
                <th style={{ padding: '12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locales.map((locale) => (
                <tr key={locale.locale} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px' }}><code>{locale.locale}</code></td>
                  <td style={{ padding: '12px' }}>{locale.display_name}</td>
                  <td style={{ padding: '12px', fontSize: '12px' }}>{locale.translations ? Object.keys(locale.translations).length : 0}</td>
                  <td style={{ padding: '12px' }}>
                    <button type="button" onClick={() => editLocale(locale)} style={{ background: '#2563eb', padding: '6px 12px', marginRight: '8px', color: 'white', border: 'none', cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteLocale(locale.locale)} style={{ background: '#dc2626', padding: '6px 12px', color: 'white', border: 'none', cursor: 'pointer' }}>
                      Delete
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

export default LocalizationManagement;
