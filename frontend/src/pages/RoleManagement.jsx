import React, { useState, useEffect } from 'react';
import PageWrapper from '../components/ui/PageWrapper';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

const PERMISSION_GROUPS = {
  Administration: [
    { key: 'manage_users', label: 'Manage Users' },
    { key: 'manage_roles', label: 'Manage Roles' },
    { key: 'view_system_reports', label: 'View System Reports' },
    { key: 'configure_system', label: 'Configure System' },
    { key: '*', label: 'Full Access (Super Admin)' },
  ],
  Verification: [
    { key: 'view_assigned_applications', label: 'View Assigned' },
    { key: 'view_team_applications', label: 'View Team' },
    { key: 'view_all_applications', label: 'View All' },
    { key: 'verify_documents', label: 'Verify Documents' },
    { key: 'update_application_status', label: 'Update Application Status' },
    { key: 'escalate_applications', label: 'Escalate Applications' },
    { key: 'override_decisions', label: 'Override Decisions' },
    { key: 'request_additional_docs', label: 'Request Additional Docs' },
    { key: 'add_comments', label: 'Add Comments' },
  ],
  Payments: [
    { key: 'view_payment_applications', label: 'View Payments' },
    { key: 'process_payments', label: 'Process Payments' },
    { key: 'refund_payments', label: 'Refund Payments' },
    { key: 'view_payment_reports', label: 'View Payment Reports' },
  ],
  'Issuance & Quality Check': [
    { key: 'view_ready_applications', label: 'View Ready' },
    { key: 'issue_certificates', label: 'Issue Certificates' },
    { key: 'generate_tracking_ids', label: 'Generate Tracking IDs' },
    { key: 'print_documents', label: 'Print Documents' },
    { key: 'view_completed_applications', label: 'View Completed' },
    { key: 'quality_check', label: 'Quality Check' },
    { key: 'flag_issues', label: 'Flag Issues' },
    { key: 'approve_final', label: 'Approve Final' },
  ],
  'Citizen & CSR Actions': [
    { key: 'submit_applications', label: 'Submit Own Applications' },
    { key: 'create_application', label: 'Create New Applications' },
    { key: 'submit_proxy_applications', label: 'Submit Proxy Applications (CSR)' },
    { key: 'view_own_applications', label: 'View Own Applications' },
    { key: 'track_applications', label: 'Track Applications' },
  ]
};

// Helper to format permission key to label
const formatPermissionLabel = (key) => {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};
function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [workflowPermissions, setWorkflowPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editRoleName, setEditRoleName] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('');

  const initialFormState = {
    role_name: '',
    display_name: '',
    description: '',
    permissions: [],
    departments: [],
    priority: 10,
    can_assign_roles: false,
  };

  const [form, setForm] = useState(initialFormState);

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
    fetchDepartments();
    fetchWorkflowPermissions();
  }, []);

  const fetchWorkflowPermissions = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/workflow-permissions`);
      if (response.ok) {
        const data = await response.json();
        // Handle both old and new response formats
        setWorkflowPermissions(data.workflow_permissions || data.workflow || []);
      }
    } catch (error) {
      console.error('Error fetching workflow permissions:', error);
    }
  };

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

  const handlePermissionToggle = (key) => {
    setForm(prev => {
      const permissions = prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key];
      return { ...prev, permissions };
    });
  };

  const handleGroupToggle = (groupName, selectAll) => {
    const groupKeys = PERMISSION_GROUPS[groupName].map(item => item.key);
    setForm(prev => {
      let permissions;
      if (selectAll) {
        // Add all keys from group that aren't already there
        permissions = [...new Set([...prev.permissions, ...groupKeys])];
      } else {
        // Remove all keys from group
        permissions = prev.permissions.filter(p => !groupKeys.includes(p));
      }
      return { ...prev, permissions };
    });
  };

  const handleDepartmentToggle = (key) => {
    setForm(prev => {
      const departments = prev.departments.includes(key)
        ? prev.departments.filter(d => d !== key)
        : [...prev.departments, key];
      return { ...prev, departments };
    });
  };

  const openCreateForm = () => {
    setIsEditing(false);
    setEditRoleName(null);
    setForm(initialFormState);
    setShowForm(true);
  };

  const openEditForm = (r) => {
    setIsEditing(true);
    setEditRoleName(r.role_id);
    setForm({
      role_name: r.role_id,
      display_name: r.name || '',
      description: r.description || '',
      permissions: Array.isArray(r.permissions) ? r.permissions : [],
      departments: Array.isArray(r.departments) ? r.departments : [],
      priority: r.priority ?? 10,
      can_assign_roles: r.can_assign_roles ?? false,
    });
    setShowForm(true);
  };

  const saveRole = async (e) => {
    e.preventDefault();
    if (!form.role_name.trim() || !form.display_name.trim()) {
      alert('Role Slug and Display Name are required');
      return;
    }

    const roleNameSlug = form.role_name.trim().toLowerCase().replace(/\s+/g, '_');
    
    // Prepare endpoint URL and method
    const url = isEditing 
      ? `${API_URL}/api/admin/roles/${editRoleName}`
      : `${API_URL}/api/admin/roles`;
    
    const method = isEditing ? 'PUT' : 'POST';

    const payload = isEditing ? {
      display_name: form.display_name.trim(),
      description: form.description,
      permissions: form.permissions,
      departments: form.departments,
      priority: Number(form.priority) || 0,
      can_assign_roles: form.can_assign_roles,
    } : {
      role_name: roleNameSlug,
      display_name: form.display_name.trim(),
      description: form.description,
      permissions: form.permissions,
      departments: form.departments,
      priority: Number(form.priority) || 0,
      can_assign_roles: form.can_assign_roles,
    };

    const res = await authFetch(url, {
      method,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      alert(isEditing ? 'Role updated successfully!' : 'Role created successfully!');
      setShowForm(false);
      setForm(initialFormState);
      fetchRoles();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || 'Failed to save role');
    }
  };

  if (loading) return <div className="loading">Loading roles...</div>;

  // Apply filters
  const filteredRoles = roles.filter(r => {
    const searchMatch = !searchQuery || 
      (r.role_id && r.role_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.name && r.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const deptMatch = !filterDept || (r.departments && r.departments.includes(filterDept));
    
    return searchMatch && deptMatch;
  });

  return (
    <PageWrapper
      title="Role Management"
      subtitle="Define roles, configure functional scopes, and manage fine-grained workflow permissions checklist."
      actions={(
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-3 py-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roles..."
              className="bg-transparent border-none px-0 py-0 text-sm text-slate-900 focus:ring-0"
            />
            <Select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="bg-white text-sm">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.key} value={d.key}>{d.label}</option>) }
            </Select>
          </div>
          <Button onClick={() => { if (showForm) setShowForm(false); else openCreateForm(); }} variant={showForm ? 'secondary' : 'primary'}>
            {showForm ? 'Cancel' : '+ New Role'}
          </Button>
        </div>
      )}
    >

        {showForm && (
          <div className="bg-slate-50 border border-slate-200" style={{ marginBottom: '32px', padding: '24px', borderRadius: '12px' }}>
            <h3 className="text-slate-900 border-slate-200" style={{ marginTop: 0, borderBottomWidth: '1px', borderBottomStyle: 'solid', paddingBottom: '12px', marginBottom: '20px', fontWeight: '700' }}>
              {isEditing ? `Edit Role: ${form.display_name}` : 'Define New System Role'}
            </h3>
            
            <form onSubmit={saveRole}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Role Identifier (Slug)</label>
                  <Input
                    value={form.role_name}
                    onChange={(e) => setForm({ ...form, role_name: e.target.value })}
                    disabled={isEditing}
                    className={isEditing ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}
                    placeholder="e.g. regional_auditor"
                    required
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Lowercase word separation via underscores. Unique system primary key.
                  </span>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Display Name</label>
                  <Input
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    placeholder="e.g. Regional Auditor"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Audits incoming regional level applications..."
                />
              </div>

              {/* Grouped Permissions Checklist */}
              <div style={{ marginBottom: '24px' }}>
                <label className="text-slate-900 border-slate-200" style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', borderBottomWidth: '2px', borderBottomStyle: 'solid', paddingBottom: '6px' }}>
                  Role Permissions Checklist
                </label>
                
                {/* Workflow-based Permissions */}
                {workflowPermissions.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/10 border border-green-300 dark:border-green-800" style={{ borderRadius: '8px', padding: '16px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span className="text-green-800 dark:text-green-400" style={{ fontWeight: '600', fontSize: '14px' }}>
                        🔄 Workflow-Based Permissions
                      </span>
                      <span className="text-green-800 bg-green-100 dark:bg-green-900/30 dark:text-green-400" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>
                        Auto-synced from workflows
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                      {workflowPermissions.map(permKey => {
                        const isChecked = form.permissions.includes(permKey);
                        return (
                          <label 
                            key={permKey} 
                            className={isChecked ? "bg-green-100 border-green-500 text-green-800 dark:bg-green-900/30 dark:border-green-600 dark:text-green-400" : "bg-slate-50 border-slate-200 text-slate-700 dark:text-slate-300"}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              padding: '8px 12px', 
                              borderWidth: '1px', borderStyle: 'solid',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              margin: 0,
                              fontWeight: isChecked ? '500' : 'normal',
                            }}
                          >
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={() => handlePermissionToggle(permKey)}
                              style={{ width: 'auto', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {formatPermissionLabel(permKey)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Standalone/System Permissions */}
                {Object.entries(PERMISSION_GROUPS).map(([groupName, groupItems]) => {
                  const allGroupKeys = groupItems.map(item => item.key);
                  const isAllChecked = allGroupKeys.every(k => form.permissions.includes(k));
                  const isSomeChecked = allGroupKeys.some(k => form.permissions.includes(k));

                  return (
                    <div key={groupName} className="bg-white border border-slate-200" style={{ borderRadius: '8px', padding: '16px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span className="text-slate-900" style={{ fontWeight: '600', fontSize: '14px' }}>{groupName}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleGroupToggle(groupName, true)}
                            className="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                            style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGroupToggle(groupName, false)}
                            className="bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400"
                            style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                        {groupItems.map(item => {
                          const isChecked = form.permissions.includes(item.key);
                          return (
                            <label 
                              key={item.key} 
                              className={isChecked ? "bg-green-50 border-green-300 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400" : "bg-slate-50 border-slate-200 text-slate-700 dark:text-slate-300"}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: '8px 12px', 
                                borderWidth: '1px', borderStyle: 'solid',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                margin: 0,
                                fontWeight: isChecked ? '500' : 'normal',
                              }}
                            >
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={() => handlePermissionToggle(item.key)}
                                style={{ width: 'auto', cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Department Multi-Select Checklist */}
              <div style={{ marginBottom: '24px' }}>
                <label className="text-slate-900 border-slate-200" style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', borderBottomWidth: '2px', borderBottomStyle: 'solid', paddingBottom: '6px' }}>
                  Functional Departments Scope
                </label>
                <div className="bg-white border border-slate-200" style={{ borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                    {[{key: 'all', label: 'All Departments'}, ...departments].map(dept => {
                      const isChecked = form.departments.includes(dept.key);
                      return (
                        <label 
                          key={dept.key}
                          className={isChecked ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400" : "bg-slate-50 border-slate-200 text-slate-700 dark:text-slate-300"}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            padding: '8px 12px', 
                            borderWidth: '1px', borderStyle: 'solid',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            margin: 0,
                            fontWeight: isChecked ? '500' : 'normal',
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => handleDepartmentToggle(dept.key)}
                            style={{ width: 'auto', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '13px' }}>{dept.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Role Priority Index (0 = lowest)</label>
                  <Input
                    type="number"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Determines relative hierarchy weight and delegation permission priority.
                  </span>
                </div>
                <div>
                  <label className="bg-white border border-slate-200" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderRadius: '8px', cursor: 'pointer', height: '100%', margin: 0 }}>
                    <input 
                      type="checkbox" 
                      checked={form.can_assign_roles} 
                      onChange={(e) => setForm({ ...form, can_assign_roles: e.target.checked })} 
                      style={{ width: 'auto', cursor: 'pointer' }}
                    />
                    <div>
                      <span style={{ display: 'block', fontSize: '14px', fontWeight: '600' }}>Can Assign Roles</span>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>If checked, this role is allowed to delegate roles to other users.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button variant="success" type="submit">
                  Save Role
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="border border-slate-200" style={{ overflowX: 'auto', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200" style={{ textAlign: 'left' }}>
                <th className="text-slate-600" style={{ padding: '14px 16px', fontWeight: '600' }}>Role Slug</th>
                <th className="text-slate-600" style={{ padding: '14px 16px', fontWeight: '600' }}>Display Name</th>
                <th className="text-slate-600" style={{ padding: '14px 16px', fontWeight: '600' }}>Description</th>
                <th className="text-slate-600" style={{ padding: '14px 16px', fontWeight: '600' }}>Scope Departments</th>
                <th className="text-slate-600" style={{ padding: '14px 16px', fontWeight: '600' }}>Permissions Checklist</th>
                <th className="text-slate-600" style={{ padding: '14px 16px', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((r) => (
                <tr className="border-b border-slate-100" key={r.role_id} style={{ transition: 'background 0.2s' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <code className="bg-slate-100 text-slate-900" style={{ padding: '4px 8px', borderRadius: '4px', fontWeight: '600' }}>
                      {r.role_id}
                    </code>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-main)', fontWeight: '600' }}>{r.name}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>{r.description || '—'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {r.departments && r.departments.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {r.departments.map(d => (
                          <span key={d} style={{ color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                            {d}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <Badge variant="info">{r.permissions?.length || 0} permissions</Badge>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <Button variant="secondary" onClick={() => openEditForm(r)}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </PageWrapper>
  );
}

export default RoleManagement;
