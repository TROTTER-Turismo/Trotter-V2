import { PlacesService } from "./places-service.js";

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar se usuário está logado
    const currentUser = JSON.parse(localStorage.getItem('trotter_current_user'));
    if (!currentUser && !window.location.pathname.includes('index.html') && !window.location.pathname.includes('register.html')) {
        window.location.href = '../index.html';
        return;
    }
    const userNameEl = document.getElementById('user-name');
    if (userNameEl && currentUser) {
        userNameEl.textContent = `Olá, ${currentUser.name.split(' ')[0]}`;
    }
    const featuredGrid = document.getElementById('featured-places');
    const exploreGrid = document.getElementById('explore-places');
    if (featuredGrid || exploreGrid) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            
            if (featuredGrid) {
                const places = await PlacesService.fetchNearbyPlaces(latitude, longitude, 5000, 'all');
                renderPlaces(places.slice(0, 6), featuredGrid);
            }
            if (exploreGrid) {
                const urlParams = new URLSearchParams(window.location.search);
                const catFilter = urlParams.get('cat') || 'all';
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    if (btn.dataset.filter === catFilter) btn.classList.add('active');
                    else btn.classList.remove('active');
                });
                const places = await PlacesService.fetchNearbyPlaces(latitude, longitude, 10000, catFilter);
                renderPlaces(places, exploreGrid);
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        const filter = btn.getAttribute('data-filter');
                        exploreGrid.innerHTML = '<div class="loading-state"><div class="spinner-small"></div><p>Buscando lugares...</p></div>';
                        const result = await PlacesService.fetchNearbyPlaces(latitude, longitude, 10000, filter);
                        renderPlaces(result, exploreGrid);
                    });
                });
            }
        }, async () => {
            const lat = -23.5505, lon = -46.6333;
            if (featuredGrid) {
                const places = await PlacesService.fetchNearbyPlaces(lat, lon, 5000, 'all');
                renderPlaces(places.slice(0, 6), featuredGrid);
            }
            if (exploreGrid) {
                const places = await PlacesService.fetchNearbyPlaces(lat, lon, 10000, 'all');
                renderPlaces(places, exploreGrid);
            }
        });
    }
});

function renderPlaces(places, container) {
    container.innerHTML = '';
    if (places.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhum lugar encontrado nesta região.</p>';
        return;
    }
    places.forEach(place => {
        const card = document.createElement('div');
        card.className = 'place-card';
        card.innerHTML = `
            <div class="place-img" style="background-image: url('${place.image}')">
                <span class="place-tag">${place.category}</span>
            </div>
            <div class="place-info">
                <h3>${place.name}</h3>
                <p class="place-location"><i class="fas fa-map-marker-alt"></i> ${place.address}</p>
                <div class="place-footer">
                    <span class="rating"><i class="fas fa-star"></i> ${place.rating}</span>
                    <button class="btn-primary" onclick="window.location.href='map.html?id=${place.id}'" style="padding: 5px 15px; font-size: 0.8rem;">Ver no Mapa</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}
