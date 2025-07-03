let auth0Client = null;

const configureClient = async () => {
    try {
        const response = await fetch('/.netlify/functions/getAuthConfig');
        if (!response.ok) throw new Error('Could not fetch auth config.');
        const config = await response.json();

        // See 'auth0' tuleb nüüd 'auth0-library.js' failist
        auth0Client = await auth0.createAuth0Client({
            domain: config.domain,
            clientId: config.clientId,
            authorizationParams: {
                redirect_uri: window.location.origin
            }
        });
    } catch(e) {
        console.error("Auth0 initialization error", e);
    }
};

const updateUI = async () => {
    if (!auth0Client) return;
    try {
        const isAuthenticated = await auth0Client.isAuthenticated();
        document.getElementById('btn-login').style.display = isAuthenticated ? 'none' : 'block';
        document.getElementById('btn-logout').style.display = isAuthenticated ? 'block' : 'none';
    } catch(e) {
        console.error("UI update error", e);
    }
};

const main = async () => {
    await configureClient();

    document.getElementById('btn-login').addEventListener('click', () => {
        if (auth0Client) auth0Client.loginWithRedirect();
    });
    document.getElementById('btn-logout').addEventListener('click', () => {
        if (auth0Client) auth0Client.logout();
    });

    if (location.search.includes('state=') && location.search.includes('code=')) {
        await auth0Client.handleRedirectCallback();
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    updateUI();
};

// Ootame, kuni leht on laetud, ja alles siis käivitame oma loogika
window.addEventListener('load', main);
