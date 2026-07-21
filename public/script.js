const defaultData = JSON.parse(JSON.stringify(mediaKitConfig));

let currentUser = null;
let currentProfile = {
    fullName: "",
    email: ""
};
let mediaKitData = JSON.parse(JSON.stringify(defaultData));

function cloneDefaultData() {
    return JSON.parse(JSON.stringify(defaultData));
}

function getStorageKey() {
    return currentUser ? `mediaKit:${currentUser.id}` : "mediaKit:guest";
}

function getSyncStatusElement() {
    return document.getElementById("sync-status");
}

function getSupabaseClient() {
    return window.supabaseClient;
}

function getPublicConfig() {
    return window.supabasePublicConfig || {};
}

function getStorageBucket() {
    return getPublicConfig().storageBucket || "media-assets";
}

function setSyncStatus(message, type = "") {
    const syncStatus = getSyncStatusElement();
    if (!syncStatus) {
        return;
    }

    syncStatus.textContent = message;
    syncStatus.className = `sync-status ${type}`.trim();
}

function readCachedMediaKitData() {
    const savedData = localStorage.getItem(getStorageKey());
    if (!savedData) {
        return null;
    }

    try {
        return JSON.parse(savedData);
    } catch (error) {
        console.error("Falha ao ler cache local do media kit:", error);
        return null;
    }
}

function writeCachedMediaKitData(payload) {
    localStorage.setItem(getStorageKey(), JSON.stringify(payload));
}

function clearCachedMediaKitData() {
    localStorage.removeItem(getStorageKey());
}

function normalizeMediaKitData(payload) {
    const base = cloneDefaultData();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return base;
    }

    return {
        ...base,
        ...payload,
        images: {
            ...base.images,
            ...(payload.images || {})
        },
        stats: Array.isArray(payload.stats) ? payload.stats : base.stats,
        insights: Array.isArray(payload.insights) ? payload.insights : base.insights,
        partners: Array.isArray(payload.partners) ? payload.partners : base.partners,
        services: Array.isArray(payload.services) ? payload.services : base.services,
        reasons: Array.isArray(payload.reasons) ? payload.reasons : base.reasons,
        portfolio: Array.isArray(payload.portfolio) ? payload.portfolio : base.portfolio,
        contacts: Array.isArray(payload.contacts) ? payload.contacts : base.contacts
    };
}

function applyProfileDefaults(payload) {
    const normalizedPayload = normalizeMediaKitData(payload);
    if (currentProfile.fullName && (!normalizedPayload.name || normalizedPayload.name === defaultData.name)) {
        normalizedPayload.name = currentProfile.fullName;
    }
    return normalizedPayload;
}

function getManagedStorageBaseUrl() {
    const publicConfig = getPublicConfig();
    if (!publicConfig.url) {
        return "";
    }

    return `${publicConfig.url.replace(/\/+$/, "")}/storage/v1/object/public/${getStorageBucket()}/`;
}

function sanitizeFileName(fileName) {
    return fileName
        .toLowerCase()
        .replace(/[^a-z0-9.\-_]/g, "-")
        .replace(/-+/g, "-");
}

function buildStoragePath(scope, fileName) {
    return `${currentUser.id}/${scope}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}

function extractManagedStoragePath(fileUrl) {
    if (!fileUrl) {
        return null;
    }

    const storageBaseUrl = getManagedStorageBaseUrl();
    if (!storageBaseUrl || !fileUrl.startsWith(storageBaseUrl)) {
        return null;
    }

    return decodeURIComponent(fileUrl.slice(storageBaseUrl.length));
}

async function deleteManagedAsset(fileUrl) {
    const assetPath = extractManagedStoragePath(fileUrl);
    if (!assetPath) {
        return;
    }

    const { error } = await getSupabaseClient()
        .storage
        .from(getStorageBucket())
        .remove([assetPath]);

    if (error) {
        console.warn("Nao foi possivel remover um arquivo antigo do Storage:", error);
    }
}

async function uploadAsset(file, scope, previousUrl = "") {
    const storagePath = buildStoragePath(scope, file.name);
    setSyncStatus(`Enviando ${file.name} para o Storage...`, "loading");

    const { error: uploadError } = await getSupabaseClient()
        .storage
        .from(getStorageBucket())
        .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (uploadError) {
        throw uploadError;
    }

    const { data } = getSupabaseClient()
        .storage
        .from(getStorageBucket())
        .getPublicUrl(storagePath);

    if (previousUrl && previousUrl !== data.publicUrl) {
        await deleteManagedAsset(previousUrl);
    }

    return data.publicUrl;
}

async function removeManagedAssetsFromMediaKit(payload) {
    const urls = [];

    Object.values(payload.images || {}).forEach((url) => {
        if (typeof url === "string") {
            urls.push(url);
        }
    });

    (payload.portfolio || []).forEach((item) => {
        if (item && typeof item.url === "string") {
            urls.push(item.url);
        }
    });

    for (const url of urls) {
        await deleteManagedAsset(url);
    }
}

async function loadProfile() {
    const { data, error } = await getSupabaseClient()
        .from("profiles")
        .select("email, full_name")
        .eq("id", currentUser.id)
        .maybeSingle();

    if (error) {
        console.error("Falha ao carregar profile:", error);
    }

    currentProfile = {
        fullName: data?.full_name || currentUser.user_metadata?.name || "",
        email: data?.email || currentUser.email || ""
    };
}

async function saveProfileData() {
    const fullName = document.getElementById("edit-profile-name").value.trim();

    const { error } = await getSupabaseClient()
        .from("profiles")
        .upsert(
            {
                id: currentUser.id,
                email: currentUser.email,
                full_name: fullName
            },
            {
                onConflict: "id"
            }
        );

    if (error) {
        throw error;
    }

    const { error: authError } = await getSupabaseClient().auth.updateUser({
        data: {
            name: fullName
        }
    });

    if (authError) {
        console.warn("Nao foi possivel sincronizar o nome no auth metadata:", authError);
    }

    currentProfile.fullName = fullName;
    currentProfile.email = currentUser.email || currentProfile.email;
}

async function saveAccountPasswordIfNeeded() {
    const password = document.getElementById("edit-password").value;
    const confirmation = document.getElementById("edit-password-confirmation").value;

    if (!password && !confirmation) {
        return false;
    }

    if (password.length < 6) {
        throw new Error("A nova senha precisa ter pelo menos 6 caracteres.");
    }

    if (password !== confirmation) {
        throw new Error("A confirmacao da nova senha nao confere.");
    }

    const { error } = await getSupabaseClient().auth.updateUser({
        password
    });

    if (error) {
        throw error;
    }

    document.getElementById("edit-password").value = "";
    document.getElementById("edit-password-confirmation").value = "";
    return true;
}

async function loadMediaKitData() {
    setSyncStatus("Carregando dados...", "loading");
    const cachedPayload = readCachedMediaKitData();

    const { data, error } = await getSupabaseClient()
        .from("media_kits")
        .select("payload")
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if (error) {
        console.error("Falha ao carregar media kit do Supabase:", error);
        mediaKitData = applyProfileDefaults(cachedPayload);
        setSyncStatus("Sem conexao com o Supabase. Usando cache local.", "warning");
        return;
    }

    if (data?.payload) {
        mediaKitData = applyProfileDefaults(data.payload);
        writeCachedMediaKitData(mediaKitData);
        setSyncStatus("Dados sincronizados com o Supabase.", "success");
        return;
    }

    if (cachedPayload) {
        mediaKitData = applyProfileDefaults(cachedPayload);
        const migrated = await saveMediaKitData({
            silent: true,
            successMessage: "Dados locais migrados para o Supabase."
        });
        if (migrated) {
            clearCachedMediaKitData();
        }
        return;
    }

    mediaKitData = applyProfileDefaults(cloneDefaultData());
    setSyncStatus("Usando modelo padrao. Salve para criar seu media kit.", "loading");
}

async function saveMediaKitData(options = {}) {
    const { silent = false, successMessage = "Dados salvos no Supabase." } = options;

    if (!currentUser) {
        return false;
    }

    if (!silent) {
        setSyncStatus("Salvando alteracoes...", "loading");
    }

    const { error } = await getSupabaseClient()
        .from("media_kits")
        .upsert(
            {
                user_id: currentUser.id,
                payload: mediaKitData
            },
            {
                onConflict: "user_id"
            }
        );

    if (error) {
        console.error("Falha ao salvar media kit no Supabase:", error);
        writeCachedMediaKitData(mediaKitData);
        setSyncStatus("Falha ao salvar no Supabase. Dados guardados no cache local.", "warning");
        return false;
    }

    writeCachedMediaKitData(mediaKitData);
    setSyncStatus(successMessage, "success");
    return true;
}

function populateMediaKit() {
    document.querySelector(".dynamic-name").textContent = mediaKitData.name;
    document.querySelector(".dynamic-title").textContent = mediaKitData.title;
    document.querySelector(".dynamic-tags").textContent = mediaKitData.tags;
    document.querySelector(".dynamic-bio").textContent = mediaKitData.bio;
    document.querySelector(".dynamic-firstname").textContent = mediaKitData.name.split(" ")[0] || "Nome";
    document.querySelector(".dynamic-partners-footer").textContent = mediaKitData.partnersFooter;
    document.querySelector(".dynamic-contact-footer").textContent = mediaKitData.contactFooter;

    Object.keys(mediaKitData.images).forEach((key) => {
        const imageElement = document.querySelector(`.dynamic-img-${key}`);
        if (imageElement) {
            imageElement.src = mediaKitData.images[key];
        }
    });

    const statsContainer = document.querySelector(".dynamic-stats");
    statsContainer.innerHTML = mediaKitData.stats.map((stat) => `
        <div class="stat-item">
            <i data-lucide="${stat.icon}"></i>
            <div>
                <span class="label">${stat.label}</span>
                ${stat.value ? `<div class="value">${stat.value}</div>` : ""}
            </div>
        </div>
    `).join("");

    const insightsContainer = document.querySelector(".dynamic-insights");
    if (insightsContainer) {
        insightsContainer.innerHTML = mediaKitData.insights.map((insight) => `
            <div class="insight-item">
                <i data-lucide="${insight.icon}"></i>
                <div>
                    <div class="insight-value">${insight.value || "-"}</div>
                    <div class="insight-label">${insight.label}</div>
                </div>
            </div>
        `).join("");
    }

    const partnersContainer = document.querySelector(".dynamic-partners");
    if (mediaKitData.partners.length > 0) {
        const duplicatedPartners = [...mediaKitData.partners, ...mediaKitData.partners];
        partnersContainer.innerHTML = duplicatedPartners.map((partner) => `
            <div class="partner-logo">
                <img src="${partner.logo}" alt="${partner.name}">
            </div>
        `).join("");
    } else {
        partnersContainer.innerHTML = "";
    }

    const servicesContainer = document.querySelector(".dynamic-services");
    servicesContainer.innerHTML = mediaKitData.services.map((service) => `
        <li><i data-lucide="${service.icon}"></i> ${service.name}</li>
    `).join("");

    const reasonsContainer = document.querySelector(".dynamic-reasons");
    reasonsContainer.innerHTML = mediaKitData.reasons.map((reason) => `
        <li><i data-lucide="${reason.icon}"></i> ${reason.text}</li>
    `).join("");

    const portfolioContainer = document.querySelector(".dynamic-portfolio");
    portfolioContainer.innerHTML = mediaKitData.portfolio.map((item) => {
        const isVideo = item.type === "video";
        if (isVideo) {
            return `
                <div class="portfolio-item">
                    <video src="${item.url}" loop playsinline class="portfolio-media"></video>
                </div>
            `;
        }

        return `
            <div class="portfolio-item">
                <img src="${item.url}" class="portfolio-media" alt="Portfolio item">
            </div>
        `;
    }).join("");

    document.querySelectorAll(".portfolio-item").forEach((item) => {
        const video = item.querySelector("video");
        if (!video) {
            return;
        }

        video.muted = true;
        item.addEventListener("mouseover", () => {
            video.muted = false;
            video.play();
        });
        item.addEventListener("mouseout", () => {
            video.pause();
            video.currentTime = 0;
            video.muted = true;
        });
    });

    const contactsContainer = document.querySelector(".dynamic-contacts");
    contactsContainer.innerHTML = mediaKitData.contacts.map((contact) => `
        <div class="contact-item">
            <i data-lucide="${contact.icon}"></i>
            <span>${contact.value}</span>
        </div>
    `).join("");

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function updateAuthUi(session) {
    const user = session?.user || currentUser;
    const nameElement = document.getElementById("user-name");
    const emailElement = document.getElementById("user-email");
    const logoutButton = document.getElementById("logout-button");
    const displayName = currentProfile.fullName || user?.user_metadata?.name || user?.email || "Conta";

    if (nameElement) {
        nameElement.textContent = displayName;
    }

    if (emailElement) {
        emailElement.textContent = currentProfile.email || user?.email || "";
    }

    if (logoutButton) {
        logoutButton.onclick = async () => {
            logoutButton.disabled = true;
            const { error } = await getSupabaseClient().auth.signOut();
            if (error) {
                alert(error.message);
                logoutButton.disabled = false;
                return;
            }
            window.location.replace("/login.html");
        };
    }
}

async function requireAuthenticatedUser() {
    await window.supabaseReady;

    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error) {
        alert(error.message);
        window.location.replace("/login.html");
        return false;
    }

    const session = data.session;
    if (!session) {
        window.location.replace("/login.html");
        return false;
    }

    currentUser = session.user;
    await loadProfile();
    updateAuthUi(session);

    getSupabaseClient().auth.onAuthStateChange(async (event, nextSession) => {
        if (event === "SIGNED_OUT" || !nextSession) {
            window.location.replace("/login.html");
            return;
        }

        currentUser = nextSession.user;
        await loadProfile();
        updateAuthUi(nextSession);
    });

    return true;
}

function initAdmin() {
    const adminPanel = document.getElementById("admin-panel");
    const toggleButton = document.getElementById("toggle-admin");
    const openAdminButton = document.getElementById("open-admin-button");
    const saveButton = document.getElementById("save-data");
    const resetButton = document.getElementById("reset-data");

    const fillMainInputs = () => {
        document.getElementById("edit-profile-name").value = currentProfile.fullName;
        document.getElementById("edit-profile-email").value = currentProfile.email;
        document.getElementById("edit-password").value = "";
        document.getElementById("edit-password-confirmation").value = "";
        document.getElementById("edit-name").value = mediaKitData.name;
        document.getElementById("edit-title").value = mediaKitData.title;
        document.getElementById("edit-tags").value = mediaKitData.tags;
        document.getElementById("edit-bio").value = mediaKitData.bio;

        Object.keys(mediaKitData.images).forEach((key) => {
            const input = document.getElementById(`edit-img-${key}`);
            if (input) {
                input.value = mediaKitData.images[key];
            }
        });
    };

    const createListEditor = (containerId, dataArray, fields, options = {}) => {
        const container = document.getElementById(containerId);
        container.innerHTML = dataArray.map((item, index) => `
            <div class="admin-list-item">
                <button class="btn-remove-item" data-list="${options.listName}" data-index="${index}">x</button>
                <h5>Item ${index + 1}</h5>
                ${fields.map((field) => {
                    if (options.isPortfolio) {
                        return `
                            <div class="admin-group">
                                <label>${field.label}</label>
                                <input type="text" class="edit-${field.key}" data-index="${index}" value="${item[field.key] || ""}" readonly>
                            </div>
                        `;
                    }

                    return `
                        <div class="admin-group">
                            <label>${field.label}</label>
                            <input type="text" class="edit-${field.key}" data-index="${index}" value="${item[field.key] || ""}">
                        </div>
                    `;
                }).join("")}
            </div>
        `).join("");
    };

    const renderAdminLists = () => {
        createListEditor("edit-services-container", mediaKitData.services, [{ key: "icon", label: "Icone (Lucide)" }, { key: "name", label: "Nome do Servico" }], { listName: "services" });
        createListEditor("edit-reasons-container", mediaKitData.reasons, [{ key: "icon", label: "Icone (Lucide)" }, { key: "text", label: "Texto da Razao" }], { listName: "reasons" });
        createListEditor("edit-partners-container", mediaKitData.partners, [{ key: "name", label: "Nome" }, { key: "logo", label: "URL do Logo" }], { listName: "partners" });
        createListEditor("edit-insights-container", mediaKitData.insights, [{ key: "icon", label: "Icone (Lucide)" }, { key: "label", label: "Nome do dado" }, { key: "value", label: "Numero ou informacao" }], { listName: "insights" });
        createListEditor("edit-portfolio-container", mediaKitData.portfolio, [{ key: "url", label: "Arquivo no Storage" }], { isPortfolio: true, listName: "portfolio" });
        createListEditor("edit-contacts-container", mediaKitData.contacts, [{ key: "icon", label: "Icone (Lucide)" }, { key: "value", label: "Informacao de Contato" }], { listName: "contacts" });
    };

    const openPortfolioUpload = () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*,video/*";
        fileInput.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            try {
                const publicUrl = await uploadAsset(file, "portfolio");
                const type = file.type.startsWith("video") ? "video" : "image";
                mediaKitData.portfolio.push({ type, url: publicUrl });
                renderAdminLists();
                populateMediaKit();
                setSyncStatus("Upload concluido. Clique em salvar para persistir as alteracoes.", "success");
            } catch (error) {
                console.error("Falha ao enviar item do portfolio:", error);
                setSyncStatus("Nao foi possivel enviar o arquivo para o Storage.", "warning");
            }
        };
        fileInput.click();
    };

    const toggleAdminPanel = () => adminPanel.classList.toggle("active");
    const openAdminPanel = () => adminPanel.classList.add("active");

    toggleButton.addEventListener("click", toggleAdminPanel);
    if (openAdminButton) {
        openAdminButton.addEventListener("click", openAdminPanel);
    }

    fillMainInputs();
    renderAdminLists();

    document.querySelectorAll(".edit-img-file").forEach((input) => {
        input.addEventListener("change", async (event) => {
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            const target = event.target.dataset.target;

            try {
                const currentUrl = mediaKitData.images[target];
                const publicUrl = await uploadAsset(file, `images/${target}`, currentUrl);
                mediaKitData.images[target] = publicUrl;
                document.getElementById(`edit-img-${target}`).value = publicUrl;
                populateMediaKit();
                setSyncStatus("Upload concluido. Clique em salvar para persistir as alteracoes.", "success");
            } catch (error) {
                console.error("Falha ao enviar imagem para o Storage:", error);
                setSyncStatus("Nao foi possivel enviar a imagem para o Storage.", "warning");
            } finally {
                event.target.value = "";
            }
        });
    });

    adminPanel.addEventListener("click", (event) => {
        if (!event.target.classList.contains("btn-add")) {
            return;
        }

        const listName = event.target.dataset.list;
        if (!listName || !mediaKitData[listName]) {
            return;
        }

        let newItem = {};
        switch (listName) {
            case "services":
                newItem = { icon: "plus-circle", name: "Novo Servico" };
                break;
            case "reasons":
                newItem = { icon: "plus-circle", text: "Nova Razao" };
                break;
            case "partners":
                newItem = { name: "Nova Marca", logo: "https://via.placeholder.com/150" };
                break;
            case "insights":
                newItem = { icon: "bar-chart-3", label: "Novo insight", value: "+0" };
                break;
            case "portfolio":
                openPortfolioUpload();
                return;
            case "contacts":
                newItem = { icon: "mail", value: "novo@contato.com" };
                break;
            default:
                newItem = {};
        }

        mediaKitData[listName].push(newItem);
        renderAdminLists();
        populateMediaKit();
    });

    adminPanel.addEventListener("click", async (event) => {
        if (!event.target.classList.contains("btn-remove-item")) {
            return;
        }

        const listName = event.target.dataset.list;
        const index = parseInt(event.target.dataset.index, 10);
        if (!listName || !mediaKitData[listName]) {
            return;
        }

        const removedItem = mediaKitData[listName][index];
        mediaKitData[listName].splice(index, 1);
        renderAdminLists();
        populateMediaKit();

        if (listName === "portfolio" && removedItem?.url) {
            await deleteManagedAsset(removedItem.url);
        }
    });

    saveButton.addEventListener("click", async () => {
        saveButton.disabled = true;

        try {
            mediaKitData.name = document.getElementById("edit-name").value.trim();
            mediaKitData.title = document.getElementById("edit-title").value.trim();
            mediaKitData.tags = document.getElementById("edit-tags").value.trim();
            mediaKitData.bio = document.getElementById("edit-bio").value.trim();

            Object.keys(mediaKitData.images).forEach((key) => {
                const input = document.getElementById(`edit-img-${key}`);
                if (input) {
                    mediaKitData.images[key] = input.value.trim();
                }
            });

            const saveList = (containerId, dataArray, fields) => {
                const container = document.getElementById(containerId);
                fields.forEach((field) => {
                    container.querySelectorAll(`.edit-${field.key}`).forEach((input) => {
                        const index = input.dataset.index;
                        if (dataArray[index]) {
                            dataArray[index][field.key] = input.value.trim();
                        }
                    });
                });
            };

            saveList("edit-services-container", mediaKitData.services, [{ key: "icon" }, { key: "name" }]);
            saveList("edit-reasons-container", mediaKitData.reasons, [{ key: "icon" }, { key: "text" }]);
            saveList("edit-partners-container", mediaKitData.partners, [{ key: "name" }, { key: "logo" }]);
            saveList("edit-insights-container", mediaKitData.insights, [{ key: "icon" }, { key: "label" }, { key: "value" }]);
            saveList("edit-contacts-container", mediaKitData.contacts, [{ key: "icon" }, { key: "value" }]);

            await saveProfileData();
            const passwordUpdated = await saveAccountPasswordIfNeeded();
            updateAuthUi();
            populateMediaKit();
            const saved = await saveMediaKitData();

            if (!saved) {
                alert("Nao foi possivel salvar no Supabase. O cache local foi mantido.");
                return;
            }

            alert(passwordUpdated ? "Perfil, senha e Media Kit atualizados com sucesso!" : "Media Kit e perfil atualizados com sucesso!");
        } catch (error) {
            console.error("Falha ao salvar alteracoes:", error);
            alert(error.message || "Nao foi possivel salvar as alteracoes.");
        } finally {
            saveButton.disabled = false;
        }
    });

    resetButton.addEventListener("click", async () => {
        if (!window.confirm("Deseja restaurar os dados padrao?")) {
            return;
        }

        resetButton.disabled = true;

        try {
            await removeManagedAssetsFromMediaKit(mediaKitData);
            mediaKitData = applyProfileDefaults(cloneDefaultData());
            clearCachedMediaKitData();
            const saved = await saveMediaKitData({
                successMessage: "Media kit restaurado para o modelo padrao."
            });

            if (!saved) {
                return;
            }

            window.location.reload();
        } finally {
            resetButton.disabled = false;
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const isAuthenticated = await requireAuthenticatedUser();
        if (!isAuthenticated) {
            return;
        }

        await loadMediaKitData();
        populateMediaKit();
        initAdmin();
    } catch (error) {
        console.error("Falha ao iniciar a aplicacao:", error);
        alert(error.message || "Nao foi possivel iniciar a aplicacao.");
    }
});
