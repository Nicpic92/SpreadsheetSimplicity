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
    await login(email, password);
}

export function logout() {
  localStorage.removeItem('userToken');
  userProfile = null;
  window.location.reload();
}

export async function getUser() {
  if (userProfile) return userProfile;
  if (!isAuthenticated()) return null;

  try {
    const response = await fetch('/.netlify/functions/get-user-profile', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  
    if (!response.ok) {
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

// --- UI Logic ---

export function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.style.display = 'flex';
  } else {
    console.error('Auth modal not found in the DOM.');
  }
}

async function handleSubscription() {
  // ... (This function remains unchanged)
}

export async function updateAuthUI() {
  // ... (This function remains unchanged)
}


// --- NEW, SIMPLIFIED PAGE PROTECTION LOGIC ---

/**
 * Checks with the backend if the current user has access to the current page.
 * @returns {Promise<boolean>} A promise that resolves to true if the user has access, otherwise false.
 */
async function checkAccess() {
    // Get the filename of the current page (e.g., "ExcelValidate.html")
    const filename = window.location.pathname.split('/').pop();
    if (!filename) return true; // Allow access to the root path "/"

    try {
        const response = await fetch('/.netlify/functions/check-access', {
            method: 'POST',
            // Send the token even if the user is logged out (it will be null)
            headers: { 
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filename })
        });

        if (!response.ok) {
            console.error("Access check failed:", await response.text());
            return false;
        }

        const data = await response.json();
        return data.hasAccess;

    } catch (error) {
        console.error("Error during access check:", error);
        return false;
    }
}


/**
 * Protects a page by calling the backend to verify permissions.
 * If access is denied, it hides the main content and shows an access-denied message.
 */
export async function protectPage() {
    const hasAccess = await checkAccess();

    if (!hasAccess) {
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.style.display = 'none';
        }
        
        const accessDeniedBlock = document.getElementById('access-denied');
        if (accessDeniedBlock) {
            accessDeniedBlock.style.display = 'block';
        }
        
        const accessLoginButton = document.getElementById('access-login-button');
        if (accessLoginButton) {
            if (isAuthenticated()) {
                // User is logged in but doesn't have permission for this specific tool.
                accessLoginButton.textContent = 'Upgrade Plan';
                accessLoginButton.onclick = () => { window.location.href = '/'; }; 
            } else {
                // User is not logged in at all.
                accessLoginButton.textContent = 'Log In to Access';
                accessLoginButton.addEventListener('click', openAuthModal);
            }
        }
    }
}
