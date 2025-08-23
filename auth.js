// This variable will act as a simple in-memory cache for the user profile
let userProfileCache = null;

/**
 * Stores the authentication token in the browser's local storage.
 * @param {string} token The JWT received from the server.
 */
function saveToken(token) {
    localStorage.setItem('ss_token', token);
}

/**
 * Retrieves the authentication token from local storage.
 * @returns {string|null} The stored token or null if not found.
 */
export function getToken() {
    return localStorage.getItem('ss_token');
}

/**
 * Checks if a user is currently authenticated.
 * @returns {boolean} True if a token exists, false otherwise.
 */
export function isAuthenticated() {
    const token = getToken();
    return !!token;
}

/**
 * Handles the user login process.
 * @param {string} email The user's email.
 * @param {string} password The user's password.
 */
export async function login(email, password) {
    const response = await fetch('/.netlify/functions/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed.');
    }

    const { token } = await response.json();
    saveToken(token);
    userProfileCache = null; // Clear cache on new login
}

/**
 * Handles the user signup process.
 * @param {string} email The user's email.
 * @param {string} password The user's password.
 */
export async function signup(email, password) {
    const response = await fetch('/.netlify/functions/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Signup failed.');
    }
    
    // After successful signup, log the user in automatically
    await login(email, password);
}

/**
 * Logs the user out by removing the token and redirecting.
 */
export function logout() {
    localStorage.removeItem('ss_token');
    userProfileCache = null; // Clear cache on logout
    window.location.href = '/index.html';
}

/**
 * Fetches the current user's profile from the backend.
 * Uses a simple cache to avoid repeated requests on the same page load.
 * @returns {Promise<object|null>} The user object or null.
 */
export async function getUser() {
    if (userProfileCache) {
        return userProfileCache;
    }

    if (!isAuthenticated()) {
        return null;
    }

    try {
        const response = await fetch('/.netlify/functions/get-user-profile', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) {
            // If token is invalid (e.g., expired), log the user out
            if (response.status === 401) logout(); 
            return null;
        }

        userProfileCache = await response.json();
        return userProfileCache;

    } catch (error) {
        console.error("Failed to get user profile:", error);
        return null;
    }
}

/**
 * Updates the UI elements (header, buttons) based on authentication state.
 */
export async function updateAuthUI() {
    const loginButtons = document.querySelectorAll('#login-button, #access-login-button');
    const userProfileDiv = document.getElementById('user-profile');
    const logoutButton = document.getElementById('logout-button');
    const userEmailSpan = document.getElementById('user-email-display');
    const modal = document.getElementById('auth-modal');

    const openModal = () => {
        if (modal) modal.style.display = 'flex';
    };

    if (isAuthenticated()) {
        loginButtons.forEach(btn => btn.style.display = 'none');
        if (userProfileDiv) userProfileDiv.style.display = 'flex';
        
        const user = await getUser();
        if (user && userEmailSpan) {
            userEmailSpan.textContent = user.email;
        }
        
        if (logoutButton) {
            logoutButton.addEventListener('click', logout);
        }
    } else {
        loginButtons.forEach(btn => {
            btn.style.display = 'block';
            btn.addEventListener('click', openModal);
        });
        if (userProfileDiv) userProfileDiv.style.display = 'none';
    }
}

/**
 * Protects a page by checking backend permissions before showing content.
 */
export async function protectPage() {
    const mainContent = document.querySelector('main');
    const accessDenied = document.getElementById('access-denied');

    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1);

    // --- THIS IS THE NEW DIAGNOSTIC ALERT ---
    // This will force the browser to show us the filename it is about to send.
    alert(`[DIAGNOSTIC] Filename being sent to backend: "${filename}"`);
    // --- END DIAGNOSTIC ---

    try {
        const response = await fetch('/.netlify/functions/check-access', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filename: filename })
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const data = await response.json();

        if (data.hasAccess) {
            if (mainContent) mainContent.style.display = 'block'; 
            if (accessDenied) accessDenied.style.display = 'none';
        } else {
            if (mainContent) mainContent.style.display = 'none';
            if (accessDenied) accessDenied.style.display = 'block'; 
        }

    } catch (error) {
        console.error('CRITICAL ERROR during access check:', error);
        if (mainContent) mainContent.style.display = 'none';
        if (accessDenied) accessDenied.style.display = 'block';
    }
}

/**
 * Initiates the Stripe checkout process for subscriptions.
 */
export async function handleSubscription() {
    const subscribeButton = document.getElementById('subscribe-button');
    if (!subscribeButton) return;

    // NOTE: Replace with your actual Stripe publishable key in a .env file
    const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY; 
    
    subscribeButton.addEventListener('click', async () => {
        subscribeButton.disabled = true;
        subscribeButton.textContent = 'Redirecting to checkout...';

        try {
            const response = await fetch('/.netlify/functions/create-checkout-session', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });

            if (!response.ok) throw new Error('Could not create checkout session.');

            const { sessionId } = await response.json();
            const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
            await stripe.redirectToCheckout({ sessionId });

        } catch (error) {
            console.error('Subscription Error:', error);
            subscribeButton.textContent = 'Error! Please try again.';
            subscribeButton.disabled = false;
        }
    });
}
