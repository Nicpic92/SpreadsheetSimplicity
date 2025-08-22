// --- START OF FILE auth.js (Final Simplified Version) ---

import { createAuth0Client } from 'https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2/+esm';

let auth0 = null;

const config = {
  domain: "dev-m4nracli6jswxp7v.us.auth0.com",
  
  // This is your NEW, clean Client ID
  clientId: "2Ev5hKHRs84A5U6vxvt3inKeHPiMsxYv", 

  authorizationParams: {
    // We are REMOVING the 'audience' parameter for this test.
    redirect_uri: "https://spreadsheetsimplicity.com"
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
  const upgradeSection = document.getElementById('upgrade-section');

  if (loginButton) loginButton.addEventListener('click', () => auth0.loginWithRedirect());
  if (logoutButton) logoutButton.addEventListener('click', () => auth0.logout({ logoutParams: { returnTo: window.location.origin } }));

  if (isAuthenticated) {
    if (loginButton) loginButton.style.display = 'none';
    if (userProfile) userProfile.style.display = 'flex';
    // Hide the upgrade section for now
    if (upgradeSection) upgradeSection.style.display = 'none';
  } else {
    if (loginButton) loginButton.style.display = 'block';
    if (userProfile) userProfile.style.display = 'none';
    if (upgradeSection) upgradeSection.style.display = 'none';
  }
}

// This function will now do nothing, making all tools temporarily accessible.
export async function protectPage() {
    return; 
}
// --- END OF FILE auth.js (Final Simplified Version) ---
