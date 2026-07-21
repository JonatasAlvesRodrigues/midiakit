if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("SDK do Supabase nao foi carregado.");
}

window.supabaseReady = (async () => {
    const publicConfig = {
        url: "https://nodnkafzdwsvizikoiqz.supabase.co",
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vZG5rYWZ6ZHdzdml6aWtvaXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MTIzMjQsImV4cCI6MjA5OTk4ODMyNH0.t_JV84PeX51z6an9o_ZKJqr9O-j0kT5_lM7HpRnt_Gk",
        storageBucket: "media-assets",
        appUrl: "https://jonatasalvesrodrigues.github.io/midiakit"
    };

    window.supabasePublicConfig = {
        ...publicConfig,
        passwordResetRedirectTo: `${publicConfig.appUrl}/login.html?mode=reset`,
        emailRedirectTo: `${publicConfig.appUrl}/login.html`
    };

    window.supabaseClient = window.supabase.createClient(
        publicConfig.url,
        publicConfig.anonKey,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );

    return window.supabaseClient;
})().catch((error) => {
    window.supabaseInitializationError = error;
    console.error("Falha ao inicializar o Supabase:", error);
    throw error;
});
