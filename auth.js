// --- START OF FILE auth.js (Definitive Final Version) ---

import { createAuth0Client } from 'https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2/+esm';

let auth0 = null;

const config = {
  // Your NEW Tenant Domain
  domain: "dev-eadic43odi6p2c5h.us.auth0.com", 
  
  // Your NEW Application Client ID
  clientId: "J3TboacpSSkgFzkLLzqrgTe4UtEZQWBq", // <-- Comma is now correctly placed here

  authorizationParams: {
    redirect_uri: "https://spreadsheetsimplicity.com"
    // NO audience parameter for this test
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

// All pro/subscription logic is disabled until login is working.
export async function protectPage() { 
    return; 
}
// --- END OF FILE auth.js (Definitive Final Version) ---
