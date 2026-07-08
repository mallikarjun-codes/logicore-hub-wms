import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => {
    return localStorage.getItem('token') || null;
  });

  const login = async (email, password) => {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Login failed.');
    }

    const { token: jwt, user: userProfile } = data.data;
    localStorage.setItem('token', jwt);
    localStorage.setItem('user', JSON.stringify(userProfile));
    setToken(jwt);
    setUser(userProfile);
    return userProfile;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  // Helper authorized request wrapper
  const apiFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const currentToken = token || localStorage.getItem('token');
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const targetUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
    
    try {
      const res = await fetch(targetUrl, {
        ...options,
        headers,
      });
      return res;
    } catch (err) {
      console.error('Network request failed:', err);
      throw new Error('Connection failed. The WareMind server appears offline.');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, apiFetch, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
