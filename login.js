
const AUTH_FORM_IDS = [
    "login-form",
    "register-form",
    "reset-request-form",
    "reset-password-form"
];

function getAuthContext() {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const read = (key) => searchParams.get(key) || hashParams.get(key) || "";

    return {
        mode: read("mode"),
        type: read("type"),
        errorDescription: read("error_description")
    };
}

function isResetFlow(authContext = getAuthContext()) {
    return authContext.mode === "reset" || authContext.type === "recovery";
}

function getAppBasePath() {
    const path = window.location.pathname;
    if (path.endsWith("/login.html")) {
        return path.slice(0, -"login.html".length);
    }

    const lastSlashIndex = path.lastIndexOf("/");
    return path.slice(0, lastSlashIndex + 1) || "/";
}

function getAppUrl(path = "") {
    return `${getAppBasePath()}${path}`;
}

function showForm(formId) {
    AUTH_FORM_IDS.forEach((currentFormId) => {
        const form = document.getElementById(currentFormId);
        if (form) {
            form.style.display = currentFormId === formId ? "block" : "none";
        }
    });
}

function toggleForms() {
    const registerForm = document.getElementById("register-form");
    const isRegisterVisible = registerForm && registerForm.style.display === "block";
    showForm(isRegisterVisible ? "login-form" : "register-form");
    setStatus("", "");
}

function setStatus(message, type) {
    const statusMessage = document.getElementById("auth-status");
    if (!statusMessage) {
        return;
    }

    statusMessage.textContent = message;
    statusMessage.className = `auth-status ${type}`.trim();
}

function setSubmitting(formId, isSubmitting) {
    const form = document.getElementById(formId);
    if (!form) {
        return;
    }

    const button = form.querySelector("button[type='submit']");
    if (button) {
        button.disabled = isSubmitting;
    }
}

async function ensureSupabase() {
    try {
        await window.supabaseReady;
        return window.supabaseClient;
    } catch (error) {
        setStatus(error.message, "error");
        throw error;
    }
}

async function redirectIfAuthenticated() {
    const authContext = getAuthContext();
    const client = await ensureSupabase();
    const { data, error } = await client.auth.getSession();

    if (error) {
        setStatus(error.message, "error");
        return;
    }

    if (authContext.errorDescription) {
        setStatus(decodeURIComponent(authContext.errorDescription), "error");
    }

    if (isResetFlow(authContext) && data.session) {
        showForm("reset-password-form");
        setStatus("Sessao de recuperacao validada. Defina sua nova senha.", "success");
        return;
    }

    if (authContext.mode === "reset-request") {
        showForm("reset-request-form");
        return;
    }

    if (data.session) {
        window.location.replace(getAppUrl());
    }
}

async function handleLogin(event) {
    event.preventDefault();
    setStatus("", "");
    setSubmitting("login-form", true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const client = await ensureSupabase();
    const { error } = await client.auth.signInWithPassword({
        email,
        password
    });

    setSubmitting("login-form", false);

    if (error) {
        setStatus(error.message, "error");
        return;
    }

    setStatus("Login realizado com sucesso. Redirecionando...", "success");
    window.location.replace(getAppUrl());
}

async function handleRegister(event) {
    event.preventDefault();
    setStatus("", "");
    setSubmitting("register-form", true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const client = await ensureSupabase();
    const publicConfig = window.supabasePublicConfig || {};
    const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: publicConfig.emailRedirectTo || `${window.location.origin}${getAppUrl("login.html")}`,
            data: {
                name
            }
        }
    });

    setSubmitting("register-form", false);

    if (error) {
        setStatus(error.message, "error");
        return;
    }

    if (data.session) {
        setStatus("Conta criada com sucesso. Redirecionando...", "success");
        window.location.replace(getAppUrl());
        return;
    }

    setStatus("Conta criada. Verifique seu e-mail para confirmar o acesso.", "success");
    showForm("login-form");
}

async function handleResetRequest(event) {
    event.preventDefault();
    setStatus("", "");
    setSubmitting("reset-request-form", true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const client = await ensureSupabase();
    const publicConfig = window.supabasePublicConfig || {};
    const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: publicConfig.passwordResetRedirectTo || `${window.location.origin}${getAppUrl("login.html")}?mode=reset`
    });

    setSubmitting("reset-request-form", false);

    if (error) {
        setStatus(error.message, "error");
        return;
    }

    setStatus("Enviamos o link de redefinicao para o seu e-mail.", "success");
}

async function handlePasswordUpdate(event) {
    event.preventDefault();
    setStatus("", "");
    setSubmitting("reset-password-form", true);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password.length < 6) {
        setSubmitting("reset-password-form", false);
        setStatus("A senha precisa ter pelo menos 6 caracteres.", "error");
        return;
    }

    if (password !== confirmPassword) {
        setSubmitting("reset-password-form", false);
        setStatus("As senhas nao coincidem.", "error");
        return;
    }

    const client = await ensureSupabase();
    const { error } = await client.auth.updateUser({
        password
    });

    setSubmitting("reset-password-form", false);

    if (error) {
        setStatus(error.message, "error");
        return;
    }

    setStatus("Senha atualizada com sucesso. Redirecionando...", "success");
    window.setTimeout(() => {
        window.location.replace(getAppUrl());
    }, 1200);
}

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("register-form").addEventListener("submit", handleRegister);
    document.getElementById("reset-request-form").addEventListener("submit", handleResetRequest);
    document.getElementById("reset-password-form").addEventListener("submit", handlePasswordUpdate);
    document.getElementById("show-reset-request").addEventListener("click", () => {
        showForm("reset-request-form");
        setStatus("", "");
    });
    document.getElementById("back-to-login-from-reset").addEventListener("click", () => {
        showForm("login-form");
        setStatus("", "");
    });

    showForm(isResetFlow() ? "reset-password-form" : "login-form");

    try {
        const client = await ensureSupabase();

        client.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY") {
                showForm("reset-password-form");
                setStatus("Sessao de recuperacao validada. Defina sua nova senha.", "success");
                return;
            }

            if (event === "SIGNED_IN" && session && !isResetFlow()) {
                window.location.replace(getAppUrl());
            }
        });

        await redirectIfAuthenticated();
    } catch (error) {
        console.error("Falha ao carregar os fluxos de autenticacao:", error);
    }
});
