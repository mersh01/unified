import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FileText, GraduationCap, Building, CreditCard, Truck, BarChart, Award, ChevronLeft, ChevronRight, CheckCircle, Upload, Eye } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import RatingField from './RatingField';

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
            const fieldName = typeof field === 'string' ? field : field?.name;
            if (fieldName) {
              initialData[fieldName] = typeof field === 'object' && field?.default_value ? field.default_value : '';
            }
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

  const getAcceptString = (fieldConfig) => {
    if (!fieldConfig) return '*/*';
    if (fieldConfig.accept) return fieldConfig.accept;
    if (fieldConfig.accepted_formats?.length) {
      return fieldConfig.accepted_formats
        .map(format => (format.startsWith('.') ? format : `.${format}`))
        .join(',');
    }
    if (fieldConfig.type === 'image') return 'image/*';
    return '*/*';
  };

  const formatFilePreview = (file) => {
    if (!file) return null;
    const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
    const fileSize = file.size ? ` (${(file.size / 1024).toFixed(1)} KB)` : '';

    return (
      <div className="uploaded-file-preview" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
        {isImage ? (
          <img
            src={URL.createObjectURL(file)}
            alt={file.name}
            style={{ width: '100px', maxHeight: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #d1d5db' }}
          />
        ) : (
          <div style={{ width: '100px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#f3f4f6', color: '#4b5563', fontSize: '12px', border: '1px solid #d1d5db', padding: '8px', textAlign: 'center' }}>
            {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
          </div>
        )}
        <div style={{ fontSize: '13px', color: '#374151' }}>
          <div style={{ fontWeight: 600 }}>{file.name}</div>
          {fileSize && <div style={{ color: '#6b7280', marginTop: '4px' }}>{fileSize}</div>}
        </div>
      </div>
    );
  };

  const handleFileUpload = (field, files, allowMultiple = false) => {
    const fileList = files ? Array.from(files) : [];
    if (fileList.length === 0) {
      setUploadedFiles(prev => ({ ...prev, [field]: allowMultiple ? [] : null }));
      setFormData(prev => ({ ...prev, [field]: '' }));
      return;
    }

    const uploadedValue = allowMultiple ? fileList : fileList[0];
    setUploadedFiles(prev => ({ ...prev, [field]: uploadedValue }));
    setFormData(prev => ({
      ...prev,
      [field]: allowMultiple ? fileList.map(file => file.name) : fileList[0].name
    }));
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
    const acceptString = getAcceptString(fieldConfig);
    const allowMultiple = fieldConfig.multiple === true;
    const selectedFiles = uploadedFiles[actualFieldName];

    return (
      <div key={actualFieldName} className="form-group">
        <label>{label} {isRequired && '*'}</label>
        <input
          type="file"
          onChange={(e) => handleFileUpload(actualFieldName, e.target.files, allowMultiple)}
          required={isRequired}
          accept={acceptString}
          multiple={allowMultiple}
        />
        {selectedFiles && (
          <div className="file-preview" style={{ marginTop: '10px' }}>
            {Array.isArray(selectedFiles)
              ? selectedFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`}>{formatFilePreview(file)}</div>
                ))
              : formatFilePreview(selectedFiles)}
          </div>
        )}
        {fieldConfig.max_size_mb && (
          <small style={{ display: 'block', marginTop: '8px', color: '#6b7280' }}>
            Max file size: {fieldConfig.max_size_mb} MB
          </small>
        )}
        {hasError && <span className="error-message">{hasError}</span>}
      </div>
    );
  }

  if (fieldType === 'map' || fieldConfig.component === 'map' || fieldConfig.widget === 'map') {
    const mapValue = value || fieldConfig.default_value || '9.03,38.74';
    const coordMatch = mapValue.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    const defaultLat = 9.03;
    const defaultLng = 38.74;
    const lat = coordMatch ? parseFloat(coordMatch[1]) : defaultLat;
    const lng = coordMatch ? parseFloat(coordMatch[2]) : defaultLng;

    // Fix for default marker icon in Leaflet
    const customIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Component to handle map clicks
    function MapClickHandler({ onMapClick }) {
      useMapEvents({
        click: (e) => {
          onMapClick(e.latlng.lat, e.latlng.lng);
        }
      });
      return null;
    }

    const handleMapClick = (newLat, newLng) => {
      handleChange(actualFieldName, `${newLat.toFixed(6)},${newLng.toFixed(6)}`);
    };

    return (
      <div key={actualFieldName} className="form-group">
        <label>{label} {isRequired && '*'}</label>
        <p style={{ margin: '8px 0 12px', color: '#4b5563' }}>{fieldConfig.help_text || 'Click on the map to mark the location or enter coordinates manually.'}</p>
        
        <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #cbd5e1', marginBottom: '14px', minHeight: '300px' }}>
          <MapContainer
            center={[lat, lng]}
            zoom={13}
            style={{ width: '100%', height: '300px' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[lat, lng]} icon={customIcon} />
            <MapClickHandler onMapClick={handleMapClick} />
          </MapContainer>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text"
            value={mapValue}
            onChange={(e) => handleChange(actualFieldName, e.target.value)}
            placeholder={fieldConfig.placeholder || '9.03, 38.74'}
            required={isRequired}
            className={hasError ? 'error' : ''}
            style={{ width: '100%', borderRadius: '10px', border: '1px solid #d1d5db', padding: '12px' }}
          />
          <button
            type="button"
            onClick={() => handleChange(actualFieldName, '9.03,38.74')}
            style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', width: 'max-content' }}
          >
            Reset to Addis Ababa
          </button>
        </div>
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
    const config = selectedService?.config;
    const isMultiStep = config.multi_step;
    const steps = config.steps || [];
    const currentStepData = isMultiStep ? steps[currentStep] : null;

    return (
      <div className="card">
        <button onClick={() => setSelectedService(null)} style={{ marginBottom: '20px' }}>
          ← Back to Services
        </button>

        <h2>{config.name}</h2>
        <p className="text-muted">{config.description}</p>

        {isMultiStep && (
          <div className="step-indicator">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`step ${index === currentStep ? 'active' : index < currentStep ? 'completed' : 'pending'}`}
              >
                <div className="step-number">{index + 1}</div>
                <div className="step-title">{step.title}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ margin: '20px 0', display: 'flex', gap: '16px' }}>
          <span className="badge badge-blue">Fee: ₹{config.fee_amount}</span>
          <span className="badge badge-blue">Processing: {config.processing_time_days} days</span>
        </div>

        <form onSubmit={handleSubmit}>
          {isMultiStep ? (
            <div className="step-content">
              <h3>{currentStepData.title}</h3>
              <p className="text-muted">{currentStepData.description}</p>

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

          <div className="form-actions">
            {isMultiStep && currentStep > 0 && (
              <button type="button" onClick={prevStep} className="btn-secondary">
                <ChevronLeft size={16} /> Previous
              </button>
            )}

            {isMultiStep && currentStep < steps.length - 1 && (
              <button key="btn-next" type="button" onClick={nextStep} className="btn-primary">
                Next <ChevronRight size={16} />
              </button>
            )}

            {(!isMultiStep || currentStep >= steps.length - 1) && (
             <button key="btn-submit" type="submit" disabled={submitting} className="btn-primary">
               {submitting ? 'Submitting...' : 'Submit Complaint'}
             </button>
            )}
          </div>
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

export default MultiStepForm;