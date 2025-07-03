// js/auth.js
let auth0Client = null;

// Lae Auth0 konfiguratsioon Netlify Functions kaudu
async function fetchAuthConfig() {
  const res = await fetch("/.netlify/functions/getAuthConfig");
  if (!res.ok) throw new Error("Failed to load Auth0 config");
  return await res.json();
}

// Loo Auth0 klient
async function configureClient() {
  const config = await fetchAuthConfig();
  auth0Client = await createAuth0Client({
    domain: config.domain,
    client_id: config.clientId,
    redirect_uri: window.location.origin
  });
}

// Uuenda UI vastavalt sisselogimise olekule
async function updateUI() {
  const isAuthenticated = await auth0Client.isAuthenticated();

  const loginBtn = document.getElementById("btn-login");
  const logoutBtn = document.getElementById("btn-logout");
  const adminBtn = document.getElementById("admin-button");

  if (loginBtn) loginBtn.style.display = isAuthenticated ? "none" : "inline-block";
  if (logoutBtn) logoutBtn.style.display = isAuthenticated ? "inline-block" : "none";
  if (adminBtn) adminBtn.style.display = isAuthenticated ? "inline-block" : "none";

  // Kaitse admin-lehte
  if (window.location.pathname.includes("admin") && !isAuthenticated) {
    window.location.href = "/";
  }

  // Peida finance sisu kui pole sisse logitud
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

// Käivita sisselogimise kontroll
window.onload = async () => {
  try {
    await configureClient();

    // Kui URL-is on Auth0 callback parameetrid
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {
      await auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, "/");
    }

    await updateUI();

    // Nuppude sündmused
    const loginBtn = document.getElementById("btn-login");
    const logoutBtn = document.getElementById("btn-logout");

    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        auth0Client.loginWithRedirect();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        auth0Client.logout({ returnTo: window.location.origin });
      });
    }
  } catch (err) {
    console.error("Auth0 init error:", err);
  }
};
