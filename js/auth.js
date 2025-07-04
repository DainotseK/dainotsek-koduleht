// js/auth.js
let auth0Client = null;

// Laeme Auth0 seadistuse Netlify Functionist
async function fetchAuthConfig() {
  const res = await fetch("/.netlify/functions/getAuthConfig");
  if (!res.ok) throw new Error("Failed to load Auth0 config");
  return res.json();
}

// Loon Auth0 kliendi
async function configureClient() {
  const { domain, clientId } = await fetchAuthConfig();
  auth0Client = await createAuth0Client({
    domain,
    client_id: clientId,
    redirect_uri: window.location.origin
  });
}

// Uuendab Log In / Log Out / Admin nuppe ning kaitseb lehti
async function updateUI() {
  const isAuthenticated = await auth0Client.isAuthenticated();

  const loginBtn  = document.getElementById("btn-login");
  const logoutBtn = document.getElementById("btn-logout");
  const adminBtn  = document.getElementById("admin-button");

  if (loginBtn)  loginBtn.style.display  = isAuthenticated ? "none" : "inline-block";
  if (logoutBtn) logoutBtn.style.display = isAuthenticated ? "inline-block" : "none";
  if (adminBtn)  adminBtn.style.display  = isAuthenticated ? "inline-block" : "none";

  // Admin-paneelilt eemalda niisama pääs
  if (window.location.pathname.includes("admin") && !isAuthenticated) {
    window.location.href = "/";
  }

  // Finance-lehel peida sisu, kui ei ole sisse logitud
  if (window.location.pathname.includes("finance") && !isAuthenticated) {
    const container = document.querySelector(".single-card-container");
    if (container) {
      container.innerHTML = `
        <div class="brand-card">
          <h2>Restricted</h2>
          <div class="description">
            <p>This content is only available to logged-in users.</p>
          </div>
        </div>
      `;
    }
  }
}

window.onload = async () => {
  try {
    await configureClient();

    // Kui URL sisaldab Auth0 callback parameetreid
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {
      await auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, "/");
    }

    await updateUI();

    const loginBtn  = document.getElementById("btn-login");
    const logoutBtn = document.getElementById("btn-logout");

    if (loginBtn) {
      loginBtn.addEventListener("click", () => auth0Client.loginWithRedirect());
    }
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () =>
        auth0Client.logout({ returnTo: window.location.origin })
      );
    }
  } catch (e) {
    console.error("Auth init error:", e);
  }
};
