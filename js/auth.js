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
                // Pärast sisselogimist suunatakse tagasi avalehele
                redirect_uri: window.location.origin
            }
        });
    } catch(e) {
        console.error("Auth0 initialization error", e);
    }
};

const main = async () => {
    await configureClient();

    // Kui me oleme test-login.html lehel, käivitame kohe sisselogimise
    if (window.location.pathname.includes('test-login.html')) {
        if (auth0Client) {
            console.log('Test page: Redirecting to login...');
            await auth0Client.loginWithRedirect();
        }
        return; // Peatame skripti edasise töö testlehel
    }

    // Ülejäänud loogika teiste lehtede jaoks...
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

    if (location.search.includes('state=') && location.search.includes('code=')) {
        await auth0Client.handleRedirectCallback();
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    updateUI();

    document.getElementById('btn-login').addEventListener('click', () => {
        if (auth0Client) auth0Client.loginWithRedirect();
    });
    document.getElementById('btn-logout').addEventListener('click', () => {
        if (auth0Client) auth0Client.logout();
    });
};

// Käivitame kogu loogika
main();
