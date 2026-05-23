import React, { useState, useEffect } from 'react';
import { FileText, GraduationCap, Building, CreditCard, Truck, BarChart, Award, ChevronLeft, ChevronRight, CheckCircle, Upload, Eye } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import RatingField from './RatingField';
import { Button, Input, Card, Badge } from './ui';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

function MultiStepForm({ user }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialServiceId = searchParams.get('service_id');

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [hierarchyData, setHierarchyData] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [stepValidation, setStepValidation] = useState({});

  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = { ...options.headers };
    
    // Only set application/json if body is not FormData
    if (!options.body || !(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    
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
      setCurrentStep(0);

      // Initialize form data
      const initialData = {};
      if (config.multi_step && config.steps) {
        config.steps.forEach(step => {
          step.fields?.forEach(field => {
            initialData[field] = '';
          });
        });
      } else {
        // Fallback for non-multi-step forms
        config.required_fields?.forEach(field => {
          initialData[field] = '';
        });
        config.optional_fields?.forEach(field => {
          initialData[field] = '';
        });
      }

      // Initialize conditional fields
      if (config.conditional_fields) {
        Object.keys(config.conditional_fields).forEach(field => {
          initialData[field] = '';
        });
      }

      setFormData(initialData);

      // Load initial hierarchy data
      if (config.hierarchical_fields?.region) {
        const regions = await loadHierarchyData('regions');
        setHierarchyData(prev => ({ ...prev, regions }));
      }
    } catch (err) {
      console.error('Error loading form:', err);
      alert('Error loading form');
    }
  };

  const evaluateCondition = (condition, formData) => {
    if (!condition) return true;

    try {
      // Simple condition evaluation (can be extended for more complex logic)
      const [field, operator, value] = condition.split(' ');
      const fieldValue = formData[field] || '';

      switch (operator) {
        case '==':
          return fieldValue === value.replace(/'/g, '');
        case '!=':
          return fieldValue !== value.replace(/'/g, '');
        case 'contains':
          return fieldValue.toLowerCase().includes(value.toLowerCase().replace(/'/g, ''));
        default:
          return true;
      }
    } catch (err) {
      console.error('Error evaluating condition:', err);
      return true;
    }
  };

  const getVisibleFields = (step) => {
    const config = selectedService?.config;
    if (!config || !step.fields) return step.fields || [];

let visibleFields = (step.fields || []).map(f => typeof f === 'string' ? f : f.name);
    // Apply conditional logic
    step.conditional_logic?.forEach(logic => {
      if (evaluateCondition(logic.condition, formData)) {
        if (logic.show_fields) {
          visibleFields = [...visibleFields, ...logic.show_fields];
        }
        if (logic.hide_fields) {
          visibleFields = visibleFields.filter(field => !logic.hide_fields.includes(field));
        }
      }
    });

    return [...new Set(visibleFields)]; // Remove duplicates
  };

  const validateStep = (stepIndex) => {
    const config = selectedService?.config;
    if (!config.multi_step) return true;

    const step = config.steps[stepIndex];
    const visibleFields = getVisibleFields(step);
    
    let requiredFields = [...(step.required_fields || [])];
    if (step.fields) {
      step.fields.forEach(f => {
        const isRequired = typeof f === 'object' ? f.required : false;
        const name = typeof f === 'object' ? f.name : f;
        if (isRequired && !requiredFields.includes(name)) {
          requiredFields.push(name);
        }
      });
    }

    const errors = {};

    requiredFields.forEach(field => {
      if (visibleFields.includes(field)) {
        const fieldConfig = getFieldConfig(field, step);
        const isFile = fieldConfig && fieldConfig.type === 'file';
        if (isFile) {
          if (!uploadedFiles[field]) {
            errors[field] = 'This file is required';
          }
        } else if (formData[field] === undefined || formData[field] === '') {
          errors[field] = 'This field is required';
        }
      }
    });

    // Additional validations
    visibleFields.forEach(field => {
      const validation = config.validations?.[field];
      if (validation && formData[field]) {
        const value = formData[field];

        if (validation.type === 'string') {
          if (validation.min_length && value.length < validation.min_length) {
            errors[field] = `Minimum ${validation.min_length} characters required`;
          }
          if (validation.max_length && value.length > validation.max_length) {
            errors[field] = `Maximum ${validation.max_length} characters allowed`;
          }
          if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
            errors[field] = 'Invalid format';
          }
        }

        if (validation.type === 'date') {
          const date = new Date(value);
          const now = new Date();

          if (validation.max_future_days !== undefined) {
            const maxFuture = new Date();
            maxFuture.setDate(now.getDate() + validation.max_future_days);
            if (date > maxFuture) {
              errors[field] = 'Date cannot be in the future';
            }
          }

          if (validation.min_years_ago) {
            const minDate = new Date();
            minDate.setFullYear(now.getFullYear() - validation.min_years_ago);
            if (date < minDate) {
              errors[field] = `Date cannot be more than ${validation.min_years_ago} years ago`;
            }
          }
        }
      }
    });

    setStepValidation(prev => ({ ...prev, [stepIndex]: errors }));
    return Object.keys(errors).length === 0;
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

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (field, file) => {
    setUploadedFiles(prev => ({ ...prev, [field]: file }));
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const config = selectedService?.config;
    if (config.multi_step && currentStep < config.steps.length - 1) {
      nextStep();
      return;
    }

    // Validate all steps
    if (config.multi_step) {
      for (let i = 0; i < config.steps.length; i++) {
        if (!validateStep(i)) {
          setCurrentStep(i);
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      const formDataObj = new FormData();
      formDataObj.append('service_type', selectedService.id);
      formDataObj.append('user_id', storedUser?.user_id || user?.user_id || `user_${Date.now()}`);
      formDataObj.append('user_name', formData.full_name || formData.student_name || storedUser?.name || 'Citizen');
      formDataObj.append('user_email', 'citizen@example.com');
      formDataObj.append('user_phone', storedUser?.phone_number || '');
      formDataObj.append('form_data', JSON.stringify(formData));
      if (config.multi_step) {
        formDataObj.append('multi_step_data', JSON.stringify({
          steps_completed: config.steps.length,
          current_step: currentStep
        }));
      }
      
      // Append uploaded files
      Object.entries(uploadedFiles).forEach(([fieldName, files]) => {
        if (Array.isArray(files)) {
          files.forEach(file => {
            formDataObj.append('uploaded_files', file, `${fieldName}___${file.name}`);
          });
        } else {
          formDataObj.append('uploaded_files', files, `${fieldName}___${files.name}`);
        }
      });

      const response = await authFetch(`${API_URL}/api/applications`, {
        method: 'POST',
        body: formDataObj
      });

      const result = await response.json();
      alert(`✅ Application Submitted!\nApplication ID: ${result.application_id}`);
      setSelectedService(null);
      setCurrentStep(0);
      setFormData({});
      setUploadedFiles({});
    } catch (err) {
      console.error('Submit error:', err);
      alert('Error submitting application');
    } finally {
      setSubmitting(false);
    }
  };

const renderField = (field, step) => {
  const config = selectedService?.config;
  
  // Safely get the field name
  let actualFieldName = '';
  if (typeof field === 'string') {
    actualFieldName = field;
  } else if (field && typeof field.name === 'string') {
    actualFieldName = field.name;
  }
  
  const fieldConfig = getFieldConfig(actualFieldName, step) || {};
  
  let label = 'Unknown Field';
  if (fieldConfig.label) {
    label = fieldConfig.label;
  } else if (config?.field_labels?.[actualFieldName]) {
    label = config.field_labels[actualFieldName];
  } else if (actualFieldName) {
    label = actualFieldName.replace(/_/g, ' ').toUpperCase();
  }

  const hierarchicalConfig = config?.hierarchical_fields?.[actualFieldName];
  const fieldType = fieldConfig.type || (actualFieldName.includes('date') ? 'date' : 'text');
  const errors = stepValidation[currentStep] || {};
  const hasError = errors[actualFieldName];
  const value = formData[actualFieldName] || '';
  const isRequired = step.required_fields?.includes(actualFieldName) || fieldConfig.required === true;

  if (hierarchicalConfig?.type === 'dropdown' || fieldType === 'hierarchical_dropdown') {
    const hConfig = hierarchicalConfig || fieldConfig;
    const options = hierarchyData[hConfig.source] || {};
    const dependsOn = hConfig.depends_on;
    const isDisabled = dependsOn && !formData[dependsOn];

    return (
      <div key={actualFieldName} className="form-group">
        <label>{label} {isRequired && '*'}</label>
        <select
          value={value}
          onChange={(e) => handleHierarchyChange(actualFieldName, e.target.value, dependsOn)}
          required={isRequired}
          disabled={isDisabled}
          className={hasError ? 'error' : ''}
        >
          <option value="">
            {isDisabled ? `Select ${typeof dependsOn === 'string' ? dependsOn.replace('_', ' ').toUpperCase() : 'Parent'} first` : `Select ${label}`}
          </option>
          {Object.entries(options).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        {hasError && <span className="error-message">{hasError}</span>}
      </div>
    );
  }

  if (fieldType === 'select') {
    // Handle dependent selects (e.g. complaint_subtype depends on complaint_type)
    const dependsOn = fieldConfig.conditional_on;
    let options = [];
    let isDisabled = false;

    if (dependsOn) {
      const parentValue = formData[dependsOn];
      isDisabled = !parentValue;
      if (!isDisabled && fieldConfig.conditional_options && fieldConfig.conditional_options[parentValue]) {
        options = fieldConfig.conditional_options[parentValue];
      }
    } else {
      options = fieldConfig.options || [];
    }

    return (
      <div key={actualFieldName} className="form-group">
        <label>{label} {isRequired && '*'}</label>
        <select
          value={value}
          onChange={(e) => handleChange(actualFieldName, e.target.value)}
          required={isRequired}
          disabled={isDisabled}
          className={hasError ? 'error' : ''}
        >
          <option value="">
            {isDisabled ? `Select ${typeof dependsOn === 'string' ? dependsOn.replace('_', ' ').toUpperCase() : 'Parent'} first` : `Select ${label}`}
          </option>
          {options.map((opt) => {
            const optVal = typeof opt === 'object' ? opt.value : opt;
            const optLabel = typeof opt === 'object' ? opt.label : opt.replace(/_/g, ' ').toUpperCase();
            return <option key={optVal} value={optVal}>{optLabel}</option>;
          })}
        </select>
        {hasError && <span className="error-message">{hasError}</span>}
      </div>
    );
  }

  if (fieldType === 'file') {
    return (
      <div key={actualFieldName} className="form-group">
        <label>{label} {isRequired && '*'}</label>
        <input
          type="file"
          onChange={(e) => handleFileUpload(actualFieldName, e.target.files[0])}
          required={isRequired}
          accept={fieldConfig.accept || '*'}
        />
        {uploadedFiles[actualFieldName] && (
          <div className="file-info">
            <small>Selected: {uploadedFiles[actualFieldName].name}</small>
          </div>
        )}
        {hasError && <span className="error-message">{hasError}</span>}
      </div>
    );
  }

  if (fieldType === 'rating') {
    return (
      <RatingField
        key={actualFieldName}
        label={label}
        value={value}
        onChange={(val) => handleChange(actualFieldName, val)}
        required={isRequired}
        error={hasError}
      />
    );
  }

  if (fieldType === 'textarea') {
    return (
      <div key={actualFieldName} className="form-group">
        <label>{label} {isRequired && '*'}</label>
        <textarea
          value={value}
          onChange={(e) => handleChange(actualFieldName, e.target.value)}
          required={isRequired}
          className={hasError ? 'error' : ''}
          rows={4}
        />
        {hasError && <span className="error-message">{hasError}</span>}
      </div>
    );
  }

  return (
    <div key={actualFieldName} className="form-group">
      <label>{label} {isRequired && '*'}</label>
      <input
        type={fieldType}
        value={value}
        onChange={(e) => handleChange(actualFieldName, e.target.value)}
        required={isRequired}
        className={hasError ? 'error' : ''}
      />
      {hasError && <span className="error-message">{hasError}</span>}
    </div>
  );
};
// Add this function before renderField
const getFieldConfig = (fieldName, step) => {
  const config = selectedService?.config;
  
  // Check if field is defined as object in step fields
  for (const field of (step.fields || [])) {
    if (typeof field === 'object' && field.name === fieldName) {
      return field;
    }
  }
  
  // Check conditional_fields
  if (config?.conditional_fields?.[fieldName]) {
    return config.conditional_fields[fieldName];
  }
  
  // Check field_configs in step
  if (step.field_configs?.[fieldName]) {
    return step.field_configs[fieldName];
  }
  
  // Return empty object as fallback
  return {};
};
  const renderVerificationStep = (step) => {
    const config = selectedService?.config;

    return (
      <div className="verification-step">
        {step.verification_steps?.map((verification, index) => (
          <div key={index} className="verification-section">
            <h4>{verification.title}</h4>
            <p className="text-muted">{verification.description}</p>

            {verification.type === 'document_upload' && (
              <div className="document-upload">
                <h5>Required Documents:</h5>
                <ul>
                  {verification.required_documents?.map(doc => {
                    const docStr = typeof doc === 'string' ? doc : (doc.name || 'document');
                    return (
                    <li key={docStr}>
                      {docStr.replace('_', ' ').toUpperCase()}
                      {uploadedFiles[docStr] ? (
                        <CheckCircle size={16} color="green" style={{ marginLeft: '8px' }} />
                      ) : (
                        <span style={{ color: 'red', marginLeft: '8px' }}>Not uploaded</span>
                      )}
                    </li>
                  )})}
                </ul>

                {verification.conditional_documents?.map(cond => {
                  if (evaluateCondition(cond.condition, formData)) {
                    return (
                      <div key={cond.condition}>
                        <h5>Additional Documents Required:</h5>
                        <ul>
                          {cond.documents?.map(doc => {
                            const docStr = typeof doc === 'string' ? doc : (doc.name || 'document');
                            return (
                            <li key={docStr}>
                              {docStr.replace('_', ' ').toUpperCase()}
                              {uploadedFiles[docStr] ? (
                                <CheckCircle size={16} color="green" style={{ marginLeft: '8px' }} />
                              ) : (
                                <span style={{ color: 'red', marginLeft: '8px' }}>Not uploaded</span>
                              )}
                            </li>
                          )})}
                        </ul>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}

            {verification.type === 'review' && (
              <div className="review-section">
                <h5>Application Summary:</h5>
                <div className="review-data">
                  {Object.entries(formData).map(([key, value]) => {
                    if (value && key !== 'password' && key !== 'confirm_password') {
                      const label = config.field_labels?.[key] || (typeof key === 'string' ? key.replace(/_/g, ' ').toUpperCase() : key);
                      return (
                        <div key={key} className="review-item">
                          <strong>{label}:</strong> {typeof value === 'object' ? JSON.stringify(value) : value}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
        {step.fields && (
          <div className="fields-grid" style={{ marginTop: '24px' }}>
            {getVisibleFields(step).map(field => renderField(field, step))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading services...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card variant="outlined" className="bg-danger-50 border-danger-200">
        <h3 className="text-lg font-semibold text-danger-900">Error Loading Services</h3>
        <p className="text-danger-700">{error}</p>
        <Button onClick={loadServices} variant="danger" className="mt-4">Retry</Button>
      </Card>
    );
  }

  // Show form if service selected
  if (selectedService) {
    const config = selectedService?.config;
    const isMultiStep = config.multi_step;
    const steps = config.steps || [];
    const currentStepData = isMultiStep ? steps[currentStep] : null;

    return (
      <Card>
        <button 
          onClick={() => setSelectedService(null)} 
          className="mb-6 text-primary-600 hover:text-primary-700 font-medium flex items-center gap-2"
        >
          <ChevronLeft size={16} />
          Back to Services
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">{config.name}</h2>
        <p className="text-gray-600 mb-6">{config.description}</p>

        {isMultiStep && (
          <div className="flex items-center justify-between mb-8 p-4 bg-gray-50 rounded-xl">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center ${index !== steps.length - 1 ? 'flex-1' : ''}`}
              >
                <div className="flex items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold
                    ${index === currentStep ? 'bg-primary-600 text-white' : index < currentStep ? 'bg-success-600 text-white' : 'bg-gray-300 text-gray-600'}
                  `}>
                    {index < currentStep ? <CheckCircle size={20} /> : index + 1}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${index === currentStep ? 'text-primary-700' : 'text-gray-600'}`}>
                      {step.title}
                    </p>
                  </div>
                </div>
                {index !== steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${index < currentStep ? 'bg-success-600' : 'bg-gray-300'}`}></div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6">
          <Badge variant="primary">Fee: ₹{config.fee_amount}</Badge>
          <Badge variant="info">Processing: {config.processing_time_days} days</Badge>
        </div>

        <form onSubmit={handleSubmit}>
          {isMultiStep ? (
            <div className="step-content">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{currentStepData.title}</h3>
              <p className="text-gray-600 mb-6">{currentStepData.description}</p>

              {currentStepData.type === 'verification' ? (
                renderVerificationStep(currentStepData)
              ) : (
                <div className="fields-grid">
                  {getVisibleFields(currentStepData).map(field => renderField(field, currentStepData))}
                </div>
              )}
            </div>
          ) : (
            // Fallback for non-multi-step forms
            <>
              <h3>Required Information</h3>
              {config.required_fields?.map(field => renderField(field, { required_fields: config.required_fields }))}
              {config.optional_fields?.length > 0 && (
                <>
                  <h3 style={{ marginTop: '24px' }}>Optional Information</h3>
                  {config.optional_fields.map(field => renderField(field, { required_fields: [] }))}
                </>
              )}
            </>
          )}

          <div className="form-actions flex gap-3 mt-8">
            {isMultiStep && currentStep > 0 && (
              <Button type="button" onClick={prevStep} variant="secondary" leftIcon={<ChevronLeft size={16} />}>
                Previous
              </Button>
            )}

            {isMultiStep && currentStep < steps.length - 1 && (
              <Button key="btn-next" type="button" onClick={nextStep} variant="primary" rightIcon={<ChevronRight size={16} />}>
                Next
              </Button>
            )}

            {(!isMultiStep || currentStep >= steps.length - 1) && (
             <Button key="btn-submit" type="submit" disabled={submitting} variant="primary" loading={submitting}>
               {submitting ? 'Submitting...' : 'Submit Complaint'}
             </Button>
            )}
          </div>
        </form>
      </Card>
    );
  }

  // Show service list
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Apply for a Service</h2>
        <p className="text-gray-600">Select a service to begin your application:</p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            <Card
              key={service.service_id}
              onClick={() => loadServiceForm(service.service_id)}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
              variant="elevated"
            >
              <div className="text-primary-600 mb-4">
                <Icon size={48} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{service.name}</h3>
              <p className="text-gray-600 text-sm mb-4">
                {service.description}
              </p>
              <div className="flex justify-between items-center mt-4">
                <Badge variant="primary">
                  {service.fee_amount === 0 ? 'Free' : `₹${service.fee_amount}`}
                </Badge>
                <span className="text-gray-500 text-sm">
                  {service.processing_time_days} days
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {services.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-gray-500">No services available.</p>
        </Card>
      )}
    </div>
  );
}

export default MultiStepForm;