import React, { useState, useEffect } from 'react';

function PaymentModal({ 
  isOpen, 
  onClose, 
  serviceConfig, 
  formData, 
  onPaymentSuccess,
  API_URL 
}) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, processing, success, failed
  const [paymentError, setPaymentError] = useState('');
  const [transactionId, setTransactionId] = useState('');

  const paymentMethods = serviceConfig?.payment?.methods || [];
  const feeAmount = serviceConfig?.fee_amount || 0;

  useEffect(() => {
    if (isOpen) {
      setSelectedMethod(null);
      setPaymentStatus('idle');
      setPaymentError('');
      setTransactionId('');
    }
  }, [isOpen]);

  const handlePaymentMethodSelect = (method) => {
    setSelectedMethod(method);
    setPaymentError('');
  };

  const initiatePayment = async () => {
    if (!selectedMethod) {
      setPaymentError('Please select a payment method');
      return;
    }

    setLoading(true);
    setPaymentStatus('processing');
    setPaymentError('');

    try {
      // For gateway-integrated methods (Telebirr, CBE Birr)
      if (selectedMethod.gateway_integration) {
        await handleGatewayPayment(selectedMethod);
      } else {
        // For bank transfer (manual)
        await handleBankTransferPayment(selectedMethod);
      }
    } catch (error) {
      setPaymentStatus('failed');
      setPaymentError(error.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGatewayPayment = async (method) => {
    // Simulate gateway payment flow
    // In production, this would integrate with actual payment gateways
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    const paymentRequest = {
      service_type: serviceConfig.id,
      amount: feeAmount,
      payment_method: method.type,
      user_id: storedUser?.user_id || `user_${Date.now()}`,
      return_url: window.location.href,
      cancel_url: window.location.href
    };

    // Call backend to initiate payment
    const response = await fetch(`${API_URL}/api/payment/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentRequest)
    });

    const result = await response.json();

    if (result.success && result.payment_url) {
      // Redirect to payment gateway
      window.location.href = result.payment_url;
    } else if (result.success && result.transaction_id) {
      // Payment completed immediately (for testing)
      setTransactionId(result.transaction_id);
      setPaymentStatus('success');
      setTimeout(() => {
        onPaymentSuccess({
          payment_method: method.type,
          transaction_id: result.transaction_id,
          payment_amount: feeAmount
        });
      }, 1500);
    } else {
      throw new Error(result.message || 'Failed to initiate payment');
    }
  };

  const handleBankTransferPayment = async (method) => {
    // For bank transfer, show account details and wait for manual confirmation
    // In production, this would involve uploading proof of payment
    if (!transactionId) {
      setPaymentError('Please enter your transaction/reference number');
      return;
    }

    const paymentData = {
      payment_method: method.type,
      transaction_id: transactionId,
      payment_amount: feeAmount
    };

    // Verify payment with backend
    const response = await fetch(`${API_URL}/api/payment/verify-bank-transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });

    const result = await response.json();

    if (result.success) {
      setPaymentStatus('success');
      setTimeout(() => {
        onPaymentSuccess(paymentData);
      }, 1500);
    } else {
      throw new Error(result.message || 'Payment verification failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Complete Payment</h2>
              <p className="text-sm text-gray-600 mt-1">
                {serviceConfig?.name || 'Service'} - ETB {feeAmount.toLocaleString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              disabled={loading || paymentStatus === 'processing'}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {paymentStatus === 'idle' && (
            <>
              {/* Payment Method Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select Payment Method
                </label>
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.type}
                      onClick={() => handlePaymentMethodSelect(method)}
                      disabled={!method.enabled || loading}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        selectedMethod?.type === method.type
                          ? 'border-[#0b4f8a] bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${!method.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center">
                          {selectedMethod?.type === method.type && (
                            <div className="w-3 h-3 rounded-full bg-[#0b4f8a]" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{method.name}</p>
                          {method.gateway_integration && (
                            <p className="text-xs text-green-600 mt-1">✓ Instant Payment</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank Transfer Details */}
              {selectedMethod?.type === 'bank_transfer' && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <h3 className="font-semibold text-yellow-800 mb-2">Bank Transfer Details</h3>
                  <div className="text-sm text-yellow-700 space-y-1">
                    <p><strong>Bank:</strong> {selectedMethod.account_details?.bank_name}</p>
                    <p><strong>Account Number:</strong> {selectedMethod.account_details?.account_number}</p>
                    <p><strong>Account Name:</strong> {selectedMethod.account_details?.account_name}</p>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Transaction / Reference Number *
                    </label>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="Enter your transaction number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b4f8a]"
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {paymentError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {paymentError}
                </div>
              )}

              {/* Pay Button */}
              <button
                onClick={initiatePayment}
                disabled={!selectedMethod || loading}
                className="w-full py-3 px-4 bg-[#0b4f8a] text-white font-semibold rounded-xl hover:bg-[#0a3d6f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : `Pay ETB ${feeAmount.toLocaleString()}`}
              </button>
            </>
          )}

          {paymentStatus === 'processing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b4f8a] mx-auto mb-4"></div>
              <p className="text-gray-600">Processing payment...</p>
              <p className="text-sm text-gray-500 mt-2">Please do not close this window</p>
            </div>
          )}

          {paymentStatus === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Successful!</h3>
              <p className="text-gray-600">Your application will be submitted automatically.</p>
            </div>
          )}

          {paymentStatus === 'failed' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Failed</h3>
              <p className="text-gray-600 mb-4">{paymentError}</p>
              <button
                onClick={() => setPaymentStatus('idle')}
                className="px-6 py-2 bg-[#0b4f8a] text-white rounded-lg hover:bg-[#0a3d6f] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;
