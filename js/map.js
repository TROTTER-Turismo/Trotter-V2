import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { PlacesService } from "./places-service.js";

const S = {
    mapa: null,
    user: null,
    lat: null,
    lon: null,
    radius: 5000, 
    categoria: 'all',
    marcadores: [],
    userMarker: null,
    lugares: []
};

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (user) {
            S.user = user;
            preencherNavbar(user);
            initApp();
        }
    });
});

function initApp() {
    iniciarMapa();
    pedirLocalizacao();
    iniciarEventos();
}

function iniciarMapa() {
    if (S.mapa) return;
    S.mapa = L.map('map', { zoomControl: false }).setView([-15.7801, -47.9292], 4);
    L.control.zoom({ position: 'bottomright' }).addTo(S.mapa);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(S.mapa);
}

function pedirLocalizacao() {
    const status = document.getElementById('location-status');
    
    if (!navigator.geolocation) {
        if (status) status.textContent = 'Geolocalização não suportada.';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async pos => {
            S.lat = pos.coords.latitude;
            S.lon = pos.coords.longitude;
            if (status) status.style.display = 'none';
            
            atualizarMarcadorUsuario();
            S.mapa.setView([S.lat, S.lon], 14);
            
            await buscarLugares();
        },
        async err => {
            console.warn('Erro geo:', err.message);
            if (status) status.innerHTML = '⚠️ Localização negada';
            S.lat = -23.5505;
            S.lon = -46.6333;
            await buscarLugares();
        },
        { enableHighAccuracy: true }
    );
}

function atualizarMarcadorUsuario() {
    if (S.userMarker) {
        S.userMarker.setLatLng([S.lat, S.lon]);
    } else {
        const userIcon = L.divIcon({
            className: 'user-marker',
            html: '<div style="background: #009D71; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>',
            iconSize: [18, 18]
        });
        S.userMarker = L.marker([S.lat, S.lon], { icon: userIcon }).addTo(S.mapa).bindPopup("Você está aqui");
    }
}

async function buscarLugares() {
    mostrarLoading(true);

    S.lugares = await PlacesService.fetchNearbyPlaces(S.lat, S.lon, S.radius, S.categoria);
    
    renderizarCards();
    renderizarMarcadores();
    mostrarLoading(false);
}

function mostrarLoading(on) {
    const lista = document.getElementById('lista-lugares');
    if (!lista) return;
    
    if (on) {
        lista.innerHTML = `
            <div class="loading-state">
                <div class="spinner-small"></div>
                <p>Buscando lugares reais em um raio de ${S.radius/1000}km...</p>
            </div>`;
    }
}

function renderizarCards() {
    const lista = document.getElementById('lista-lugares');
    if (!lista) return;

    const busca = document.getElementById('busca-input')?.value.toLowerCase() || '';
    
    const filtrados = S.lugares.filter(p => {
        const matchBusca = p.name.toLowerCase().includes(busca) || p.address.toLowerCase().includes(busca);
        return matchBusca;
    });

    if (filtrados.length === 0) {
        lista.innerHTML = '<div class="loading-state"><p>Nenhum lugar encontrado nesta região.</p></div>';
        return;
    }

    lista.innerHTML = '';
    filtrados.forEach(p => {
        const card = document.createElement('div');
        card.className = 'lugar-card';
        card.innerHTML = `
            <div class="lugar-card__img" style="background-image: url('${p.image}')"></div>
            <div class="lugar-card__info">
                <div class="lugar-card__tipo">${p.category}</div>
                <div class="lugar-card__nome">${p.name}</div>
                <div class="lugar-card__end">${p.address}</div>
            </div>
        `;
        card.onclick = () => {
            S.mapa.setView([p.lat, p.lng], 16);
            const m = S.marcadores.find(m => m._id === p.id);
            if (m) m.openPopup();
        };
        lista.appendChild(card);
    });
}

function renderizarMarcadores() {
    S.marcadores.forEach(m => S.mapa.removeLayer(m));
    S.marcadores = [];

    S.lugares.forEach(p => {
        const marker = L.marker([p.lat, p.lng]).addTo(S.mapa);
        marker._id = p.id;
        marker.bindPopup(`
            <div style="width: 150px">
                <img src="${p.image}" style="width: 100%; border-radius: 8px; margin-bottom: 8px">
                <b style="display: block; margin-bottom: 4px">${p.name}</b>
                <small>${p.address}</small>
            </div>
        `);
        S.marcadores.push(marker);
    });
}

function iniciarEventos() {
    const sidebar = document.querySelector('.sidebar');
    sidebar?.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('expanded');
        }
    });

    document.getElementById('busca-input')?.addEventListener('input', renderizarCards);

    document.querySelectorAll('.cat-tab').forEach(tab => {
        tab.addEventListener('click', async (e) => {
            e.stopPropagation(); // Evita fechar painel no mobile
            document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('ativo'));
            tab.classList.add('ativo');
            S.categoria = tab.dataset.cat;
            await buscarLugares();
        });
    });

    document.getElementById('select-raio')?.addEventListener('change', async (e) => {
        S.radius = parseInt(e.target.value);
        await buscarLugares();
    });

    document.getElementById('btn-atualizar')?.addEventListener('click', buscarLugares);

    const btnSearchHere = document.getElementById('btn-search-here');
    S.mapa.on('moveend', () => {
        const center = S.mapa.getCenter();
        btnSearchHere.style.display = 'flex';
    });

    btnSearchHere?.addEventListener('click', async () => {
        const center = S.mapa.getCenter();
        S.lat = center.lat;
        S.lon = center.lng;
        btnSearchHere.style.display = 'none';
        await buscarLugares();
    });

    document.getElementById('btn-my-location')?.addEventListener('click', () => {
        if (S.lat) S.mapa.setView([S.lat, S.lon], 15);
    });

    const modal = document.getElementById('modal-logout');
    document.getElementById('btn-logout-trigger')?.addEventListener('click', () => modal.classList.add('visible'));
    document.getElementById('modal-cancel')?.addEventListener('click', () => modal.classList.remove('visible'));
    document.getElementById('modal-confirm')?.addEventListener('click', () => {
        window.logout();
    });
}

function preencherNavbar(user) {
    const nome = user.displayName || user.email.split('@')[0];
    const el = document.getElementById('user-name');
    if (el) el.textContent = nome;
    
    const av = document.getElementById('user-avatar');
    if (av) {
        if (user.photoURL) {
            av.innerHTML = `<img src="${user.photoURL}" alt="${nome}">`;
        } else {
            av.textContent = nome.charAt(0).toUpperCase();
        }
    }
}
