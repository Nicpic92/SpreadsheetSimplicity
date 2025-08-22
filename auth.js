let userProfile = null; // In-memory cache for user profile

// --- Core Authentication Functions ---

export function getToken() {
  return localStorage.getItem('userToken');
}

export function isAuthenticated() {
  const token = getToken();
  return !!token;
}

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
  localStorage.setItem('userToken', token);
}

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

export function logout() {
  localStorage.removeItem('userToken');
  userProfile = null; // Clear cache
  window.location.reload(); // Easiest way to reset UI state
}

export async function getUser() {
  if (userProfile) return userProfile; // Return from cache if available
  if (!isAuthenticated()) return null;

  try {
    const response = await fetch('/.netlify/functions/get-user-profile', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  
    if (!response.ok) {
      // If token is invalid (e.g., expired), log the user out
      logout();
      return null;
    }
    
    userProfile = await response.json();
    return userProfile;
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    logout();
    return null;
  }
}


// --- UI and Page Protection Logic ---

/**
 * A global function to open the authentication modal.
 * This will be called by various buttons across the site.
 */
export function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.style.display = 'flex';
  } else {
    console.error('Auth modal not found in the DOM.');
  }
}

async function handleSubscription() {
  const subscribeButton = document.getElementById('subscribe-button');
  if (!subscribeButton) return;

  subscribeButton.addEventListener('click', async () => {
    try {
      subscribeButton.disabled = true;
      subscribeButton.textContent = 'Redirecting...';
      const token = getToken();
      const response = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
      }
      const { sessionId } = await response.json();
      const stripe = Stripe('pk_live_51Ryc5tGbxgsv5aJ6w9YDK0tE0XVnCz1XspXdarf3DYoE7g7YXLut87vm2AUsAjVmHwXTnE6ZXalKohb17u3mA8wa008pR7uPYA'); // Use your LIVE key
      await stripe.redirectToCheckout({ sessionId });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      subscribeButton.disabled = false;
      subscribeButton.textContent = 'Upgrade for $25/month';
    }
  });
}

export async function updateAuthUI() {
  const loginButton = document.getElementById('login-button');
  const userProfileEl = document.getElementById('user-profile');
  const logoutButton = document.getElementById('logout-button');
  const upgradeSection = document.getElementById('upgrade-section');

  if (loginButton) loginButton.addEventListener('click', openAuthModal);
  if (logoutButton) logoutButton.addEventListener('click', logout);

  if (isAuthenticated()) {
    if (loginButton) loginButton.style.display = 'none';
    if (userProfileEl) userProfileEl.style.display = 'flex';
    
    const user = await getUser();
    // In our new system, the role is 'subscription_status'
    const isPro = user && user.subscription_status === 'active';

    if (upgradeSection) {
        upgradeSection.style.display = isPro ? 'none' : 'block';
    }
    handleSubscription();
  } else {
    if (loginButton) loginButton.style.display = 'block';
    if (userProfileEl) userProfileEl.style.display = 'none';
    if (upgradeSection) upgradeSection.style.display = 'none';
  }
}

export async function protectPage() {
    let isPro = false;
    if (isAuthenticated()) {
        const user = await getUser();
        isPro = user && user.subscription_status === 'active';
    }

    if (!isPro) {
        const mainContent = document.querySelector('main');
        if (mainContent) mainContent.style.display = 'none';
        
        const accessDeniedBlock = document.getElementById('access-denied');
        if (accessDeniedBlock) accessDeniedBlock.style.display = 'block';
        
        const accessLoginButton = document.getElementById('access-login-button');
        if (accessLoginButton) {
            if (isAuthenticated()) {
                accessLoginButton.textContent = 'Upgrade to Pro';
                accessLoginButton.onclick = () => window.location.href = '/'; 
            } else {
                // When a non-logged-in user clicks the login button on a protected page
                accessLoginButton.addEventListener('click', openAuthModal);
            }
        }
    }
}
