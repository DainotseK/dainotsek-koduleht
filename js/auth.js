// js/auth.js

let auth0Client = null;

// Laeb Auth0 konfiguratsiooni Netlify funktsioonist ja inicialiseerib kliendi
const configureClient = async () => {
    try {
        const response = await fetch('/.netlify/functions/getAuthConfig');
        if (!response.ok) throw new Error('Could not fetch auth config.');
        const config = await response.json();

        auth0Client = await auth0.createAuth0Client({
            domain: config.domain,
            clientId: config.clientId,
            authorizationParams: {
                redirect_uri: window.location.href.split('?')[0]
            }
        });
    } catch (e) {
        console.error('Auth0 initialization error', e);
    }
};

// Uuendab sisselogimise ja väljalogimise nuppude nähtavust
const updateUI = async () => {
    if (!auth0Client) return;
    try {
        const isAuthenticated = await auth0Client.isAuthenticated();
        document.getElementById('btn-login').style.display = isAuthenticated ? 'none' : 'block';
        document.getElementById('btn-logout').style.display = isAuthenticated ? 'block' : 'none';

        // finance.html admin nupp
        const adminButton = document.getElementById('admin-button');
        if (adminButton) {
            adminButton.style.display = isAuthenticated ? 'block' : 'none';
        }
    } catch (e) {
        console.error('UI update error', e);
    }
};

// Peamine funktsioon
const main = async () => {
    await configureClient();

    // Auth0 callback käsitlemine
    if (location.search.includes('state=') && location.search.includes('code=')) {
        try {
            await auth0Client.handleRedirectCallback();
        } catch (e) {
            console.error('Redirect callback error', e);
        }
        // Eemaldame URL-ist parameetrid
        const cleanUrl = window.location.href.split('?')[0];
        window.history.replaceState({}, document.title, cleanUrl);
    }

    // Uuendame UI vastavalt auth-seisule
    await updateUI();

    // Lisa sündmuste kuulajad
    const loginBtn = document.getElementById('btn-login');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => auth0Client && auth0Client.loginWithRedirect());
    }
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => auth0Client && auth0Client.logout({ logoutParams: { returnTo: window.location.origin } }));
    }
};

// Käivitame
window.addEventListener('load', main);
