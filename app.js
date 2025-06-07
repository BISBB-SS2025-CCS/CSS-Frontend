const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

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
    const fetch = (await import('node-fetch')).default; // Dynamic import
    // Changed from /login to /api/login to match backend path
    const backendResponse = await fetch(`${BACKEND_API_URL}/api/login`, {
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
    const fetch = (await import('node-fetch')).default;
    const backendResponse = await fetch(`${BACKEND_API_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    
    // Log the full response for debugging
    console.log('Backend Response Status:', backendResponse.status);
    console.log('Backend Response Headers:', Object.fromEntries(backendResponse.headers.entries()));
    const responseText = await backendResponse.text();
    console.log('Backend Response Body:', responseText);

    // Try to parse as JSON if possible
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({ 
        error: 'Backend returned non-JSON response',
        response: responseText
      });
    }

    res.status(backendResponse.status).json(data);
  } catch (error) {
    console.error('Proxy register error:', error);
    res.status(500).json({ 
      error: 'Internal server error during registration proxy.',
      details: error.message 
    });
  }
});

// Middleware to check for JWT in cookie and attach to request for backend
const proxyAuthenticate = async (req, res, next) => {
  const token = req.cookies.jwtToken; // Get token from HttpOnly cookie

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token found.' });
  }
  // Attach token to request object so subsequent proxy routes can use it
  req.backendToken = token;
  next();
};

// Shared handler logic for fetching incidents
const handleGetIncidents = async (req, res) => {
  const { id } = req.params; // id will be undefined if called from the '/api/incidents' route
  const url = id ? `${BACKEND_API_URL}/api/incidents/${id}` : `${BACKEND_API_URL}/api/incidents`;
  try {
    const fetch = (await import('node-fetch')).default; // Dynamic import
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

    // Add error handling for non-JSON responses
    const contentType = backendResponse.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Backend returned non-JSON response');
      return res.status(500).json({ 
        error: 'Backend service unavailable or incorrect response format',
        details: await backendResponse.text()
      });
    }

    const data = await backendResponse.json();
    res.status(backendResponse.status).json(data);
  } catch (error) {
    console.error(`Proxy GET incidents error (path: ${req.path}):`, error);
    res.status(500).json({ error: 'Internal server error during incident fetch proxy.' });
  }
};

// Proxy for incident CRUD operations (protected by proxyAuthenticate)
// Route for getting all incidents
app.get('/api/incidents', proxyAuthenticate, handleGetIncidents);

// Route for getting a specific incident by ID
app.get('/api/incidents/:id', proxyAuthenticate, handleGetIncidents);

// app.get('/api/escalate/:id', proxyAuthenticate, handleEscalate);

app.post('/api/incidents', proxyAuthenticate, async (req, res) => {
  try {
    const fetch = (await import('node-fetch')).default; // Dynamic import
    const backendResponse = await fetch(`${BACKEND_API_URL}/api/incidents`, {
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
    const fetch = (await import('node-fetch')).default; // Dynamic import
    const backendResponse = await fetch(`${BACKEND_API_URL}/api/incidents/${id}`, {
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
    const fetch = (await import('node-fetch')).default; // Dynamic import
    const backendResponse = await fetch(`${BACKEND_API_URL}/api/incidents/${id}`, {
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

// Function to test backend connectivity
async function testBackendConnection() {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(BACKEND_API_URL); // Or a specific health check endpoint
    if (response.ok) {
      console.log(`Successfully connected to backend at ${BACKEND_API_URL}. Status: ${response.status}`);
    } else {
      console.error(`Failed to connect to backend at ${BACKEND_API_URL}. Status: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error connecting to backend at ${BACKEND_API_URL}:`, error.message);
  }
}

const handleEscalate = async (req, res) => {
  const { id } = req.params;
  try {
    const fetch = (await import('node-fetch')).default;
    const backendResponse = await fetch(`${BACKEND_API_URL}/api/escalate/${id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.backendToken}`,
        'Content-Type': 'application/json',
      }
    });

    if (backendResponse.status === 401 || backendResponse.status === 403) {
      res.clearCookie('jwtToken');
      return res.status(backendResponse.status).json({ error: 'Session expired or invalid token. Please log in again.' });
    }

    const data = await backendResponse.json();
    res.status(backendResponse.status).json(data);
  } catch (error) {
    console.error('Proxy escalate error:', error);
    res.status(500).json({ error: 'Internal server error during escalation proxy.' });
  }
};

app.post('/api/escalate/:id', proxyAuthenticate, handleEscalate);

app.listen(port, () => {
  console.log(`Frontend proxy server listening on port ${port}`);
  console.log('DEBUG ENV:', Object.entries(process.env));
  testBackendConnection(); // Call the test function when the server starts
});
