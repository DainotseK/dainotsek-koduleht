// js/auth.js

let auth0Client = null;

// Lae Auth0 konfiguratsioon Netlify Functioni kaudu
async function fetchAuthConfig() {
  const res = await fetch("/.netlify/functions/getAuthConfig");
  if (!res.ok) {
    throw new Error("Failed to load Auth0 config");
  }
  return res.json();
}

// Loo Auth0 klient
async function configureClient() {
  const { domain, clientId } = await fetchAuthConfig();
  auth0Client = await createAuth0Client({
    domain,
    client_id: clientId,
    redirect_uri: window.location.origin
  });
}

// Uuenda UI nuppe vastavalt autentimise olekule
async function updateUI() {
  const isAuthenticated = await auth0Client.isAuthenticated();

  const loginBtn  = document.getElementById("btn-login");
  const logoutBtn = document.getElementById("btn-logout");
  const signupBtn = document.getElementById("btn-signup");
  const adminBtn  = document.getElementById("admin-button");

  if (loginBtn)  loginBtn.style.display  = isAuthenticated ? "none" : "inline-block";
  if (logoutBtn) logoutBtn.style.display = isAuthenticated ? "inline-block" : "none";
  if (signupBtn) signupBtn.style.display = isAuthenticated ? "none" : "inline-block";
  if (adminBtn)  adminBtn.style.display  = isAuthenticated ? "inline-block" : "none";

  // Kaitse admin-lehte
  if (window.location.pathname.includes("admin") && !isAuthenticated) {
    window.location.href = "/";
  }

  // Kaitse finance-lehte
  if (window.location.pathname.includes("finance") && !isAuthenticated) {
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

// Käivita autentimisloogika peale lehe laadimist
window.onload = async () => {
  try {
    await configureClient();

    // Kui URL-is on Auth0 callback parameetrid, käsitle need
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {
      await auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, "/");
    }

    await updateUI();

    // Nupu sündmuste registreerimine
    const loginBtn  = document.getElementById("btn-login");
    const logoutBtn = document.getElementById("btn-logout");
    const signupBtn = document.getElementById("btn-signup");

    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        auth0Client.loginWithRedirect();
      });
    }

    if (signupBtn) {
      signupBtn.addEventListener("click", () => {
        auth0Client.loginWithRedirect({ screen_hint: "signup" });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        auth0Client.logout({ returnTo: window.location.origin });
      });
    }
  } catch (err) {
    console.error("Auth init error:", err);
  }
};
