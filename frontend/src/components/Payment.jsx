import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

/**
 * Reusable Payment Component
 * Integrates Chapa payment gateway for services requiring payment
 * 
 * Props:
 * - applicationId: string (required) - Application ID for payment linking
 * - feeAmount: number (required) - Amount to be paid in ETB/INR
 * - serviceName: string (required) - Name of the service
 * - userEmail: string (required) - Customer email for receipt
 * - userName: string (required) - Customer name for receipt
 * - onPaymentSuccess: function (required) - Callback when payment succeeds
 * - onPaymentCancel: function (optional) - Callback when payment is cancelled
 * - currency: string (default: 'ETB') - Payment currency
 */
const Payment = ({
  applicationId,
  feeAmount,
  serviceName,
  userEmail,
  userName,
  onPaymentSuccess,
  onPaymentCancel,
  currency = 'ETB',
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [chapaPublicKey, setChapaPublicKey] = useState(null);

  // Initialize Chapa public key from backend
  useEffect(() => {
    const initChapaKey = async () => {
      try {
        const response = await fetch(`${API_URL}/api/payment/chapa-key`);
        if (response.ok) {
          const data = await response.json();
          setChapaPublicKey(data.public_key);
        }
      } catch (err) {
        console.error('Error fetching Chapa key:', err);
        setError('Unable to initialize payment gateway');
      }
    };
    
    initChapaKey();
    
    // Load Chapa SDK
    const script = document.createElement('script');
    script.src = 'https://checkout.chapa.co/static/js/chapa.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const handlePayment = async () => {
    if (!chapaPublicKey) {
      setError('Payment gateway not initialized');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const txRef = `${applicationId}-${Date.now()}`;
      
      // Initialize Chapa checkout
      if (window.Chapa) {
        window.Chapa.checkout({
          publicKey: chapaPublicKey,
          amount: feeAmount,
          currency: currency,
          email: userEmail,
          firstName: userName.split(' ')[0],
          lastName: userName.split(' ').slice(1).join(' ') || 'User',
          tx_ref: txRef,
          title: `Payment for ${serviceName}`,
          description: `Fee for ${serviceName} application (ID: ${applicationId})`,
          meta: {
            applicationId: applicationId,
            serviceName: serviceName,
          },
          callback_url: null,
          onClose: handlePaymentCancel,
          onSuccess: handlePaymentSuccess,
        });
      } else {
        setError('Chapa payment gateway failed to load');
      }
    } catch (err) {
      console.error('Error initiating payment:', err);
      setError('Error initiating payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (response) => {
    setLoading(true);

    try {
      // Verify payment on backend
      const verifyResponse = await fetch(
        `${API_URL}/api/applications/${applicationId}/verify-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            payment_id: response.transaction_id,
            reference: response.reference,
            status: response.status,
          }),
        }
      );

      if (verifyResponse.ok) {
        const result = await verifyResponse.json();
        setPaymentStatus('SUCCESS');
        onPaymentSuccess && onPaymentSuccess(result);
      } else {
        const error = await verifyResponse.json();
        setError(error.detail || 'Payment verification failed');
        setPaymentStatus('FAILED');
      }
    } catch (err) {
      console.error('Error verifying payment:', err);
      setError('Error processing payment verification');
      setPaymentStatus('FAILED');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentCancel = () => {
    setPaymentStatus('CANCELLED');
    onPaymentCancel && onPaymentCancel();
  };

  if (!chapaPublicKey) {
    return (
      <div style={{
        padding: '16px',
        background: 'var(--surface-alt-2)',
        borderRadius: '8px',
        border: '1px solid var(--border-strong)',
        color: 'var(--text-muted)',
        textAlign: 'center'
      }}>
        Initializing payment gateway...
      </div>
    );
  }

  if (feeAmount === 0) {
    return (
      <div style={{
        padding: '16px',
        background: '#dcfce7',
        borderRadius: '8px',
        border: '1px solid #86efac',
        color: '#166534'
      }}>
        ✅ This service is free - no payment required
      </div>
    );
  }

  if (paymentStatus === 'SUCCESS') {
    return (
      <div style={{
        padding: '16px',
        background: '#dcfce7',
        borderRadius: '8px',
        border: '1px solid #86efac',
        color: '#166534',
        textAlign: 'center'
      }}>
        ✅ Payment successful! Your application is ready for processing.
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '16px',
        background: '#fee2e2',
        borderRadius: '8px',
        border: '1px solid #fca5a5',
        color: '#991b1b'
      }}>
        ❌ {error}
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      background: 'var(--card-bg)',
      borderRadius: '12px',
      border: '1px solid var(--border-strong)',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{ marginTop: 0, color: 'var(--text-main)' }}>💳 Payment Required</h3>
      
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Service:</span>
            <strong style={{ color: 'var(--text-main)' }}>{serviceName}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Amount:</span>
            <strong style={{ fontSize: '18px', color: '#2563eb' }}>
              {currency} {feeAmount.toFixed(2)}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Reference:</span>
            <code style={{
              background: 'var(--surface-alt-2)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              color: 'var(--text-main)'
            }}>
              {applicationId}
            </code>
          </div>
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={loading || paymentStatus === 'SUCCESS'}
        style={{
          width: '100%',
          backgroundColor: loading ? '#cbd5e1' : '#2563eb',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.3s',
          marginTop: '16px'
        }}
      >
        {loading ? 'Processing...' : 'Pay with Chapa'}
      </button>

      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: 'var(--surface-alt-2)',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--text-muted)'
      }}>
        <strong>ℹ️ Payment Information:</strong>
        <ul style={{ marginTop: '8px', paddingLeft: '18px', marginBottom: 0 }}>
          <li>Payments are processed securely through Chapa</li>
          <li>Your transaction will be linked to your application</li>
          <li>You'll receive a receipt via email after successful payment</li>
          <li>Keep your application ID safe for future reference</li>
        </ul>
      </div>
    </div>
  );
};

export default Payment;
