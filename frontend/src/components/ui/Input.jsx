import React from 'react';

const Input = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyles = `
    block
    w-full
    rounded-lg
    border-2
    px-4
    py-2.5
    text-base
    transition-all
    duration-200
    ease-in-out
    focus:outline-none
    focus:ring-2
    focus:ring-offset-2
  `;

  const stateStyles = error
    ? `
      border-danger-300
      text-danger-900
      placeholder-danger-400
      focus:border-danger-500
      focus:ring-danger-500
    `
    : `
      border-gray-300
      text-gray-900
      placeholder-gray-500
      focus:border-primary-500
      focus:ring-primary-500
    `;

  const classes = `
    ${baseStyles}
    ${stateStyles}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `.replace(/\s+/g, ' ').trim();

  return (
    <div className={`${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-400">{leftIcon}</span>
          </div>
        )}
        <input
          className={`${classes} ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-400">{rightIcon}</span>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-danger-600 font-medium">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
};

export default Input;
