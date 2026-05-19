import React from 'react';

function AdminPanel({ stats }) {
  return (
    <div>
      <div className="grid">
        <div className="card">
          <h3>Total Applications</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats?.total || 0}</p>
        </div>
        <div className="card">
          <h3>Pending</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#eab308' }}>{stats?.pending || 0}</p>
        </div>
        <div className="card">
          <h3>Completed</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#22c55e' }}>{stats?.completed || 0}</p>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;