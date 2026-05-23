import React from 'react'

export default function Select({ className = '', children, value, ...props }) {
  return (
    <select
      value={value || ''}
      className={`rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-govblue-500 focus:ring-2 focus:ring-govblue-100 cursor-pointer appearance-none ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}
