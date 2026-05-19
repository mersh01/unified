import React, { useState } from 'react';
import { Star } from 'lucide-react';

const RatingField = ({ value, onChange, label, required, disabled, error }) => {
  const [hover, setHover] = useState(0);

  return (
    <div className="form-group">
      <label>{label} {required && '*'}</label>
      <div style={{ display: 'flex', gap: '8px', cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: (hover || value) >= star ? '#ffc107' : '#e4e5e9',
              transition: 'color 0.2s',
            }}
          >
            <Star size={24} fill={(hover || value) >= star ? '#ffc107' : 'none'} />
          </button>
        ))}
      </div>
      {error && <span className="error-message">{error}</span>}
    </div>
  );
};

export default RatingField;
