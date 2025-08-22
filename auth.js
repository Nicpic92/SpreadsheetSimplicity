// --- START OF FILE auth.js (Simplified Version) ---

import { createAuth0Client } from 'https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2/+esm';

let auth0 = null;

const config = {
  domain: "dev-m4nracli6jswxp7v.us.auth0.com",
  clientId: "JAa1D0GJTf1TsaBXdQUdKSyOgNT6qZr5",
  authorizationParams: {
    redirect_uri: window.location.origin
  }
};

export async function initializeAuth0() {
  if (auth0) return;
  auth0 = await createAuth0Client(config);

  if (location.search.includes("code=") && location.search.includes("state=")) {
    await auth0.handleRedirectCallback();
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

export async function updateAuthUI() {
  const isAuthenticated = await auth0.isAuthenticated();
  const loginButton = document.getElementById('login-button');
  const userProfile = document.getElementById('user-profile');
  const logoutButton = document.getElementById('logout-button');

  if (loginButton) loginButton.addEventListener('click', () => auth0.loginWithRedirect());
  if (logoutButton) logoutButton.addEventListener('click', () => auth0.logout({ logoutParams: { returnTo: window.location.origin } }));

  if (isAuthenticated) {
    if (loginButton) loginButton.style.display = 'none';
    if (userProfile) userProfile.style.display = 'flex';
  } else {
    if (loginButton) loginButton.style.display = 'block';
    if (userProfile) userProfile.style.display = 'none';
  }
}

// We are temporarily removing the protectPage and handleSubscription functions.
// We will add them back once login is working.
export async function protectPage() {
    // This function will now do nothing.
    // This means all your "pro" tools will be temporarily visible to everyone.
    return; 
}
// --- END OF FILE auth.js (Simplified Version) ---
