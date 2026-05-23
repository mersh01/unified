import React from 'react'

export default function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`min-h-[140px] w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-govblue-500 focus:bg-white focus:ring-2 focus:ring-govblue-100 ${className}`}
      {...props}
    />
  )
}
