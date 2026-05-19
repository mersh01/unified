import React from 'react';

function StatusTracker({ application }) {
  const steps = ['SUBMITTED', 'VERIFICATION', 'DOCUMENT_VERIFICATION', 'PAYMENT_PENDING', 'COMPLETED'];
  const currentIndex = steps.indexOf(application?.current_state);

  return (
    <div style={{ marginTop: '20px' }}>
      <h4>Progress</h4>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
        {steps.map((step, index) => (
          <div key={step} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: index <= currentIndex ? '#22c55e' : '#e5e7eb',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: index <= currentIndex ? 'white' : '#9ca3af'
            }}>
              {index + 1}
            </div>
            <div style={{ fontSize: '12px', marginTop: '8px' }}>{step}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StatusTracker;