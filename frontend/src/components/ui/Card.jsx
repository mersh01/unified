import React from 'react';

const Card = ({
  children,
  title,
  subtitle,
  headerAction,
  footer,
  className = '',
  variant = 'default',
  ...props
}) => {
  const baseStyles = `
    bg-white
    rounded-xl
    shadow-sm
    border
    transition-all
    duration-200
  `;

  const variants = {
    default: 'border-gray-200',
    elevated: 'border-gray-200 shadow-md',
    outlined: 'border-2 border-gray-300 shadow-none',
    flat: 'border-none shadow-none',
  };

  const classes = `
    ${baseStyles}
    ${variants[variant]}
    ${className}
  `.replace(/\s+/g, ' ').trim();

  return (
    <div className={classes} {...props}>
      {(title || subtitle || headerAction) && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              )}
              {subtitle && (
                <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
              )}
            </div>
            {headerAction && <div>{headerAction}</div>}
          </div>
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
