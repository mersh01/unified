# Payment Integration Guide

This guide explains how to integrate the reusable Payment component with Chapa payment gateway into services that require payment.

## Overview

The Payment component is a reusable React component that handles payment processing through Chapa for any service that has a fee. It automatically:
- Fetches the Chapa public key from the backend
- Initiates Chapa checkout
- Verifies payment on the backend
- Updates the application's payment status
- Sends payment confirmation notifications

## Files Involved

### Frontend
- **Component**: `frontend/src/components/Payment.jsx` - Reusable Payment component
- **API URL**: Uses `VITE_API_URL` environment variable

### Backend
- **Main**: `backend/app/main.py` - Payment endpoints
- **Notifications**: `backend/app/notification_service.py` - Payment confirmation emails
- **Database**: Applications have `fee_amount`, `fee_paid`, and `payment_id` fields

## Setup

### 1. Environment Variables

Set these in your `.env` file:

```
# Frontend
VITE_API_URL=https://your-api-url.com

# Backend
CHAPA_PUBLIC_KEY=your-chapa-public-key
CHAPA_SECRET_KEY=your-chapa-secret-key  # Optional, for backend verification
```

### 2. Service Configuration

In your service configuration (e.g., `backend/config/services.json`), add a `fee_amount`:

```json
{
  "service_id": "birth_certificate_application",
  "name": "Birth Certificate",
  "fee_amount": 500,  // Fee in ETB or INR
  "description": "Apply for a birth certificate",
  ...
}
```

Services without `fee_amount` or with `fee_amount: 0` are considered free.

## Usage in Components

### Example 1: In Track.jsx (Application Tracking Page)

```jsx
import Payment from '../components/Payment';

function Track() {
  const [application, setApplication] = useState(null);

  const handlePaymentSuccess = async (result) => {
    console.log('Payment successful:', result);
    // Refresh application to show updated payment status
    await trackApplication();
    alert('✅ Payment successful! Your application is now being processed.');
  };

  const handlePaymentCancel = () => {
    alert('Payment cancelled. You can retry anytime.');
  };

  return (
    <div>
      {/* ... existing code ... */}
      
      {/* Show payment component if application needs payment */}
      {application && application.fee_amount > 0 && !application.fee_paid && (
        <Payment
          applicationId={application.application_id}
          feeAmount={application.fee_amount}
          serviceName={application.service_type?.replace(/_/g, ' ').toUpperCase()}
          userEmail={application.user_email}
          userName={application.user_name}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentCancel={handlePaymentCancel}
          currency="ETB"
        />
      )}

      {/* Show success message if already paid */}
      {application && application.fee_paid && (
        <div style={{ padding: '16px', background: '#dcfce7', borderRadius: '8px', color: '#166534' }}>
          ✅ Payment received. Your application is being processed.
        </div>
      )}
    </div>
  );
}
```

### Example 2: In Apply.jsx (Application Submission Page)

```jsx
import Payment from '../components/Payment';

function Apply() {
  const [application, setApplication] = useState(null);
  const [serviceFee, setServiceFee] = useState(0);

  // Fetch service fee when service is selected
  useEffect(() => {
    const fetchServiceFee = async () => {
      try {
        const response = await fetch(`${API_URL}/api/service/${selectedService}/fee`);
        const data = await response.json();
        setServiceFee(data.fee_amount);
      } catch (err) {
        console.error('Error fetching fee:', err);
      }
    };
    
    if (selectedService) fetchServiceFee();
  }, [selectedService]);

  const handleSubmitApplication = async (formData) => {
    // ... submit application code ...
    const newApplication = await submitApplication(formData);
    setApplication(newApplication);
    
    if (newApplication.fee_amount > 0) {
      // Payment is required
      // Component will show automatically below
    }
  };

  return (
    <div>
      {/* ... form code ... */}
      
      {/* Show payment after successful submission */}
      {application && application.fee_amount > 0 && !application.fee_paid && (
        <div style={{ marginTop: '24px' }}>
          <h2>Next Step: Complete Payment</h2>
          <Payment
            applicationId={application.application_id}
            feeAmount={application.fee_amount}
            serviceName={application.service_type?.replace(/_/g, ' ').toUpperCase()}
            userEmail={application.user_email}
            userName={application.user_name}
            onPaymentSuccess={() => {
              alert('Payment successful! Your application is now being processed.');
              // Optionally redirect or refresh
            }}
            currency="ETB"
          />
        </div>
      )}
    </div>
  );
}
```

### Example 3: In a Custom Service Component

```jsx
import Payment from '../components/Payment';

function CustomServiceComponent() {
  const handlePaymentSuccess = (result) => {
    // Handle successful payment
    console.log('Payment details:', result);
    // Update local state or navigate
  };

  return (
    <Payment
      applicationId="APP_12345"
      feeAmount={1000}
      serviceName="Document Attestation"
      userEmail="user@example.com"
      userName="John Doe"
      onPaymentSuccess={handlePaymentSuccess}
      currency="ETB"
    />
  );
}
```

## Component Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `applicationId` | string | ✅ | Unique application ID for tracking |
| `feeAmount` | number | ✅ | Amount to charge (in ETB/INR) |
| `serviceName` | string | ✅ | Display name of the service |
| `userEmail` | string | ✅ | Customer email for receipt |
| `userName` | string | ✅ | Customer name for receipt |
| `onPaymentSuccess` | function | ✅ | Callback when payment succeeds |
| `onPaymentCancel` | function | ❌ | Callback when payment is cancelled |
| `currency` | string | ❌ | Payment currency (default: 'ETB') |

## Payment Flow

1. **Component Initialization**: Component fetches Chapa public key from backend
2. **User Clicks Pay**: Opens Chapa checkout modal
3. **User Completes Payment**: Chapa processes payment and returns result
4. **Backend Verification**: Frontend sends payment details to `/api/applications/{id}/verify-payment`
5. **Update Application**: Backend marks `fee_paid = true` and updates `payment_id`
6. **Send Notification**: Backend sends payment confirmation email
7. **Success Callback**: Frontend callback is executed

## Backend Endpoints

### Get Chapa Public Key
```
GET /api/payment/chapa-key
Response: { "public_key": "pk_test_..." }
```

### Verify Payment
```
POST /api/applications/{application_id}/verify-payment
Headers: 
  - Content-Type: application/json
  - Authorization: Bearer <token>
Body:
{
  "payment_id": "transaction_id",
  "reference": "reference_code",
  "status": "success"
}
Response:
{
  "success": true,
  "message": "Payment verified successfully",
  "application_id": "APP_123",
  "payment_id": "tx_123",
  "fee_paid": true
}
```

## Application Database Schema

After payment, the application record is updated:

```json
{
  "application_id": "APP_123",
  "fee_amount": 500,        // Service fee in ETB/INR
  "fee_paid": true,         // Payment status (false = unpaid, true = paid)
  "payment_id": "tx_123",   // Chapa transaction ID
  "updated_at": "2024-05-25T10:30:00"
}
```

## Notifications

When payment is received, the system sends:
- **Email**: Payment confirmation to customer
- **SMS**: Optional payment confirmation SMS
- **In-App**: Notification in user dashboard
- **Database**: Payment confirmation notification record

The notification message includes:
- Payment confirmation
- Amount received
- Application ID
- Application status (ready for processing)

## Troubleshooting

### Payment gateway not initializing
- Check `CHAPA_PUBLIC_KEY` is set in backend `.env`
- Verify Chapa script loads: Check browser console network tab
- Ensure Chapa account is active

### Payment verification fails
- Verify backend token is valid
- Check application ID exists
- Ensure user has permission to access application

### Chapa checkout doesn't open
- Check browser console for errors
- Verify public key is correct
- Check Chapa SDK loaded: `window.Chapa` should be defined

## Future Enhancements

- [ ] Offline payment entry (admin override)
- [ ] Partial payments support
- [ ] Payment reminders (automatic SMS/email)
- [ ] Refund processing
- [ ] Payment receipt download/print
- [ ] Payment history dashboard
- [ ] Multiple payment methods support

## Support

For issues with:
- **Chapa Integration**: Refer to [Chapa Docs](https://chapa.co)
- **Component Logic**: Check `frontend/src/components/Payment.jsx`
- **Backend Logic**: Check `backend/app/main.py` payment endpoints
