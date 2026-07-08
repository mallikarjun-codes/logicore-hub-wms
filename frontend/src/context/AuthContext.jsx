import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext(null);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely read the token from localStorage.
 * Guards against the case where the value was stored as a JSON-stringified
 * string (e.g. '"eyJ..."' with surrounding quote chars).
 */
function readToken() {
  let raw = localStorage.getItem('token');
  if (!raw) return null;
  // Strip accidental JSON wrapping quotes
  if (raw.startsWith('"') && raw.endsWith('"')) {
    raw = raw.slice(1, -1);
  }
  return raw;
}

/**
 * Safely write a token to localStorage as a plain string (never JSON.stringify).
 */
function writeToken(token) {
  localStorage.setItem('token', token);
}

// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => readToken());

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

    // Store token as a plain string — never JSON.stringify a token
    writeToken(jwt);
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

  /**
   * Authorized fetch wrapper.
   * Reads the token via the safe helper each time so stale in-memory state
   * never causes a silent header-miss.
   */
  const apiFetch = async (url, options = {}) => {
    const currentToken = token || readToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (currentToken) {
      // Single space between "Bearer" and the token — no extra chars
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
