import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

function DynamicWidget({ widgetType, user, data }) {
  const [widgetConfig, setWidgetConfig] = useState(null);

  useEffect(() => {
    fetchWidgetConfig();
  }, [widgetType]);

  const fetchWidgetConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/api/frontend/config`);
      const config = await response.json();
      setWidgetConfig(config.widgets?.[widgetType]);
    } catch (error) {
      console.error('Error fetching widget config:', error);
    }
  };

  if (!widgetConfig) return null;

  // Render different widget types based on config
  switch (widgetConfig.type) {
    case 'stats_cards':
      return (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${widgetConfig.columns || 4}, 1fr)` }}>
          {widgetConfig.metrics.map(metric => (
            <div key={metric.key} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: widgetConfig.font_size || '32px', fontWeight: 'bold', color: widgetConfig.color || '#2563eb' }}>
                {data?.[metric.key] || 0}
              </div>
              <div style={{ color: '#6b7280' }}>{metric.label}</div>
            </div>
          ))}
        </div>
      );
    
    case 'table':
      return (
        <div className="card">
          <h3>{widgetConfig.title}</h3>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                {widgetConfig.columns.map(col => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).slice(0, widgetConfig.limit || 10).map((item, idx) => (
                <tr key={idx}>
                  {widgetConfig.columns.map(col => (
                    <td key={col.key}>{item[col.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    
    case 'chart':
      return (
        <div className="card">
          <h3>{widgetConfig.title}</h3>
          <div style={{ height: widgetConfig.height || '300px' }}>
            {/* Chart rendering logic here */}
            <p>Chart placeholder for {widgetConfig.chart_type}</p>
          </div>
        </div>
      );
    
    default:
      return null;
  }
}

export default DynamicWidget;