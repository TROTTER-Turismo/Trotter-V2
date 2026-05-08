document.addEventListener('DOMContentLoaded', () => {
    // Verificar se usuário está logado
    const currentUser = JSON.parse(localStorage.getItem('trotter_current_user'));
    if (!currentUser && !window.location.pathname.includes('index.html') && !window.location.pathname.includes('register.html')) {
        window.location.href = '../index.html';
        return;
    }

    // Atualizar nome do usuário
    const userNameEl = document.getElementById('user-name');
    if (userNameEl && currentUser) {
        userNameEl.textContent = `Olá, ${currentUser.name.split(' ')[0]}`;
    }

    // Renderizar cards em destaque (Home)
    const featuredGrid = document.getElementById('featured-places');
    if (featuredGrid) {
        renderPlaces(PLACES.slice(0, 3), featuredGrid);
    }

    // Lógica da página de Exploração
    const exploreGrid = document.getElementById('explore-places');
    if (exploreGrid) {
        const urlParams = new URLSearchParams(window.location.search);
        const catFilter = urlParams.get('cat');
        
        let filtered = PLACES;
        if (catFilter) {
            filtered = PLACES.filter(p => p.category === catFilter);
            // Ativar botão de filtro correspondente
            const btn = document.querySelector(`[data-filter="${catFilter}"]`);
            if (btn) btn.classList.add('active');
        } else {
            document.querySelector('[data-filter="all"]')?.classList.add('active');
        }

        renderPlaces(filtered, exploreGrid);

        // Eventos de filtro
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filter = btn.getAttribute('data-filter');
                const result = filter === 'all' ? PLACES : PLACES.filter(p => p.category === filter);
                renderPlaces(result, exploreGrid);
            });
        });
    }
});

function renderPlaces(places, container) {
    container.innerHTML = '';
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
