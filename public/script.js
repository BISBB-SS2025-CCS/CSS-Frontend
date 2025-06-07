// DOM Elements
const loginForm = document.getElementById('login-form');
const registerButton = document.getElementById('register-button');
const loginMessage = document.getElementById('login-message');
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const logoutButton = document.getElementById('logout-button');
const createIncidentForm = document.getElementById('create-incident-form');
const createMessage = document.getElementById('create-message');
const incidentsList = document.getElementById('incidents-list');
const editModal = document.getElementById('edit-modal');
const confirmModal = document.getElementById('confirm-modal');
const editForm = document.getElementById('edit-incident-form');
const editMessage = document.getElementById('edit-message');
const loadingMessage = document.getElementById('loading-message');

// Event Listeners
loginForm.addEventListener('submit', handleLogin);
registerButton.addEventListener('click', handleRegister);
logoutButton.addEventListener('click', handleLogout);
createIncidentForm.addEventListener('submit', handleCreateIncident);
editForm.addEventListener('submit', handleEditIncident);
document.getElementById('cancel-edit').addEventListener('click', () => editModal.classList.add('hidden'));
document.getElementById('confirm-cancel').addEventListener('click', () => confirmModal.classList.add('hidden'));
document.getElementById('confirm-delete').addEventListener('click', handleConfirmDelete);

let currentIncidentId = null;

// Check if user is already logged in
checkAuthStatus();

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/incidents');
        if (response.ok) {
            showApp();
            fetchIncidents();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (response.ok) {
            showApp();
            fetchIncidents();
            loginMessage.textContent = '';
        } else {
            loginMessage.textContent = data.error || 'Login failed';
        }
    } catch (error) {
        loginMessage.textContent = 'Login failed. Please try again.';
    }
}

async function handleRegister() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        loginMessage.textContent = 'Please enter both username and password';
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        loginMessage.textContent = data.message || data.error;
        
        if (response.ok) {
            // Auto-login after successful registration
            handleLogin(new Event('submit'));
        }
    } catch (error) {
        loginMessage.textContent = 'Registration failed. Please try again.';
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        showAuth();
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

function showAuth() {
    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    loginForm.reset();
}

function showApp() {
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
}

async function fetchIncidents() {
    try {
        const response = await fetch('/api/incidents');
        if (response.status === 401) {
            showAuth();
            return;
        }
        const incidents = await response.json();
        displayIncidents(incidents);
    } catch (error) {
        loadingMessage.textContent = 'Failed to load incidents';
    }
}

function displayIncidents(incidents) {
    incidentsList.innerHTML = '';
    
    if (!incidents.length) {
        incidentsList.innerHTML = '<p class="text-center text-gray-500">No incidents found</p>';
        return;
    }

    incidents.forEach(incident => {
        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-lg shadow-lg';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <h3 class="text-xl font-semibold text-indigo-600">${incident.title}</h3>
                <div class="space-x-2">
                    <button onclick="showEditModal('${incident.id}')" class="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Edit</button>
                    <button onclick="showDeleteConfirm('${incident.id}')" class="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">Delete</button>
                    <button onclick="handleEscalate('${incident.id}')" class="px-3 py-1 text-sm font-medium text-white bg-yellow-500 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400">Escalate</button>
                </div>
            </div>
            <p class="text-gray-600 mt-2">${incident.description || 'No description'}</p>
            <div class="mt-4 text-sm text-gray-500">
                <p>ID: ${incident.id}</p>
                <p>Reporter: ${incident.reporter || 'Unknown'}</p>
                <p>Type: ${incident.type || 'Unspecified'}</p>
                <p>Resource ID: ${incident.resource_id || 'N/A'}</p>
            </div>
        `;
        incidentsList.appendChild(card);
    });
}

async function handleCreateIncident(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const incidentData = Object.fromEntries(formData);

    try {
        const response = await fetch('/api/incidents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(incidentData)
        });

        if (response.status === 401) {
            showAuth();
            return;
        }

        const data = await response.json();
        if (response.ok) {
            event.target.reset();
            createMessage.textContent = 'Incident created successfully';
            createMessage.className = 'text-center text-green-500 text-sm mt-2';
            fetchIncidents();
        } else {
            createMessage.textContent = data.error || 'Failed to create incident';
            createMessage.className = 'text-center text-red-500 text-sm mt-2';
        }
    } catch (error) {
        createMessage.textContent = 'Failed to create incident';
        createMessage.className = 'text-center text-red-500 text-sm mt-2';
    }
}

async function showEditModal(id) {
    try {
        const response = await fetch(`/api/incidents/${id}`);
        if (response.status === 401) {
            showAuth();
            return;
        }
        const incident = await response.json();
        
        document.getElementById('edit-id').value = incident.id;
        document.getElementById('edit-title').value = incident.title || '';
        document.getElementById('edit-reporter').value = incident.reporter || '';
        document.getElementById('edit-type').value = incident.type || '';
        document.getElementById('edit-description').value = incident.description || '';
        document.getElementById('edit-resource-id').value = incident.resource_id || '';
        
        editModal.classList.remove('hidden');
    } catch (error) {
        console.error('Error fetching incident:', error);
    }
}

async function handleEditIncident(event) {
    event.preventDefault();
    const id = document.getElementById('edit-id').value;
    const formData = new FormData(event.target);
    const incidentData = Object.fromEntries(formData);
    delete incidentData.id;

    try {
        const response = await fetch(`/api/incidents/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(incidentData)
        });

        if (response.status === 401) {
            showAuth();
            return;
        }

        const data = await response.json();
        if (response.ok) {
            editModal.classList.add('hidden');
            fetchIncidents();
        } else {
            editMessage.textContent = data.error || 'Failed to update incident';
        }
    } catch (error) {
        editMessage.textContent = 'Failed to update incident';
    }
}

function showDeleteConfirm(id) {
    currentIncidentId = id;
    confirmModal.classList.remove('hidden');
}

async function handleEscalate(id) {
    // For now, this function does nothing as requested.
    // You can add functionality here later.
    console.log(`Escalate incident with ID: ${id}`);
    // Example: alert(`Incident ${id} escalated (not really yet!)`);
    event.preventDefault();

    try {
        const response = fetch(`/api/escalate/${id}`);

        if (response.status === 401) {
            showAuth();
            return;
        }

        if (response.ok) {
            console.log(`Escalated incident with ID: ${id}`);
        } else {
            console.error(`Failed to escalate incident`, response.status);
        }
    } catch (error) {
        console.error(`Failed to escalate incident`, error);
    }
}

async function handleConfirmDelete() {
    if (!currentIncidentId) return;

    try {
        const response = await fetch(`/api/incidents/${currentIncidentId}`, {
            method: 'DELETE'
        });

        if (response.status === 401) {
            showAuth();
            return;
        }

        if (response.ok) {
            confirmModal.classList.add('hidden');
            fetchIncidents();
        }
    } catch (error) {
        console.error('Error deleting incident:', error);
    }
}
