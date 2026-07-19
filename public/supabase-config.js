
if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("SDK do Supabase nao foi carregado.");
}

async function loadSupabasePublicConfig() {
    const response = await fetch("/api/supabase-config", {
        cache: "no-store"
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Nao foi possivel carregar a configuracao do Supabase.");
    }

    return response.json();
}

window.supabaseReady = (async () => {
    const publicConfig = await loadSupabasePublicConfig();

    window.supabasePublicConfig = publicConfig;
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
