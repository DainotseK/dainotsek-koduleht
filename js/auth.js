// js/auth.js

let auth0Client = null;

// Fetch our Auth0 config from the Netlify Function
async function fetchAuthConfig() {
  const res = await fetch("/.netlify/functions/getAuthConfig");
  if (!res.ok) {
    throw new Error("Failed to load Auth0 config");
  }
  return res.json();
}

// Initialize the Auth0 client
async function configureClient() {
  const { domain, clientId } = await fetchAuthConfig();
  auth0Client = await createAuth0Client({
    domain,
    client_id: clientId,
    redirect_uri: window.location.origin
  });
}

// Show or hide buttons & protect pages
async function updateUI() {
  const isAuthenticated = await auth0Client.isAuthenticated();

  const loginBtn  = document.getElementById("btn-login");
  const signupBtn = document.getElementById("btn-signup");
  const logoutBtn = document.getElementById("btn-logout");
  const adminBtn  = document.getElementById("admin-button");

  if (loginBtn)  loginBtn.style.display  = isAuthenticated ? "none" : "inline-block";
  if (signupBtn) signupBtn.style.display = isAuthenticated ? "none" : "inline-block";
  if (logoutBtn) logoutBtn.style.display = isAuthenticated ? "inline-block" : "none";
  if (adminBtn)  adminBtn.style.display  = isAuthenticated ? "inline-block" : "none";

  // Protect /admin
  if (location.pathname.includes("admin") && !isAuthenticated) {
    location.href = "/";
  }

  // Protect /finance
  if (location.pathname.includes("finance") && !isAuthenticated) {
    const container = document.querySelector(".single-card-container");
    if (container) {
      container.innerHTML = `
      <div class="brand-card">
        <h2>Restricted</h2>
        <div class="description">
          <p>This content is only available to logged-in users.</p>
        </div>
      </div>`;
    }
  }
}

// Wire up everything when page loads
window.onload = async () => {
  try {
    await configureClient();

    // Handle the redirect back from Auth0
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {
      await auth0Client.handleRedirectCallback();
      history.replaceState({}, document.title, "/");
    }

    // Update UI based on auth state
    await updateUI();

    // Register click handlers
    document.getElementById("btn-login")?.addEventListener("click", () =>
      auth0Client.loginWithRedirect()
    );

    document.getElementById("btn-signup")?.addEventListener("click", () =>
      auth0Client.loginWithRedirect({ screen_hint: "signup" })
    );

    document.getElementById("btn-logout")?.addEventListener("click", () =>
      auth0Client.logout({ returnTo: window.location.origin })
    );

  } catch (err) {
    console.error("Auth error:", err);
  }
};
