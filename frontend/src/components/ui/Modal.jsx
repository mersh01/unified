import React from 'react'

export default function Modal({ open, onClose, title, description, children, className = '' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true">
      <div className={`w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl ${className}`}>
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100">×</button>
        </div>
        <div className="space-y-6 px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
