import React from 'react';

function ApplicationList({ applications }) {
  if (!applications || applications.length === 0) {
    return <div className="text-muted">No applications found.</div>;
  }

  return (
    <div>
      {applications.map(app => (
        <div key={app.application_id} className="card">
          <h4>{app.document_type.replace('_', ' ').toUpperCase()}</h4>
          <p>ID: {app.application_id}</p>
          <p>Status: {app.current_state}</p>
          <p>Submitted: {new Date(app.created_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}

export default ApplicationList;