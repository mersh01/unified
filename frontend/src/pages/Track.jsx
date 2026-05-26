import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import RatingField from '../components/RatingField';
import Payment from '../components/Payment';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

function Track() {
  const [searchParams] = useSearchParams();
  const [applicationId, setApplicationId] = useState(searchParams.get('appId') || '');
  const [application, setApplication] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [availableActions, setAvailableActions] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionDetails, setActionDetails] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [actionComment, setActionComment] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [statusColors, setStatusColors] = useState({});
  const [statusNames, setStatusNames] = useState({});
  const [actionDefinitions, setActionDefinitions] = useState({});
  const [actionPayload, setActionPayload] = useState({});
  const [previewItem, setPreviewItem] = useState(null);

  // Get current user from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        console.log('Current user:', userData);
        setUser(userData);
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
  }, []);

  // Fetch status display names from backend
  useEffect(() => {
    fetchStatusConfig();
  }, []);

  const fetchStatusConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/api/workflow/status-config`);
      if (response.ok) {
        const data = await response.json();
        setStatusColors(data.colors || {});
        setStatusNames(data.names || {});
      }
    } catch (error) {
      console.error('Error fetching status config:', error);
      setStatusColors({
        'SUBMITTED': '#f59e0b',
        'VERIFICATION': '#3b82f6',
        'DOCUMENT_VERIFICATION': '#8b5cf6',
        'DOCUMENT_CHECK': '#06b6d4',
        'PAYMENT_PENDING': '#ec4898',
        'PAYMENT_COMPLETED': '#10b981',
        'CERTIFICATE_GENERATED': '#10b981',
        'COMPLETED': '#22c55e',
        'REJECTED': '#ef4444'
      });
      setStatusNames({
        'SUBMITTED': 'Submitted',
        'VERIFICATION': 'Under Verification',
        'DOCUMENT_VERIFICATION': 'Document Verification',
        'DOCUMENT_CHECK': 'Document Check',
        'PAYMENT_PENDING': 'Payment Pending',
        'PAYMENT_COMPLETED': 'Payment Completed',
        'CERTIFICATE_GENERATED': 'Certificate Generated',
        'COMPLETED': 'Completed',
        'REJECTED': 'Rejected'
      });
    }
    
    try {
      const response = await fetch(`${API_URL}/api/workflow/action-definitions`);
      if (response.ok) {
        const data = await response.json();
        setActionDefinitions(data || {});
      }
    } catch (error) {
      console.error('Error fetching action definitions:', error);
    }
  };

  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
      throw new Error('Session expired');
    }
    
    return response;
  };

  const trackApplication = async () => {
    if (!applicationId.trim()) {
      setError('Please enter an Application ID');
      return;
    }

    setLoading(true);
    setError(null);
    setApplication(null);
    setAvailableActions([]);

    try {
      const response = await authFetch(`${API_URL}/api/applications/${applicationId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Application data:', data);
        console.log('Form data:', data.form_data);
        setApplication(data);
        
        await fetchAvailableActions(applicationId);
      } else {
        setError('Application not found. Please check the ID and try again.');
      }
    } catch (error) {
      console.error('Error tracking application:', error);
      setError('Error connecting to server. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableActions = async (appId) => {
    try {
      console.log('Fetching available actions for:', appId);
      const response = await authFetch(`${API_URL}/api/applications/${appId}/available-actions`);
      const data = await response.json();
      console.log('Available actions response:', data);
      setAvailableActions(data.actions || []);
      setActionDetails(data.action_details || {});
    } catch (error) {
      console.error('Error fetching actions:', error);
    }
  };

  const handleActionClick = async (action) => {
    setSelectedAction(action);
    setActionComment('');
    setAssignTo('');
    setActionPayload({});
    setShowModal(true);
    
    const details = actionDetails[action];
    if (details && details.assignable && details.target_role) {
      setUsersLoading(true);
      try {
        const response = await authFetch(`${API_URL}/api/users/by-role/${details.target_role}`);
        if (response.ok) {
          const users = await response.json();
          setAvailableUsers(users);
        } else {
          setAvailableUsers([]);
        }
      } catch (e) {
        console.error("Error fetching users for role", e);
        setAvailableUsers([]);
      } finally {
        setUsersLoading(false);
      }
    } else {
      setAvailableUsers([]);
    }
  };

  const submitAction = async () => {
    if (!selectedAction) return;
    
    setActionLoading(true);
    try {
      const response = await authFetch(`${API_URL}/api/applications/${applicationId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          action: selectedAction,
          user_id: user?.username || user?.user_id || 'admin',
          comment: actionComment,
          assign_to: assignTo || null,
          payload: Object.keys(actionPayload).length > 0 ? actionPayload : null
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`✅ Application ${selectedAction} successful! New state: ${result.new_state}`);
        setShowModal(false);
        await trackApplication();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.detail || 'Failed to update status'}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating application status');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    return statusColors[status] || '#6b7280';
  };

  const handlePaymentSuccess = async () => {
    alert('Payment successful!');
    await trackApplication();
  };

  const handlePaymentCancel = () => {
    console.log('Payment cancelled by user');
  };

  const getStatusDisplayName = (status) => {
    return statusNames[status] || status;
  };

  const isAdmin = user?.type === 'admin' || 
                  (user?.role && user?.role !== 'citizen');

  // Helper to format field names for display
  const formatFieldName = (fieldName) => {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const normalizeDocumentUrl = (rawUrl) => {
    if (typeof rawUrl !== 'string') return rawUrl;
    if (rawUrl.startsWith('/api/uploads/')) return `${API_URL}${rawUrl}`;
    try {
      const parsed = new URL(rawUrl);
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const documentsIndex = pathParts.findIndex(part => part === 'documents');
      if (documentsIndex >= 0 && pathParts.length > documentsIndex + 1) {
        return `${API_URL}/api/uploads/documents/${pathParts[documentsIndex + 1]}`;
      }
      return rawUrl;
    } catch {
      return rawUrl;
    }
  };

  const openPreview = (item) => setPreviewItem(item);
  const closePreview = () => setPreviewItem(null);

  const isValidUrl = (value) => {
    if (typeof value !== 'string') return false;
    // Check for absolute URLs
    try {
      new URL(value);
      return true;
    } catch {
      // Check for relative upload paths
      if (value.startsWith('/api/uploads/') || value.startsWith('/uploads/')) {
        return true;
      }
      return false;
    }
  };

  const renderFormValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return 'Not provided';
    }

    if (Array.isArray(value)) {
      return (
        <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-main)' }}>
          {value.map((item, index) => (
            <li key={`${item}-${index}`}>{renderFormValue(item)}</li>
          ))}
        </ul>
      );
    }

    if (typeof value === 'object') {
      return <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-main)', margin: 0 }}>{JSON.stringify(value, null, 2)}</pre>;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      // Updated regex to match both decimal and integer coordinates
      const coordsMatch = trimmed.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
      if (coordsMatch) {
        const lat = coordsMatch[1];
        const lng = coordsMatch[2];
        const bbox = `${lng - 0.02}%2C${lat - 0.02}%2C${lng + 0.02}%2C${lat + 0.02}`;
        // Use OpenStreetMap with marker parameter
        const embedMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
        const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        
        return (
          <div style={{ border: '1px solid var(--border-strong)', borderRadius: '12px', padding: '12px', background: 'var(--surface-alt-2)' }}>
            <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)' }}>🗺️ Map Location</strong>
            <div style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '13px' }}>
              Coordinates: {lat}, {lng}
            </div>
            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', marginBottom: '12px', minHeight: '250px', position: 'relative' }}>
              <iframe
                title="Map Preview"
                src={embedMapUrl}
                style={{ width: '100%', minHeight: '250px', border: 0 }}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}
              >
                Open in Google Maps
              </a>
            </div>
          </div>
        );
      }

      if (isValidUrl(trimmed)) {
        const normalizedUrl = normalizeDocumentUrl(trimmed);
        const fileName = trimmed.split('/').pop();
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(trimmed);
        const isPdf = /\.pdf$/i.test(trimmed);
        const isDoc = /\.(doc|docx)$/i.test(trimmed);
        const isExcel = /\.(xls|xlsx)$/i.test(trimmed);

        // Get file icon based on type
        const getFileIcon = () => {
          if (isImage) return '📷';
          if (isPdf) return '📄';
          if (isDoc) return '📝';
          if (isExcel) return '📊';
          return '📎';
        };

        return (
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '12px', border: '1px solid var(--border-strong)', borderRadius: '12px', background: 'var(--card-bg)' }}>
            {isImage ? (
              <img
                src={normalizedUrl}
                alt={fileName}
                onClick={() => openPreview({ type: 'image', url: normalizedUrl, title: fileName || 'Image Preview' })}
                style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '12px', cursor: 'pointer', border: '1px solid #d1d5db' }}
              />
            ) : (
              <div style={{ width: '120px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', background: 'var(--surface-alt-2)', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', textAlign: 'center', padding: '8px', fontSize: '24px' }}>
                {getFileIcon()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '600', marginBottom: '6px', color: 'var(--text-main)', fontSize: '14px' }}>{fileName || trimmed}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <a href={normalizedUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', fontSize: '13px' }}>
                  Open in new tab
                </a>
                {isImage && (
                  <button
                    type="button"
                    onClick={() => openPreview({ type: 'image', url: normalizedUrl, title: fileName || 'Image Preview' })}
                    style={{ background: '#374151', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Preview
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      }
      return trimmed;
    }

    return String(value);
  };

  // Helper to get action display label from config
  const getActionLabel = (action) => {
    return actionDefinitions[action]?.display_label || action.replace(/_/g, ' ');
  };

  // Helper to render form data in a structured way
  const renderFormData = (formData) => {
    if (!formData || Object.keys(formData).length === 0) {
      return <p>No additional data submitted.</p>;
    }

    // Group fields if needed (you can customize this grouping)
    const personalFields = ['full_name', 'student_name', 'date_of_birth', 'place_of_birth', 'blood_group'];
    const familyFields = ['mother_name', 'father_name', 'spouse_name'];
    const documentFields = ['passport_number', 'pan_number', 'license_number', 'voter_id_number', 'registration_number'];
    const addressFields = ['address', 'new_address', 'place_of_issue', 'hospital_name', 'school_name', 'board_name'];
    const financialFields = ['income_amount', 'tax_paid', 'deductions', 'fee_amount'];
    const otherFields = ['reason_for_replacement', 'correction_field', 'correct_value', 'caste_category'];

    const groupedData = {
      'Personal Information': {},
      'Family Information': {},
      'Document Information': {},
      'Address & Location': {},
      'Financial Information': {},
      'Other Information': {}
    };

    Object.entries(formData).forEach(([key, value]) => {
      if (!value) return;
      if (key.startsWith('_')) return; // Ignore internal data like _multi_step_data
      
      const displayValue = renderFormValue(value);
      
      if (personalFields.includes(key)) {
        groupedData['Personal Information'][key] = displayValue;
      } else if (familyFields.includes(key)) {
        groupedData['Family Information'][key] = displayValue;
      } else if (documentFields.includes(key)) {
        groupedData['Document Information'][key] = displayValue;
      } else if (addressFields.includes(key)) {
        groupedData['Address & Location'][key] = displayValue;
      } else if (financialFields.includes(key)) {
        groupedData['Financial Information'][key] = displayValue;
      } else {
        groupedData['Other Information'][key] = displayValue;
      }
    });

    return (
      <div>
        {Object.entries(groupedData).map(([sectionTitle, fields]) => {
          if (Object.keys(fields).length === 0) return null;
          return (
            <div key={sectionTitle} style={{ marginBottom: '20px' }}>
              <h4 style={{ color: 'var(--text-main)', marginBottom: '12px', borderBottom: '2px solid var(--border-strong)', paddingBottom: '8px' }}>
                {sectionTitle}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {Object.entries(fields).map(([key, value]) => (
                  <div key={key} style={{ padding: '12px', background: 'var(--surface-alt-2)', borderRadius: '8px', border: '1px solid var(--border-strong)' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '4px', fontSize: '13px' }}>
                      {formatFieldName(key)}
                    </div>
                    <div style={{ color: 'var(--text-main)', fontSize: '14px' }}>
                      {value || 'Not provided'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Auto-track if appId or application_id is in URL
  useEffect(() => {
    const appId = searchParams.get('appId') || searchParams.get('application_id');
    if (appId && applicationId) {
      trackApplication();
    }
  }, [searchParams, applicationId]);

  console.log('Is admin?', isAdmin);
  console.log('Available actions:', availableActions);
  console.log('Form data in application:', application?.form_data);

  return (
    <div>
      <div className="card">
        <h2>Track Your Application</h2>
        <div className="form-group">
          <label>Application ID:</label>
          <input
            type="text"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            placeholder="Enter your Application ID (e.g., BIRTH_CERTIFICATE_ABC123)"
          />
        </div>
        <button onClick={trackApplication} disabled={loading}>
          {loading ? 'Tracking...' : 'Track Status'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ background: '#fee2e2', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {application && (
        <div className="card">
          <h3>Application Details</h3>
          
          {/* Status Badge */}
          <div style={{ marginBottom: '20px' }}>
            <span style={{ 
              background: getStatusColor(application.current_state), 
              color: 'white', 
              padding: '6px 16px', 
              borderRadius: '20px',
              fontSize: '13px',
              display: 'inline-block'
            }}>
              Status: {getStatusDisplayName(application.current_state)}
            </span>
          </div>
          
          {/* Basic Information Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px', padding: '16px', background: 'var(--surface-alt-2)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Application ID</div>
              <div style={{ fontWeight: 'bold' }}>{application.application_id}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Service Type</div>
              <div style={{ fontWeight: 'bold' }}>{(application.service_type || application.document_type || '')?.replace(/_/g, ' ').toUpperCase()}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Applicant Name</div>
              <div style={{ fontWeight: 'bold' }}>{application.user_name}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Submitted</div>
              <div>{new Date(application.created_at).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fee Amount</div>
              <div>₹{application.fee_amount}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fee Paid</div>
              <div>{application.fee_paid ? '✅ Yes' : '❌ No'}</div>
            </div>
            {application.tracking_id && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tracking ID</div>
                <div>{application.tracking_id}</div>
              </div>
            )}
            {application.rejection_reason && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rejection Reason</div>
                <div style={{ color: '#dc2626' }}>{application.rejection_reason}</div>
              </div>
            )}
          </div>

          {application.fee_amount > 0 && !application.fee_paid && (
            <div style={{ marginTop: '24px' }}>
              <Payment
                applicationId={application.application_id}
                feeAmount={application.fee_amount}
                serviceName={(application.service_type || application.document_type || '')?.replace(/_/g, ' ').toUpperCase()}
                userEmail={application.user_email || application.email || user?.email || ''}
                userName={application.user_name || user?.full_name || user?.username || 'Applicant'}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentCancel={handlePaymentCancel}
                currency="ETB"
              />
            </div>
          )}
          
          {/* ALL Submitted Form Data - This is what the admin needs to verify! */}
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid var(--border-strong)' }}>
            <h4 style={{ marginBottom: '16px', color: 'var(--text-main)' }}>
              📋 Submitted Information 
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>
                (Data provided by citizen for verification)
              </span>
            </h4>
            {renderFormData(application.form_data)}
          </div>
          
          {/* Action Buttons - Available to allowed roles */}
          {availableActions.length > 0 && (
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-strong)' }}>
              <h4 style={{ color: 'var(--text-main)' }}>Available Actions</h4>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                {availableActions.map(action => (
                  <button
                    key={action}
                    onClick={() => handleActionClick(action)}
                    disabled={actionLoading}
                    style={{
                      background: action.includes('REJECT') || action.includes('CANCEL') ? '#dc2626' : '#2563eb',
                      color: 'white',
                      padding: '8px 20px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    {getActionLabel(action)}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {availableActions.length === 0 && application.current_state !== 'COMPLETED' && application.current_state !== 'REJECTED' && (
            <div style={{ marginTop: '20px', padding: '10px', background: '#fef3c7', borderRadius: '8px', color: '#92400e' }}>
              ℹ️ No actions available for your role in the current state.
            </div>
          )}

          {previewItem && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ position: 'absolute', inset: 0 }} onClick={closePreview} />
              <div style={{ position: 'relative', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflow: 'auto', background: 'var(--card-bg)', borderRadius: '18px', boxShadow: '0 20px 60px rgba(15,23,42,0.35)', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>{previewItem.title || 'Preview'}</h3>
                  <button onClick={closePreview} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
                </div>
                {previewItem.type === 'image' && (
                  <img src={previewItem.url} alt={previewItem.title} style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '12px', border: '1px solid var(--border-strong)' }} />
                )}
                {previewItem.type === 'map' && (
                  <iframe src={previewItem.url} title={previewItem.title} style={{ width: '100%', minHeight: '70vh', border: 'none', borderRadius: '12px' }} />
                )}
                {previewItem.type === 'file' && (
                  <iframe src={previewItem.url} title={previewItem.title} style={{ width: '100%', minHeight: '70vh', border: 'none', borderRadius: '12px' }} />
                )}
              </div>
            </div>
          )}

          {/* Application History */}
          <h4 style={{ marginTop: '24px', marginBottom: '12px' }}>Application History</h4>
          {application.history && application.history.map((entry, index) => (
            <div key={index} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-strong)' }}>
              <strong>{getStatusDisplayName(entry.state)}</strong> - {new Date(entry.timestamp).toLocaleString()}
              {entry.actor_name && <span style={{ marginLeft: '10px', fontSize: '12px', background: 'var(--surface-alt-2)', padding: '2px 8px', borderRadius: '10px' }}>👤 {entry.actor_name}</span>}
              {entry.comment && <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>💬 {entry.comment}</div>}
              {entry.payload && Object.keys(entry.payload).length > 0 && (
                <div style={{ marginTop: '8px', padding: '8px', background: 'var(--surface-alt-2)', border: '1px solid var(--border-strong)', borderRadius: '4px', fontSize: '12px' }}>
                  {Object.entries(entry.payload).map(([k, v]) => (
                    <div key={k}><strong style={{color: '#475569'}}>{k.replace(/_/g, ' ').toUpperCase()}:</strong> {v}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Action Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '12px', width: '400px', maxWidth: '90%' }}>
            <h3 style={{ marginTop: 0 }}>Action: {getActionLabel(selectedAction)}</h3>
            
            {/* Special handling for RESUBMIT action - show form data for editing */}
            {selectedAction === 'RESUBMIT' && application?.form_data && (
              <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--surface-alt-2)', borderRadius: '8px', border: '1px solid var(--border-strong)' }}>
                <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Update Application Information</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Please provide the requested information to resubmit your application.
                </p>
                {Object.entries(application.form_data).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
                      {key.replace(/_/g, ' ').toUpperCase()}
                    </label>
                    {typeof value === 'string' && value.length > 100 ? (
                      <textarea
                        value={actionPayload[key] || value}
                        onChange={e => setActionPayload({...actionPayload, [key]: e.target.value})}
                        style={{ width: '100%', height: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                      />
                    ) : (
                      <input
                        type="text"
                        value={actionPayload[key] || value}
                        onChange={e => setActionPayload({...actionPayload, [key]: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {!actionDefinitions[selectedAction]?.fields && selectedAction !== 'RESUBMIT' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Comment</label>
                <textarea 
                  value={actionComment} 
                  onChange={e => setActionComment(e.target.value)}
                  style={{ width: '100%', height: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  placeholder="Enter an optional comment..."
                />
              </div>
            )}
            
            {actionDefinitions[selectedAction]?.fields && selectedAction !== 'RESUBMIT' && (
              <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--surface-alt-2)', borderRadius: '8px', border: '1px solid var(--border-strong)' }}>
                <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Required Information</h4>
                {actionDefinitions[selectedAction].fields.map(field => (
                  <div key={field.name} style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
                      {field.label} {field.required && <span style={{color: 'red'}}>*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={actionPayload[field.name] || ''}
                        onChange={e => setActionPayload({...actionPayload, [field.name]: e.target.value})}
                        required={field.required}
                        style={{ width: '100%', height: '60px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                      />
                    ) : field.type === 'rating' ? (
                      <RatingField
                        value={actionPayload[field.name] || 0}
                        onChange={val => setActionPayload({...actionPayload, [field.name]: val})}
                        required={field.required}
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={actionPayload[field.name] || ''}
                        onChange={e => setActionPayload({...actionPayload, [field.name]: field.type === 'number' ? Number(e.target.value) : e.target.value})}
                        required={field.required}
                        min={field.min}
                        max={field.max}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {actionDetails[selectedAction]?.assignable && isAdmin && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Assign To (Optional)</label>
                {usersLoading ? (
                  <div>Loading available users...</div>
                ) : (
                  <select 
                    value={assignTo} 
                    onChange={e => setAssignTo(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                  >
                    <option value="">Pool (Any available {actionDetails[selectedAction].target_role})</option>
                    {availableUsers.map(u => (
                      <option key={u.user_id} value={u.user_id}>{u.full_name || u.username} ({u.department})</option>
                    ))}
                  </select>
                )}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  If left as Pool, any user with the required role in your department can claim it.
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowModal(false)}
                style={{ padding: '8px 16px', background: 'var(--surface-alt-2)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={submitAction}
                disabled={actionLoading}
                style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Track;