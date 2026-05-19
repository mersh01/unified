import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_URL = 'http://localhost:8000';

function DynamicNavigation({ user }) {
  const [navigation, setNavigation] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNavigation();
  }, [user]);

  const fetchNavigation = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/frontend/config`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const config = await response.json();
      
      // Determine which navigation to show based on user role
      let navItems = [];
      const isAdmin = user?.type === 'admin';
      
      if (isAdmin) {
        const role = user?.role;
        navItems = config.navigation.admin[role] || config.navigation.admin.verification_officer;
      } else {
        navItems = config.navigation.citizen;
      }
      
      setNavigation(navItems);
    } catch (error) {
      console.error('Error fetching navigation:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="nav">
      {navigation.map(item => (
        <Link key={item.path} to={item.path}>
          {item.icon} {item.label}
        </Link>
      ))}
    </div>
  );
}

export default DynamicNavigation;