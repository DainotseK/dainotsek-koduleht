// js/auth.js
let auth0Client = null;

// Konfigureeri Auth0 klient
async function configureClient() {
  auth0Client = await createAuth0Client({
    domain: "YOUR_AUTH0_DOMAIN",
    client_id: "YOUR_AUTH0_CLIENT_ID",
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

  // Kui oled admin-lehel ja pole sisse logitud → suuna ära
  if (window.location.pathname.includes("admin") && !isAuthenticated) {
    window.location.href = "/";
  }

  // Kui oled finance-lehel ja pole sisse logitud → peida sisu
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
  const logoutBtn
