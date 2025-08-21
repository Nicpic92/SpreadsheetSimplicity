// --- START OF FILE auth.js ---

import { createAuth0Client } from 'https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2/+esm';

let auth0 = null;

const config = {
  domain: "dev-m4nracli6jswxp7v.us.auth0.com",
  clientId: "JAalDOGJTf1TsaBXdQUdKSyOgNT6qZr5",
  authorizationParams: {
    // We keep redirect_uri REMOVED from the main config for flexibility.
    audience: "https://spreadsheetsimplicity.netlify.app" 
  }
};

async function handleSubscription() {
  const subscribeButton = document.getElementById('subscribe-button');
  if (!subscribeButton) return;

  subscribeButton.addEventListener('click', async () => {
    try {
      subscribeButton.disabled = true;
      subscribeButton.textContent = 'Redirecting...';
      const token = await auth0.getTokenSilently();
      const response = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
      }

      const { sessionId } = await response.json();
      const stripe = Stripe('pk_live_51Ryc5tGbxgsv5aJ6w9YDK0tE0XVnCz1XspXdarf3DYoE7g7YXLut87vm2AUsAjVmHwXTnE6ZXalKohb17u3mA8wa008pR7uPYA'); 
      await stripe.redirectToCheckout({ sessionId });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      subscribeButton.disabled = false;
      subscribeButton.textContent = 'Upgrade for $25/month';
    }
  });
}

export async function initializeAuth0() {
  if (auth0) return;
  auth0 = await createAuth0Client(config);
  if (location.search.includes("code=") && location.search.includes("state=")) {
    // The SDK handles the redirect URI automatically here on the return trip.
    await auth0.handleRedirectCallback();
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

export async function updateAuthUI() {
  const isAuthenticated = await auth0.isAuthenticated();
  const loginButton = document.getElementById('login-button');
  const userProfile = document.getElementById('user-profile');
  const logoutButton = document.getElementById('logout-button');
  const upgradeSection = document.getElementById('upgrade-section');

  // *** THIS IS THE FIRST CHANGE ***
  // We now explicitly tell Auth0 where to return the user.
  if (loginButton) loginButton.addEventListener('click', () => auth0.loginWithRedirect({
    appState: { targetUrl: window.location.pathname }
  }));

  if (logoutButton) logoutButton.addEventListener('click', () => auth0.logout({ logoutParams: { returnTo: window.location.origin } }));

  if (isAuthenticated) {
    if (loginButton) loginButton.style.display = 'none';
    if (userProfile) userProfile.style.display = 'flex';

    const user = await auth0.getUser();
    const roles = user['https://spreadsheetsimplicity.com/roles'] || []; 
    
    if (upgradeSection) {
        upgradeSection.style.display = roles.includes('pro-member') ? 'none' : 'block';
    }
    handleSubscription();
  } else {
    if (loginButton) loginButton.style.display = 'block';
    if (userProfile) userProfile.style.display = 'none';
    if (upgradeSection) upgradeSection.style.display = 'none';
  }
}

export async function protectPage() {
    const isAuthenticated = await auth0.isAuthenticated();
    let isPro = false;
    
    if (isAuthenticated) {
        const user = await auth0.getUser();
        const roles = user['https://spreadsheetsimplicity.com/roles'] || [];
        isPro = roles.includes('pro-member');
    }

    if (!isPro) {
        const mainContent = document.querySelector('main');
        if (mainContent) mainContent.style.display = 'none';

        const accessDeniedBlock = document.getElementById('access-denied');
        if (accessDeniedBlock) accessDeniedBlock.style.display = 'block';
        
        const accessLoginButton = document.getElementById('access-login-button');
        if (accessLoginButton) {
            if (isAuthenticated) {
                accessLoginButton.textContent = 'Upgrade to Pro';
                accessLoginButton.onclick = () => window.location.href = '/'; 
            } else {
                // *** THIS IS THE SECOND CHANGE ***
                // We do the same thing for the login button on the access denied page.
                accessLoginButton.addEventListener('click', () => auth0.loginWithRedirect({
                    appState: { targetUrl: window.location.pathname }
                }));
            }
        }
    }
}
// --- END OF FILE auth.js ---
