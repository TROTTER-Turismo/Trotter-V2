let map;
let userMarker;
let markers = [];

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    
    // Botão minha localização
    document.getElementById('btn-my-location').addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                const { latitude, longitude } = pos.coords;
                map.setView([latitude, longitude], 15);
                updateUserLocation(latitude, longitude);
            });
        }
    });

    // Fechar detalhe
    document.querySelector('.close-detail').addEventListener('click', () => {
        document.getElementById('place-detail').classList.remove('active');
    });

    // Verificar se veio de um lugar específico
    const urlParams = new URLSearchParams(window.location.search);
    const placeId = urlParams.get('id');
    if (placeId) {
        const place = PLACES.find(p => p.id == placeId);
        if (place) {
            setTimeout(() => {
                map.setView([place.lat, place.lng], 16);
                showPlaceDetail(place);
            }, 500);
        }
    }
});

function initMap() {
    // Inicializa o mapa focado no Brasil por padrão
    map = L.map('map').setView([-15.7801, -47.9292], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Tentar pegar localização real
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                map.setView([latitude, longitude], 14);
                updateUserLocation(latitude, longitude);
                document.getElementById('location-status').innerHTML = '<i class="fas fa-check-circle"></i> Localização ativa';
                
                // Adicionar lugares próximos (simulados baseados na posição do usuário para demonstração)
                addPlacesToMap(latitude, longitude);
            },
            () => {
                document.getElementById('location-status').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Localização negada';
                // Se negado, usa os lugares fixos do data.js
                addPlacesToMap(-23.5505, -46.6333);
            }
        );
    }

    // Custom Icon para o usuário
    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: '<div style="background: #3498db; width: 15px; height: 15px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>',
        iconSize: [15, 15]
    });
}

function updateUserLocation(lat, lng) {
    if (userMarker) {
        userMarker.setLatLng([lat, lng]);
    } else {
        userMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'user-marker',
                html: '<div style="background: #009D71; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(0,157,113,0.5);"></div>',
                iconSize: [20, 20]
            })
        }).addTo(map).bindPopup("Você está aqui");
    }
}

function addPlacesToMap(baseLat, baseLng) {
    // Limpar markers existentes
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    // Usar os lugares do data.js
    // Para fins de demonstração, vamos ajustar as coordenadas para ficarem perto do usuário
    PLACES.forEach((place, index) => {
        // Pequeno offset para espalhar os lugares perto do usuário se estivermos em modo "real"
        const lat = baseLat + (Math.random() - 0.5) * 0.02;
        const lng = baseLng + (Math.random() - 0.5) * 0.02;
        
        const marker = L.marker([lat, lng]).addTo(map);
        marker.on('click', () => showPlaceDetail(place));
        markers.push(marker);
    });
}

function showPlaceDetail(place) {
    const detail = document.getElementById('place-detail');
    const content = detail.querySelector('.detail-content');
    
    content.innerHTML = `
        <div class="detail-img" style="background-image: url('${place.image}')"></div>
        <div class="detail-info">
            <span class="cat-tag">${place.category}</span>
            <h2>${place.name}</h2>
            <p><i class="fas fa-map-marker-alt"></i> ${place.address}</p>
            <div class="detail-actions">
                <button class="btn-primary">Como chegar</button>
                <button class="btn-primary" style="background: #eee; color: #333;">Salvar</button>
            </div>
        </div>
    `;
    
    detail.classList.add('active');
}
