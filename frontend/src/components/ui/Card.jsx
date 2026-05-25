import React from 'react'

export default function Card({ children, className = '', ...props }) {
  return (
    <div className={`rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100 transition-shadow duration-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950 dark:hover:shadow-slate-800 dark:text-slate-100 ${className}`} {...props}>
      {children}
    </div>
  )
}
