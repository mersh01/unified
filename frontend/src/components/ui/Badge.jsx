import React from 'react'

const variants = {
  primary: 'bg-govblue-600 text-white',
  info: 'bg-sky-100 text-sky-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-rose-100 text-rose-700',
  muted: 'bg-slate-100 text-slate-700',
}

export default function Badge({ children, variant = 'muted', className = '', ...props }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${variants[variant] || variants.muted} ${className}`} {...props}>
      {children}
    </span>
  )
}
