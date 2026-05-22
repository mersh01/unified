import React, { useState, useEffect } from 'react';
import DynamicWidget from '../components/DynamicWidget';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

function ConfigDrivenDashboard({ user }) {
  const [dashboardConfig, setDashboardConfig] = useState(null);
  const [dashboardData, setDashboardData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardConfig();
  }, [user]);

  const fetchDashboardConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/frontend/config`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const config = await response.json();
      
      // Get widgets for user type
      const userType = user?.type === 'admin' ? 'admin' : 'citizen';
      const widgets = config.dashboard_widgets[userType];
      setDashboardConfig(widgets);
      
      // Fetch data for each widget
      for (const widget of widgets) {
        const dataResponse = await fetch(`${API_URL}/api/dashboard/${widget}/data`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const data = await dataResponse.json();
        setDashboardData(prev => ({ ...prev, [widget]: data }));
      }
    } catch (error) {
      console.error('Error fetching dashboard config:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;

  return (
    <div>
      {dashboardConfig?.map(widget => (
        <DynamicWidget 
          key={widget} 
          widgetType={widget} 
          user={user}
          data={dashboardData[widget]}
        />
      ))}
    </div>
  );
}

export default ConfigDrivenDashboard;