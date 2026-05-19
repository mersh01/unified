import React, { useState, useEffect } from 'react';
import { FileText, GraduationCap, Building, CreditCard, Truck, BarChart, Award } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import RatingField from './RatingField';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

function DynamicForm({ user }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialServiceId = searchParams.get('service_id');

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [hierarchyData, setHierarchyData] = useState({});

  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      localStorage.clear();
      window.location.href = '/';
      throw new Error('Session expired');
    }
    return response;
  };

  const loadHierarchyData = async (level, parentId = null) => {
    try {
      const url = parentId 
        ? `${API_URL}/api/hierarchy/${level}?parent_id=${parentId}`
        : `${API_URL}/api/hierarchy/${level}`;
      const response = await authFetch(url);
      const data = await response.json();
      return data.data || {};
    } catch (err) {
      console.error('Error loading hierarchy:', err);
      return {};
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (initialServiceId) {
      loadServiceForm(initialServiceId);
    } else {
      setSelectedService(null);
    }
  }, [initialServiceId]);

  const loadServices = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authFetch(`${API_URL}/api/frontend/services`);
      const data = await response.json();
      console.log('Services loaded:', data);
      setServices(data.services || []);
    } catch (err) {
      console.error('Error loading services:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadServiceForm = async (serviceId) => {
    try {
      const response = await authFetch(`${API_URL}/api/service/${serviceId}`);
      const config = await response.json();
      setSelectedService({ id: serviceId, config });
      
      const initialData = {};
      config.required_fields?.forEach(field => {
        initialData[field] = '';
      });
      config.optional_fields?.forEach(field => {
        initialData[field] = '';
      });
      setFormData(initialData);

      // Load initial hierarchy data for regions
      if (config.hierarchical_fields?.region) {
        const regions = await loadHierarchyData('regions');
        setHierarchyData(prev => ({ ...prev, regions }));
      }
    } catch (err) {
      console.error('Error loading form:', err);
      alert('Error loading form');
    }
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


  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const application = {
        service_type: selectedService.id,
        user_id: storedUser?.user_id || user?.user_id || `user_${Date.now()}`,
        user_name: formData.full_name || formData.student_name || storedUser?.name || 'Citizen',
        user_email: 'citizen@example.com',
        user_phone: storedUser?.phone_number || '',
        form_data: formData
      };
      
      const response = await authFetch(`${API_URL}/api/applications`, {
        method: 'POST',
        body: JSON.stringify(application)
      });
      
      const result = await response.json();
      alert(`✅ Application Submitted!\nApplication ID: ${result.application_id}`);
      setSelectedService(null);
    } catch (err) {
      console.error('Submit error:', err);
      alert('Error submitting application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="loading">Loading services...</div>;
  }

  if (error) {
    return (
      <div className="card" style={{ background: '#fee2e2', color: '#991b1b' }}>
        <h3>Error Loading Services</h3>
        <p>{error}</p>
        <button onClick={loadServices}>Retry</button>
      </div>
    );
  }

  // Show form if service selected
  if (selectedService) {
    const config = selectedService.config;
    return (
      <div className="card">
        <button onClick={() => setSelectedService(null)} style={{ marginBottom: '20px' }}>
          ← Back to Services
        </button>
        <h2>{config.name}</h2>
        <p className="text-muted">{config.description}</p>
        
        <div style={{ margin: '20px 0', display: 'flex', gap: '16px' }}>
          <span className="badge badge-blue">Fee: ₹{config.fee_amount}</span>
          <span className="badge badge-blue">Processing: {config.processing_time_days} days</span>
        </div>

        <form onSubmit={handleSubmit}>
          <h3>Required Information</h3>
          {config.required_fields?.map(field => {
            const hierarchicalConfig = config.hierarchical_fields?.[field];
            const label = config.field_labels?.[field] || field.replace('_', ' ').toUpperCase();
            
            if (hierarchicalConfig?.type === 'dropdown') {
              const options = hierarchyData[hierarchicalConfig.source] || {};
              const dependsOn = hierarchicalConfig.depends_on;
              const isDisabled = dependsOn && !formData[dependsOn];
              
              return (
                <div key={field} className="form-group">
                  <label>{label}</label>
                  <select
                    value={formData[field] || ''}
                    onChange={(e) => handleHierarchyChange(field, e.target.value, dependsOn)}
                    required
                    disabled={isDisabled}
                  >
                    <option value="">
                      {isDisabled ? `Select ${dependsOn.replace('_', ' ').toUpperCase()} first` : `Select ${label}`}
                    </option>
                    {Object.entries(options).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
              );
            }
            
            const fieldType = config.field_configs?.[field]?.type || (field.includes('date') ? 'date' : 'text');

            if (fieldType === 'rating' || field.includes('rating')) {
              return (
                <RatingField
                  key={field}
                  label={label}
                  value={formData[field] || 0}
                  onChange={(val) => handleChange(field, val)}
                  required
                />
              );
            }
            if (fieldType === 'textarea' || field.includes('feedback') || field.includes('textarea')) {
              return (
                <div key={field} className="form-group">
                  <label>{label}</label>
                  <textarea
                    value={formData[field] || ''}
                    onChange={(e) => handleChange(field, e.target.value)}
                    required
                    rows={4}
                  />
                </div>
              );
            }
            
            return (
              <div key={field} className="form-group">
                <label>{label}</label>
                <input
                  type={fieldType}
                  value={formData[field] || ''}
                  onChange={(e) => handleChange(field, e.target.value)}
                  required
                />
              </div>
            );
          })}

          {config.optional_fields?.length > 0 && (
            <>
              <h3 style={{ marginTop: '24px' }}>Optional Information</h3>
              {config.optional_fields.map(field => {
                const hierarchicalConfig = config.hierarchical_fields?.[field];
                const label = config.field_labels?.[field] || field.replace('_', ' ').toUpperCase();
                
                if (hierarchicalConfig?.type === 'dropdown') {
                  const options = hierarchyData[hierarchicalConfig.source] || {};
                  const dependsOn = hierarchicalConfig.depends_on;
                  const isDisabled = dependsOn && !formData[dependsOn];
                  
                  return (
                    <div key={field} className="form-group">
                      <label>{label}</label>
                      <select
                        value={formData[field] || ''}
                        onChange={(e) => handleHierarchyChange(field, e.target.value, dependsOn)}
                        disabled={isDisabled}
                      >
                        <option value="">
                          {isDisabled ? `Select ${dependsOn.replace('_', ' ').toUpperCase()} first` : `Select ${label}`}
                        </option>
                        {Object.entries(options).map(([id, name]) => (
                          <option key={id} value={id}>{name}</option>
                        ))}
                      </select>
                    </div>
                  );
                }
                
                const fieldType = config.field_configs?.[field]?.type || (field.includes('date') ? 'date' : 'text');

                if (fieldType === 'rating' || field.includes('rating')) {
                  return (
                    <RatingField
                      key={field}
                      label={label}
                      value={formData[field] || 0}
                      onChange={(val) => handleChange(field, val)}
                    />
                  );
                }
                if (fieldType === 'textarea' || field.includes('feedback') || field.includes('textarea')) {
                  return (
                    <div key={field} className="form-group">
                      <label>{label}</label>
                      <textarea
                        value={formData[field] || ''}
                        onChange={(e) => handleChange(field, e.target.value)}
                        rows={4}
                      />
                    </div>
                  );
                }
                
                return (
                  <div key={field} className="form-group">
                    <label>{label}</label>
                    <input
                      type={fieldType}
                      value={formData[field] || ''}
                      onChange={(e) => handleChange(field, e.target.value)}
                    />
                  </div>
                );
              })}
            </>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : `Submit ${config.name}`}
          </button>
        </form>
      </div>
    );
  }

  // Show service list
  return (
    <div>
      <div className="card">
        <h2>Apply for a Service</h2>
        <p>Select a service to begin your application:</p>
      </div>

      <div className="grid">
        {services.map(service => {
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
              className="card" 
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
          <p>No services available.</p>
        </div>
      )}
    </div>
  );
}

export default DynamicForm;