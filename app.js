const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // For making HTTP requests from Node.js
const cookieParser = require('cookie-parser'); // For parsing and setting cookies

const app = express();
const port = process.env.PORT || 8080;

// Get backend API URL from environment variable
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

// Middleware
app.use(bodyParser.json()); // To parse JSON bodies from browser requests
app.use(cookieParser()); // To parse cookies from browser requests

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route serves the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Proxy API Routes ---

// Proxy for user login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const backendResponse = await fetch(`${BACKEND_API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await backendResponse.json();

    if (backendResponse.ok && data.token) {
      // Set JWT as an HttpOnly cookie
      res.cookie('jwtToken', data.token, {
        httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
        secure: process.env.NODE_ENV === 'production', // Use secure in production (HTTPS)
        maxAge: 3600000, // 1 hour (in milliseconds)
        sameSite: 'Lax', // Protects against CSRF attacks
      });
      res.status(200).json({ message: 'Login successful' });
    } else {
      res.status(backendResponse.status).json({ error: data.error || 'Login failed' });
    }
  } catch (error) {
    console.error('Proxy login error:', error);
    res.status(500).json({ error: 'Internal server error during login proxy.' });
  }
});

// Proxy for user registration
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const backendResponse = await fetch(`${BACKEND_API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await backendResponse.json();
    res.status(backendResponse.status).json(data);
  } catch (error) {
    console.error('Proxy register error:', error);
    res.status(500).json({ error: 'Internal server error during registration proxy.' });
  }
});

// Middleware to check for JWT in cookie and attach to request for backend
const proxyAuthenticate = (req, res, next) => {
  const token = req.cookies.jwtToken; // Get token from HttpOnly cookie

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token found.' });
  }
  // Attach token to request object so subsequent proxy routes can use it
  req.backendToken = token;
  next();
};

// Proxy for incident CRUD operations (protected by proxyAuthenticate)
app.get('/api/incidents/:id?', proxyAuthenticate, async (req, res) => {
  const { id } = req.params;
  const url = id ? `${BACKEND_API_URL}/incidents/${id}` : `${BACKEND_API_URL}/incidents`;
  try {
    const backendResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${req.backendToken}`, // Use token from cookie
        'Content-Type': 'application/json',
      },
    });

    if (backendResponse.status === 401 || backendResponse.status === 403) {
      // Clear cookie if backend rejects token
      res.clearCookie('jwtToken');
      return res.status(backendResponse.status).json({ error: 'Session expired or invalid token. Please log in again.' });
    }

    const data = await backendResponse.json();
    res.status(backendResponse.status).json(data);
  } catch (error) {
    console.error('Proxy GET incidents error:', error);
    res.status(500).json({ error: 'Internal server error during incident fetch proxy.' });
  }
});

app.post('/api/incidents', proxyAuthenticate, async (req, res) => {
  try {
    const backendResponse = await fetch(`${BACKEND_API_URL}/incidents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.backendToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (backendResponse.status === 401 || backendResponse.status === 403) {
      res.clearCookie('jwtToken');
      return res.status(backendResponse.status).json({ error: 'Session expired or invalid token. Please log in again.' });
    }

    const data = await backendResponse.json();
    res.status(backendResponse.status).json(data);
  } catch (error) {
    console.error('Proxy POST incident error:', error);
    res.status(500).json({ error: 'Internal server error during incident creation proxy.' });
  }
});

app.put('/api/incidents/:id', proxyAuthenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const backendResponse = await fetch(`${BACKEND_API_URL}/incidents/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${req.backendToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (backendResponse.status === 401 || backendResponse.status === 403) {
      res.clearCookie('jwtToken');
      return res.status(backendResponse.status).json({ error: 'Session expired or invalid token. Please log in again.' });
    }

    const data = await backendResponse.json();
    res.status(backendResponse.status).json(data);
  } catch (error) {
    console.error('Proxy PUT incident error:', error);
    res.status(500).json({ error: 'Internal server error during incident update proxy.' });
  }
});

app.delete('/api/incidents/:id', proxyAuthenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const backendResponse = await fetch(`${BACKEND_API_URL}/incidents/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${req.backendToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (backendResponse.status === 401 || backendResponse.status === 403) {
      res.clearCookie('jwtToken');
      return res.status(backendResponse.status).json({ error: 'Session expired or invalid token. Please log in again.' });
    }

    const data = await backendResponse.json();
    res.status(backendResponse.status).json(data);
  } catch (error) {
    console.error('Proxy DELETE incident error:', error);
    res.status(500).json({ error: 'Internal server error during incident deletion proxy.' });
  }
});

// Logout route: simply clear the cookie
app.post('/api/logout', (req, res) => {
  res.clearCookie('jwtToken');
  res.status(200).json({ message: 'Logged out successfully.' });
});


app.listen(port, () => {
  console.log(`Frontend proxy server listening on port ${port}`);
});
