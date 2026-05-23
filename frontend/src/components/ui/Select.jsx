import React from 'react'

export default function Select({ className = '', children, value, ...props }) {
  return (
    <select
      value={value || ''}
      className={`min-w-[160px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-govblue-500 focus:ring-2 focus:ring-govblue-100 cursor-pointer appearance-none ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}
