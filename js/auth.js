let auth0Client = null;

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
        
        const adminButton = document.getElementById('admin-button');
        if (adminButton) {
            adminButton.style.display = isAuthenticated ? 'block' : 'none';
        }
    } catch(e) {
        console.error("UI update error", e);
    }
};

const main = async () => {
    await configureClient();

    if (location.search.includes('state=') && location.search.includes('code=')) {
        await auth0Client.handleRedirectCallback();
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    await updateUI();

    const loginButton = document.getElementById('btn-login');
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            if (auth0Client) auth0Client.loginWithRedirect();
        });
    }
    
    const logoutButton = document.getElementById('btn-logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            if (auth0Client) auth0Client.logout({ logoutParams: { returnTo: window.location.origin } });
        });
    }
};

window.addEventListener('load', main);
