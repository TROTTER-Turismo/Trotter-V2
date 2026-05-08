/**
 * Serviço para buscar lugares reais usando a Overpass API (OpenStreetMap)
 */
export const PlacesService = {
    /**
     * Busca lugares próximos com base na latitude, longitude e raio
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {number} radius - Raio em metros
     * @param {string} category - Categoria (comer, dormir, visitar, all)
     */
    async fetchNearbyPlaces(lat, lon, radius, category = 'all') {
        const categories = {
            'comer': '["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream"]',
            'dormir': '["tourism"~"hotel|hostel|guest_house|motel|apartment"]',
            'visitar': '["tourism"~"museum|viewpoint|attraction|artwork|gallery|zoo|theme_park"]',
            'all': '["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream"] ["tourism"~"hotel|hostel|guest_house|motel|apartment|museum|viewpoint|attraction|artwork|gallery|zoo|theme_park"]'
        };

        let query = '';
        if (category === 'all') {
            query = `
                [out:json][timeout:25];
                (
                  node["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream"](around:${radius},${lat},${lon});
                  way["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream"](around:${radius},${lat},${lon});
                  node["tourism"~"hotel|hostel|guest_house|motel|apartment|museum|viewpoint|attraction|artwork|gallery|zoo|theme_park"](around:${radius},${lat},${lon});
                  way["tourism"~"hotel|hostel|guest_house|motel|apartment|museum|viewpoint|attraction|artwork|gallery|zoo|theme_park"](around:${radius},${lat},${lon});
                );
                out body;
                >;
                out skel qt;
            `;
        } else {
            const filter = categories[category];
            query = `
                [out:json][timeout:25];
                (
                  node${filter}(around:${radius},${lat},${lon});
                  way${filter}(around:${radius},${lat},${lon});
                );
                out body;
                >;
                out skel qt;
            `;
        }

        try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query
            });

            if (!response.ok) throw new Error('Erro na resposta da API');

            const data = await response.json();
            return this.formatOverpassData(data.elements, category);
        } catch (error) {
            console.error('Erro ao buscar lugares:', error);
            return [];
        }
    },

    /**
     * Formata os dados brutos da Overpass API para o formato do Trotter
     */
    formatOverpassData(elements, requestedCategory) {
        const places = [];
        const nodes = {};

        // Primeiro, mapeia todos os nodes para referência de coordenadas em ways
        elements.forEach(el => {
            if (el.type === 'node') nodes[el.id] = { lat: el.lat, lon: el.lon };
        });

        elements.forEach(el => {
            if (el.tags && (el.tags.name || el.tags.brand)) {
                let lat = el.lat;
                let lon = el.lon;

                // Se for um 'way', calcula o centro aproximado
                if (el.type === 'way' && el.nodes) {
                    let sumLat = 0, sumLon = 0, count = 0;
                    el.nodes.forEach(nodeId => {
                        if (nodes[nodeId]) {
                            sumLat += nodes[nodeId].lat;
                            sumLon += nodes[nodeId].lon;
                            count++;
                        }
                    });
                    if (count > 0) {
                        lat = sumLat / count;
                        lon = sumLon / count;
                    }
                }

                if (lat && lon) {
                    const category = this.determineCategory(el.tags);
                    places.push({
                        id: el.id,
                        name: el.tags.name || el.tags.brand || 'Lugar sem nome',
                        category: category,
                        lat: lat,
                        lng: lon,
                        address: el.tags['addr:street'] ? `${el.tags['addr:street']}, ${el.tags['addr:housenumber'] || ''}` : 'Endereço não disponível',
                        rating: (Math.random() * (5.0 - 3.5) + 3.5).toFixed(1), // Simulação de rating já que OSM não tem
                        image: this.getRandomImage(category)
                    });
                }
            }
        });

        return places;
    },

    determineCategory(tags) {
        if (tags.amenity && /restaurant|cafe|fast_food|bar|pub|ice_cream/.test(tags.amenity)) return 'comer';
        if (tags.tourism && /hotel|hostel|guest_house|motel|apartment/.test(tags.tourism)) return 'dormir';
        return 'visitar';
    },

    getRandomImage(category) {
        const images = {
            'comer': [
                'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80',
                'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=500&q=80',
                'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=80'
            ],
            'dormir': [
                'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80',
                'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=500&q=80',
                'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=500&q=80'
            ],
            'visitar': [
                'https://images.unsplash.com/photo-1585829365291-1782bd5a3d4a?w=500&q=80',
                'https://images.unsplash.com/photo-1518998053502-53cc8ef411c2?w=500&q=80',
                'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=500&q=80'
            ]
        };
        const list = images[category] || images['visitar'];
        return list[Math.floor(Math.random() * list.length)];
    }
};
