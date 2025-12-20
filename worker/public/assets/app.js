/**
 * todo.mdx Dashboard JavaScript
 * Minimal vanilla JS for auth and API calls
 */

// Auth state
let currentUser = null;
let authToken = null;

// Get token from localStorage
function getToken() {
  return localStorage.getItem('todomdx_token');
}

// Set token in localStorage
function setToken(token) {
  localStorage.setItem('todomdx_token', token);
  authToken = token;
}

// Clear token
function clearToken() {
  localStorage.removeItem('todomdx_token');
  authToken = null;
}

// Check if user is authenticated
async function checkAuth() {
  authToken = getToken();

  if (!authToken) {
    return null;
  }

  try {
    const response = await fetch('/api/repos', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      // Token is valid - we don't have a /me endpoint yet
      // so we'll just confirm the token works
      currentUser = { email: 'Authenticated' };
      return currentUser;
    } else {
      clearToken();
      return null;
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    return null;
  }
}

// Sign in - redirect to oauth.do
function signIn() {
  const clientId = 'todo-mdx';
  const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
  const scope = encodeURIComponent('repos:read repos:write');
  const state = crypto.randomUUID();

  // Store state for verification
  localStorage.setItem('oauth_state', state);

  // Redirect to oauth.do
  window.location.href = `https://oauth.do/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
}

// Sign out
function signOut() {
  clearToken();
  currentUser = null;
  window.location.href = '/';
}

// Make authenticated API call
async function api(path, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(path, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      window.location.href = '/dashboard.html';
    }
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Handle OAuth callback (if on callback page)
if (window.location.pathname === '/auth/callback') {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const storedState = localStorage.getItem('oauth_state');

  if (code && state === storedState) {
    // Exchange code for token
    fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.access_token) {
          setToken(data.access_token);
          localStorage.removeItem('oauth_state');
          window.location.href = '/dashboard.html';
        } else {
          console.error('Token exchange failed:', data);
          window.location.href = '/?error=auth_failed';
        }
      })
      .catch(error => {
        console.error('Token exchange error:', error);
        window.location.href = '/?error=auth_failed';
      });
  } else {
    console.error('Invalid state or missing code');
    window.location.href = '/?error=invalid_state';
  }
}

// For development: allow setting token via URL parameter
const urlParams = new URLSearchParams(window.location.search);
const tokenParam = urlParams.get('token');
if (tokenParam) {
  setToken(tokenParam);
  // Remove token from URL
  const url = new URL(window.location);
  url.searchParams.delete('token');
  window.history.replaceState({}, '', url);
}
