
// ===================================
//  MEDIA KIT "CARMO" - SCRIPT V3 (com upload local)
// ===================================

// Garante que o objeto defaultData use a configuração do config.js
const defaultData = JSON.parse(JSON.stringify(mediaKitConfig));

let mediaKitData = JSON.parse(localStorage.getItem('mediaKitCarmoV2')) || { ...defaultData };

// Função para converter arquivo em Base64
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

function populateMediaKit() {
    // Textos
    document.querySelector('.dynamic-name').textContent = mediaKitData.name;
    document.querySelector('.dynamic-title').textContent = mediaKitData.title;
    document.querySelector('.dynamic-tags').textContent = mediaKitData.tags;
    document.querySelector('.dynamic-bio').textContent = mediaKitData.bio;
    document.querySelector('.dynamic-firstname').textContent = mediaKitData.name.split(' ')[0];
    document.querySelector('.dynamic-partners-footer').textContent = mediaKitData.partnersFooter;
    document.querySelector('.dynamic-contact-footer').textContent = mediaKitData.contactFooter;

    // Imagens
    Object.keys(mediaKitData.images).forEach(key => {
        const imgElement = document.querySelector(`.dynamic-img-${key}`);
        if (imgElement) {
            imgElement.src = mediaKitData.images[key];
        }
    });

    // Stats (Números)
    const statsContainer = document.querySelector('.dynamic-stats');
    statsContainer.innerHTML = mediaKitData.stats.map(stat => `
        <div class="stat-item">
            <i data-lucide="${stat.icon}"></i>
            <div>
                <span class="label">${stat.label}</span>
                ${stat.value ? `<div class="value">${stat.value}</div>` : ''}
            </div>
        </div>
    `).join('');

    // Parceiros (com carrossel)
    const partnersContainer = document.querySelector('.dynamic-partners');
    if (mediaKitData.partners.length > 0) {
        const duplicatedPartners = [...mediaKitData.partners, ...mediaKitData.partners];
        partnersContainer.innerHTML = duplicatedPartners.map(p => `
            <div class="partner-logo">
                <img src="${p.logo}" alt="${p.name}">
            </div>
        `).join('');
    }

    // Serviços
    const servicesContainer = document.querySelector('.dynamic-services');
    servicesContainer.innerHTML = mediaKitData.services.map(s => `
        <li><i data-lucide="${s.icon}"></i> ${s.name}</li>
    `).join('');

    // Razões (Why)
    const reasonsContainer = document.querySelector('.dynamic-reasons');
    reasonsContainer.innerHTML = mediaKitData.reasons.map(r => `
        <li><i data-lucide="${r.icon}"></i> ${r.text}</li>
    `).join('');

    // Portfólio
    const portfolioContainer = document.querySelector('.dynamic-portfolio');
    portfolioContainer.innerHTML = mediaKitData.portfolio.map(item => {
        const isVideo = item.type === 'video' || (item.url && item.url.startsWith('data:video'));
        if (isVideo) {
            return `
                <div class="portfolio-item">
                    <video src="${item.url}" loop playsinline class="portfolio-media"></video>
                </div>
            `;
        } else {
            return `
                <div class="portfolio-item">
                    <img src="${item.url}" class="portfolio-media" alt="Portfolio item">
                </div>
            `;
        }
    }).join('');
    
    document.querySelectorAll('.portfolio-item').forEach(item => {
        const video = item.querySelector('video');
        if (video) {
            video.muted = true; // Garante que o vídeo comece mudo
            item.addEventListener('mouseover', () => {
                video.muted = false;
                video.play();
            });
            item.addEventListener('mouseout', () => {
                video.pause();
                video.currentTime = 0;
                video.muted = true;
            });
        }
    });

    // Contatos
    const contactsContainer = document.querySelector('.dynamic-contacts');
    contactsContainer.innerHTML = mediaKitData.contacts.map(c => `
        <div class="contact-item">
            <i data-lucide="${c.icon}"></i>
            <span>${c.value}</span>
        </div>
    `).join('');

    if (window.lucide) {
        lucide.createIcons();
    }
}

function initAdmin() {
    const adminPanel = document.getElementById('admin-panel');
    const toggleBtn = document.getElementById('toggle-admin');
    const saveBtn = document.getElementById('save-data');
    const resetBtn = document.getElementById('reset-data');
    const addPortfolioBtn = document.getElementById('add-portfolio-item');

    toggleBtn.addEventListener('click', () => adminPanel.classList.toggle('active'));

    // Preencher inputs
    document.getElementById('edit-name').value = mediaKitData.name;
    document.getElementById('edit-title').value = mediaKitData.title;
    document.getElementById('edit-tags').value = mediaKitData.tags;
    document.getElementById('edit-bio').value = mediaKitData.bio;
    
    Object.keys(mediaKitData.images).forEach(key => {
        const input = document.getElementById(`edit-img-${key}`);
        if (input) {
            input.value = mediaKitData.images[key];
        }
    });

    // Lidar com upload de arquivos de imagem
    document.querySelectorAll('.edit-img-file').forEach(input => {
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const base64 = await toBase64(file);
                const target = e.target.dataset.target;
                mediaKitData.images[target] = base64;
                document.getElementById(`edit-img-${target}`).value = `Arquivo local: ${file.name}`;
                populateMediaKit();
            }
        });
    });

    // Gerar campos de edição para listas
    const createListEditor = (containerId, dataArray, fields, options = {}) => {
        const container = document.getElementById(containerId);
        container.innerHTML = dataArray.map((item, index) => `
            <div class="admin-list-item">
                <button class="btn-remove-item" data-list="${options.listName}" data-index="${index}">×</button>
                <h5>Item ${index + 1}</h5>
                ${fields.map(field => {
                    if (options.isPortfolio) {
                        return `
                            <div class="admin-group">
                                <label>URL ou Arquivo</label>
                                <input type="text" class="edit-${field.key}" data-index="${index}" value="${item[field.key].startsWith('data:') ? 'Arquivo local' : item[field.key]}" readonly>
                            </div>`;
                    }
                    return `
                        <div class="admin-group">
                            <label>${field.label}</label>
                            <input type="text" class="edit-${field.key}" data-index="${index}" value="${item[field.key]}">
                        </div>`;
                }).join('')}
            </div>
        `).join('');
    };

    function renderAdminLists() {
        createListEditor('edit-services-container', mediaKitData.services, [{key: 'name', label: 'Nome do Serviço'}], {listName: 'services'});
        createListEditor('edit-reasons-container', mediaKitData.reasons, [{key: 'text', label: 'Texto da Razão'}], {listName: 'reasons'});
        createListEditor('edit-partners-container', mediaKitData.partners, [{key: 'name', label: 'Nome'}, {key: 'logo', label: 'URL do Logo'}], {listName: 'partners'});
        createListEditor('edit-portfolio-container', mediaKitData.portfolio, [{key: 'url', label: 'URL da Mídia'}], {isPortfolio: true, listName: 'portfolio'});
        createListEditor('edit-contacts-container', mediaKitData.contacts, [{key: 'value', label: 'Informação de Contato'}], {listName: 'contacts'});
    }

    renderAdminLists();

    // Adicionar item ao portfólio
    addPortfolioBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*,video/*';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const base64 = await toBase64(file);
                const type = file.type.startsWith('video') ? 'video' : 'image';
                mediaKitData.portfolio.push({ type, url: base64 });
                renderAdminLists();
                populateMediaKit();
            }
        };
        fileInput.click();
    });

    // Remover item de uma lista
    adminPanel.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-item')) {
            const listName = e.target.dataset.list;
            const index = parseInt(e.target.dataset.index, 10);
            if (listName && mediaKitData[listName]) {
                mediaKitData[listName].splice(index, 1);
                renderAdminLists();
                populateMediaKit();
            }
        }
    });

    // Salvar
    saveBtn.addEventListener('click', () => {
        // Salvar textos
        mediaKitData.name = document.getElementById('edit-name').value;
        mediaKitData.title = document.getElementById('edit-title').value;
        mediaKitData.tags = document.getElementById('edit-tags').value;
        mediaKitData.bio = document.getElementById('edit-bio').value;

        // Salvar URLs de imagens (se não for arquivo local)
        Object.keys(mediaKitData.images).forEach(key => {
            const input = document.getElementById(`edit-img-${key}`);
            if (input && !input.value.startsWith('Arquivo local:')) {
                mediaKitData.images[key] = input.value;
            }
        });

        // Salvar listas
        const saveList = (containerId, dataArray, fields) => {
            const container = document.getElementById(containerId);
            fields.forEach(field => {
                container.querySelectorAll(`.edit-${field.key}`).forEach(input => {
                    const index = input.dataset.index;
                    if (dataArray[index] && !input.value.startsWith('Arquivo local')) {
                       dataArray[index][field.key] = input.value;
                    }
                });
            });
        };

        saveList('edit-services-container', mediaKitData.services, [{key: 'name'}]);
        saveList('edit-reasons-container', mediaKitData.reasons, [{key: 'text'}]);
        saveList('edit-partners-container', mediaKitData.partners, [{key: 'name'}, {key: 'logo'}]);
        saveList('edit-contacts-container', mediaKitData.contacts, [{key: 'value'}]);

        localStorage.setItem('mediaKitCarmoV2', JSON.stringify(mediaKitData));
        populateMediaKit();
        alert('Media Kit atualizado com sucesso! 🚀');
    });

    // Resetar
    resetBtn.addEventListener('click', () => {
        if (confirm('Deseja restaurar os dados padrão? Isso removerá todos os uploads locais.')) {
            localStorage.removeItem('mediaKitCarmoV2');
            mediaKitData = { ...defaultData };
            populateMediaKit();
            initAdmin(); // Reinicia o painel de admin
            alert('Dados restaurados!');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    populateMediaKit();
    initAdmin();
});