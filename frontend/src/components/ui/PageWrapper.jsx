import React from 'react'
import Card from './Card'

export default function PageWrapper({ title, subtitle, actions, children, className = '' }) {
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          {title && <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>}
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-600">{subtitle}</p>}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>

      <Card className="p-6">{children}</Card>
    </div>
  )
}
