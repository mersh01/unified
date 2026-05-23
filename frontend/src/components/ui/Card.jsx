import React from 'react'

export default function Card({ children, className = '', ...props }) {
  return (
    <div className={`rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100 transition-shadow duration-200 hover:shadow-md ${className}`} {...props}>
      {children}
    </div>
  )
}
