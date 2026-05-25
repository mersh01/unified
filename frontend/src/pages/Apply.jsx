import React, { useState, useEffect } from 'react';
import { FileText, GraduationCap, Building, CreditCard, Truck, BarChart, Award } from 'lucide-react';
import Payment from '../components/Payment';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

function Apply({ user }) {  // Add user prop
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hierarchyData, setHierarchyData] = useState({});
  const [submittedApplication, setSubmittedApplication] = useState(null);

  // Helper function to make authenticated API calls
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
      window.location.reload();
      throw new Error('Session expired. Please login again.');
    }
    
    return response;
  };

  // Load hierarchy data for dropdowns
  const loadHierarchyData = async (level, parentId = null) => {
    try {
      const url = parentId 
        ? `${API_URL}/api/hierarchy/${level}?parent_id=${parentId}`
        : `${API_URL}/api/hierarchy/${level}`;
      const response = await authFetch(url);
      const data = await response.json();
      return data.data || {};
    } catch (error) {
      console.error('Error loading hierarchy:', error);
      return {};
    }
  };

  useEffect(() => {
    fetchAllServices();
    fetchCategories();
  }, []);

  const fetchAllServices = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/services/all`);
      const data = await response.json();
      console.log('All services:', data);
      setServices(data);
    } catch (error) {
      console.error('Error fetching services:', error);
      if (error.message.includes('Session expired')) {
        // Already handled
      } else {
        alert('Error loading services. Please make sure you are logged in.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/services/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const filterByCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    if (categoryId === 'all') {
      fetchAllServices();
    } else {
      authFetch(`${API_URL}/api/services/by-category/${categoryId}`)
        .then(res => res.json())
        .then(data => setServices(data))
        .catch(err => console.error('Error filtering:', err));
    }
  };

  const handleSearch = async (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    if (term.length > 2) {
      try {
        const response = await authFetch(`${API_URL}/api/services/search?q=${term}`);
        const data = await response.json();
        setServices(data);
      } catch (error) {
        console.error('Error searching:', error);
      }
    } else if (term.length === 0) {
      fetchAllServices();
    }
  };

  const loadServiceForm = async (serviceId) => {
    try {
      const response = await authFetch(`${API_URL}/api/service/${serviceId}`);
      const config = await response.json();
      
      // Get service level information
      const serviceLevelResponse = await authFetch(`${API_URL}/api/service/${serviceId}/level`);
      const serviceLevelData = serviceLevelResponse.ok ? await serviceLevelResponse.json() : { level: 'country' };
      
      setSelectedService({ id: serviceId, config, serviceLevel: serviceLevelData.level });
      
      // Initialize form data
      const initialData = {};
      config.required_fields.forEach(field => {
        initialData[field] = '';
      });
      if (config.optional_fields) {
        config.optional_fields.forEach(field => {
          initialData[field] = '';
        });
      }
      
      // Add location fields based on service level
      if (serviceLevelData.level !== 'country') {
        initialData.country = 'ETH'; // Default to Ethiopia
        
        if (['region', 'zone', 'woreda', 'kebele'].includes(serviceLevelData.level)) {
          initialData.region = '';
        }
        if (['zone', 'woreda', 'kebele'].includes(serviceLevelData.level)) {
          initialData.zone = '';
        }
        if (['woreda', 'kebele'].includes(serviceLevelData.level)) {
          initialData.woreda = '';
        }
        if (serviceLevelData.level === 'kebele') {
          initialData.kebele = '';
        }
      }
      
      setFormData(initialData);

      // Load initial hierarchy data for regions if needed
      if (config.hierarchical_fields?.region) {
        const regions = await loadHierarchyData('regions');
        setHierarchyData({ regions });
      }
    } catch (error) {
      console.error('Error loading service form:', error);
      alert('Error loading form. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Get user info from localStorage
      const storedUser = localStorage.getItem('user');
      const currentUser = storedUser ? JSON.parse(storedUser) : user;
      
      const application = {
        service_type: selectedService.id,
        user_id: currentUser?.user_id || currentUser?.username || `user_${Date.now()}`,
        user_name: formData.full_name || formData.student_name || currentUser?.name || 'Citizen',
        user_email: `${formData.full_name?.toLowerCase().replace(/\s/g, '.') || 'citizen'}@example.com`,
        user_phone: currentUser?.phone_number || formData.phone_number || '',
        form_data: formData
      };
      
      console.log('Submitting:', application);
      
      const response = await authFetch(`${API_URL}/api/applications`, {
        method: 'POST',
        body: JSON.stringify(application)
      });
      
      const result = await response.json();
      console.log('Response:', result);
      
      // Store submitted application for payment or completion display
      setSubmittedApplication(result);
      
      // Only reset form if no payment is needed
      if (result.fee_amount === 0) {
        alert(`✅ Application Submitted!\nApplication ID: ${result.application_id}\n\nPlease save this ID for tracking.`);
        setTimeout(() => {
          setSelectedService(null);
          setFormData({});
        }, 1500);
      }
      
    } catch (error) {
      console.error('Error submitting:', error);
      alert('Error submitting application. Check console for details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = async (paymentResult) => {
    // Payment successful - show confirmation
    alert(`✅ Application Submitted!\nApplication ID: ${submittedApplication.application_id}\n✅ Payment Received!\n\nYour application is being processed.`);
    
    // Reset after showing confirmation
    setTimeout(() => {
      setSelectedService(null);
      setFormData({});
      setSubmittedApplication(null);
    }, 2000);
  };

  const handlePaymentCancel = () => {
    // User cancelled payment but application is still saved
    console.log('Payment cancelled but application saved:', submittedApplication.application_id);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleHierarchyChange = async (field, value, dependsOn) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear dependent fields
    const config = selectedService?.config;
    if (config?.hierarchical_fields) {
      const dependentFields = Object.entries(config.hierarchical_fields)
        .filter(([_, fieldConfig]) => fieldConfig.depends_on === field)
        .map(([fieldName]) => fieldName);

      dependentFields.forEach(depField => {
        setFormData(prev => ({ ...prev, [depField]: '' }));
      });

      // Load data for dependent fields
      if (dependentFields.length > 0 && value) {
        const level = config.hierarchical_fields[dependentFields[0]]?.source;
        if (level) {
          const data = await loadHierarchyData(level, value.toUpperCase());
          setHierarchyData(prev => ({ ...prev, [level]: data }));
        }
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading services...</div>;
  }

  // Show form if service selected
  if (selectedService) {
    const config = selectedService.config;
    return (
      <div className="card">
        <button onClick={() => setSelectedService(null)} style={{ marginBottom: '20px' }}>
          ← Back to All Services
        </button>
        <h2>{config.name}</h2>
        <p className="text-muted">{config.description}</p>
        
        <div style={{ margin: '20px 0', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <span className="badge badge-blue">Fee: ₹{config.fee_amount}</span>
          <span className="badge badge-blue">Processing: {config.processing_time_days} days</span>
          {config.free_service && <span className="badge badge-green">Free Service</span>}
          {config.digital_delivery && <span className="badge badge-green">Digital Delivery</span>}
        </div>

        <form onSubmit={handleSubmit}>
          <h3>Required Information</h3>
          {config.required_fields.map(field => {
            const hierarchicalConfig = config.hierarchical_fields?.[field];
            const label = config.field_labels?.[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            if (hierarchicalConfig?.type === 'dropdown') {
              const options = hierarchyData[hierarchicalConfig.source] || {};
              const dependsOn = hierarchicalConfig.depends_on;
              const isDisabled = dependsOn && !formData[dependsOn];
              
              return (
                <div key={field} className="form-group">
                  <label>{label} *</label>
                  <select
                    value={formData[field] || ''}
                    onChange={(e) => handleHierarchyChange(field, e.target.value, dependsOn)}
                    required
                    disabled={isDisabled}
                  >
                    <option value="">
                      {isDisabled ? `Select ${dependsOn.replace(/_/g, ' ')} first` : `Select ${label.toLowerCase()}`}
                    </option>
                    {Object.entries(options).map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            } else {
              return (
                <div key={field} className="form-group">
                  <label>{label} *</label>
                  <input
                    type={field.includes('date') ? 'date' : 'text'}
                    value={formData[field] || ''}
                    onChange={(e) => handleChange(field, e.target.value)}
                    required
                  />
                </div>
              );
            }
          })}

          {config.optional_fields && config.optional_fields.length > 0 && (
            <>
              <h3 style={{ marginTop: '24px' }}>Optional Information</h3>
              {config.optional_fields.map(field => (
                <div key={field} className="form-group">
                  <label>{config.field_labels[field]}</label>
                  <input
                    type="text"
                    value={formData[field] || ''}
                    onChange={(e) => handleChange(field, e.target.value)}
                  />
                </div>
              ))}
            </>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : `Submit ${config.name} Application`}
          </button>
        </form>

        {/* Show payment component after successful submission if needed */}
        {submittedApplication && submittedApplication.fee_amount > 0 && !submittedApplication.fee_paid && (
          <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '2px solid var(--border-strong)' }}>
            <h3 style={{ color: 'var(--text-main)' }}>Next Step: Complete Payment</h3>
            <Payment
              applicationId={submittedApplication.application_id}
              feeAmount={submittedApplication.fee_amount}
              serviceName={config.name}
              userEmail={submittedApplication.user_email}
              userName={submittedApplication.user_name}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentCancel={handlePaymentCancel}
              currency="ETB"
            />
          </div>
        )}

        {/* Show success message if application submitted without payment needed */}
        {submittedApplication && submittedApplication.fee_amount === 0 && (
          <div style={{
            marginTop: '32px',
            padding: '20px',
            background: '#dcfce7',
            borderRadius: '12px',
            border: '1px solid #86efac',
            color: '#166534',
            textAlign: 'center'
          }}>
            <h3>✅ Application Submitted Successfully!</h3>
            <p>Application ID: <strong>{submittedApplication.application_id}</strong></p>
            <p>This service is free - your application is ready for processing.</p>
          </div>
        )}
      </div>
    );
  }

  // Show service list
  return (
    <div>
      <div className="card">
        <h2>Apply for a Service</h2>
        <div className="form-group">
          <input
            type="text"
            placeholder="🔍 Search services (e.g., passport, pan, license)..."
            value={searchTerm}
            onChange={handleSearch}
            style={{ width: '100%', padding: '12px', fontSize: '16px' }}
          />
        </div>
      </div>

      {categories.length > 0 && (
        <div className="card">
          <h3>Categories</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => filterByCategory(cat.id)}
                style={{
                  background: selectedCategory === cat.id ? '#2563eb' : '#e5e7eb',
                  color: selectedCategory === cat.id ? 'white' : '#374151',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid">
        {services.map(service => {
          // Get icon based on category
          const getIcon = (category) => {
            const icons = {
              'document_replacement': FileText,
              'educational': GraduationCap,
              'government_service': Building,
              'financial': CreditCard,
              'transport': Truck,
              'tax': BarChart,
              'certificate': Award
            };
            return icons[category] || FileText;
          };

          const Icon = getIcon(service.category);

          return (
            <div 
              key={service.service_id} 
              className="card service-card" 
              onClick={() => loadServiceForm(service.service_id)}
              style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                <Icon size={48} />
              </div>
              <h3>{service.name}</h3>
              <p className="text-muted" style={{ fontSize: '14px', margin: '8px 0' }}>
                {service.description}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span className="badge badge-blue">
                  {service.fee_amount === 0 ? 'Free' : `₹${service.fee_amount}`}
                </span>
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  {service.processing_time_days} days
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {services.length === 0 && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>No services found. Try a different search term.</p>
        </div>
      )}
    </div>
  );
}

export default Apply;