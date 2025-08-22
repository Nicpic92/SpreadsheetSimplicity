// --- START OF FILE auth.js (Final Explicit Redirect) ---

import { createAuth0Client } from 'https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2/+esm';

let auth0 = null;

const config = {
  domain: "dev-m4nracli6jswxp7v.us.auth0.com",
  clientId: "2Ev5hKHRs84A5U6vxvt3inKeHPiMsxYv", 
  authorizationParams: {
    // We are now explicitly setting the redirect_uri to match the Auth0 setting.
    redirect_uri: "https://spreadsheetsimplicity.com",
    audience: "https://spreadsheetsimplicity.netlify.app" 
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
  if (logoutButton) logoutButton.addEventListener('click', () => auth0.logout({ logoutParams: { returnTo: "https://spreadsheetsimplicity.com" } }));

  if (isAuthenticated) {
    if (loginButton) loginButton.style.display = 'none';
    if (userProfile) userProfile.style.display = 'flex';
  } else {
    if (loginButton) loginButton.style.display = 'block';
    if (userProfile) userProfile.style.display = 'none';
  }
}

// All pro/subscription logic is temporarily removed until login works.
export async function protectPage() { return; }
// --- END OF FILE auth.js (Final Explicit Redirect) ---


