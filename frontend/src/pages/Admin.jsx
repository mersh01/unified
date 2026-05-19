import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function Admin() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/dashboard`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div>
      <h2>Admin Dashboard</h2>
      
      <div className="grid">
        <div className="card">
          <h3>Total Applications</h3>
          <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#2563eb' }}>{stats?.total || 0}</p>
        </div>
        <div className="card">
          <h3>Pending</h3>
          <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#eab308' }}>{stats?.pending || 0}</p>
        </div>
        <div className="card">
          <h3>Completed</h3>
          <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#22c55e' }}>{stats?.completed || 0}</p>
        </div>
        <div className="card">
          <h3>Rejected</h3>
          <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#ef4444' }}>{stats?.rejected || 0}</p>
        </div>
      </div>

      <div className="card">
        <h3>Applications by Type</h3>
        {stats?.by_type?.map(item => (
          <div key={item.type} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
            <span>{item.type.replace('_', ' ').toUpperCase()}</span>
            <span style={{ fontWeight: 'bold' }}>{item.count}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h3>Management Tools</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
          <Link 
            to="/admin/users" 
            style={{ 
              padding: '16px', 
              background: '#e0e7ff', 
              borderRadius: '8px', 
              textDecoration: 'none', 
              color: '#312e81',
              fontWeight: '500',
              border: '1px solid #c7d2fe'
            }}
          >
            👥 User Management
          </Link>
          <Link 
            to="/admin/roles" 
            style={{ 
              padding: '16px', 
              background: '#fce7f3', 
              borderRadius: '8px', 
              textDecoration: 'none', 
              color: '#831843',
              fontWeight: '500',
              border: '1px solid #fbcfe8'
            }}
          >
            🎭 Role Management
          </Link>
          <Link 
            to="/admin/services" 
            style={{ 
              padding: '16px', 
              background: '#dbeafe', 
              borderRadius: '8px', 
              textDecoration: 'none', 
              color: '#0c2d6b',
              fontWeight: '500',
              border: '1px solid #bfdbfe'
            }}
          >
            ⚙️ Services
          </Link>
          <Link 
            to="/admin/workflows" 
            style={{ 
              padding: '16px', 
              background: '#dcfce7', 
              borderRadius: '8px', 
              textDecoration: 'none', 
              color: '#166534',
              fontWeight: '500',
              border: '1px solid #bbf7d0'
            }}
          >
            🔄 Workflows
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Admin;