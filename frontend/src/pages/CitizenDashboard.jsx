import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function CitizenDashboard({ user }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination and filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Use 5 for testing or 10 normally

  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.reload();
    }
    return response;
  };

  useEffect(() => {
    fetchMyApplications();
  }, []);

  const fetchMyApplications = async () => {
    try {
      const userId = user?.user_id || user?.username;
      const response = await authFetch(`${API_URL}/api/applications/user/${userId}`);
      const data = await response.json();
      setApplications(data);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'SUBMITTED': '#f59e0b',
      'VERIFICATION': '#3b82f6',
      'COMPLETED': '#22c55e',
      'REJECTED': '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  // Filter and sort applications
  const filteredApps = applications.filter(app => {
    const matchesSearch = 
      (app.application_id && app.application_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (app.service_type && app.service_type.replace(/_/g, ' ').toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter ? app.current_state === statusFilter : true;
    
    return matchesSearch && matchesStatus;
  });

  const sortedApps = [...filteredApps].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
    const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
    return dateB - dateA;
  });

  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(sortedApps.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentApps = sortedApps.slice(indexOfFirstItem, indexOfLastItem);

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  if (loading) {
    return <div className="loading">Loading your applications...</div>;
  }

  return (
    <div>
      <div className="card">
        <h2>Welcome, {user?.name || user?.user_id || 'Citizen'}!</h2>
        <p>Track your applications and apply for new services.</p>
        <Link to="/apply">
          <button>Apply for New Service →</button>
        </Link>
      </div>

      <div className="card">
        <h3>My Applications</h3>
        
        {applications.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="Search by ID or Service..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', flex: 1, minWidth: '200px' }}
            />
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="VERIFICATION">Under Verification</option>
              <option value="PAYMENT_PENDING">Payment Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        )}

        {filteredApps.length === 0 ? (
          <p>{applications.length === 0 ? "You haven't submitted any applications yet." : "No applications match your search."}</p>
        ) : (
          <div>
            {currentApps.map(app => (
              <div key={app.application_id} style={{ 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px', 
                padding: '15px', 
                marginBottom: '15px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p><strong>Application ID:</strong> {app.application_id}</p>
                    <p><strong>Service:</strong> {app.service_type?.replace(/_/g, ' ').toUpperCase()}</p>
                    <p><strong>Submitted:</strong> {new Date(app.created_at).toLocaleDateString()}</p>
                    {app.tracking_id && <p><strong>Tracking ID:</strong> {app.tracking_id}</p>}
                  </div>
                  <div>
                    <span style={{ 
                      background: getStatusColor(app.current_state), 
                      color: 'white', 
                      padding: '4px 12px', 
                      borderRadius: '20px',
                      fontSize: '12px'
                    }}>
                      {app.current_state}
                    </span>
                  </div>
                </div>
                {app.rejection_reason && (
                  <div style={{ marginTop: '10px', padding: '10px', background: '#fee2e2', borderRadius: '8px', color: '#991b1b' }}>
                    <strong>Rejection Reason:</strong> {app.rejection_reason}
                  </div>
                )}
                <div style={{ marginTop: '10px' }}>
                  <Link to={`/track?appId=${app.application_id}`}>
                    <button style={{ padding: '6px 12px', fontSize: '13px' }}>Track Details →</button>
                  </Link>
                </div>
              </div>
            ))}
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
                <button 
                  onClick={() => handlePageChange(currentPage - 1)} 
                  disabled={currentPage === 1}
                  style={{ padding: '6px 12px', background: currentPage === 1 ? '#e5e7eb' : '#2563eb', color: currentPage === 1 ? '#9ca3af' : 'white', border: 'none', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  Previous
                </button>
                <span style={{ fontSize: '14px' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  onClick={() => handlePageChange(currentPage + 1)} 
                  disabled={currentPage === totalPages}
                  style={{ padding: '6px 12px', background: currentPage === totalPages ? '#e5e7eb' : '#2563eb', color: currentPage === totalPages ? '#9ca3af' : 'white', border: 'none', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CitizenDashboard;