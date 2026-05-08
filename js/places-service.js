/**
 * Serviço para buscar lugares reais usando a Overpass API (OpenStreetMap)
 * e fotos reais via Foursquare API (Opcional)
 */
export const PlacesService = {
    // Chave do Foursquare (Deve começar com fsq3...)
    FOURSQUARE_API_KEY: 'SQNPWLHZQQ04OQLOXJJTM1NQSCQFETG0Y22T5VKTYGYKBVSO', 

    /**
     * Busca lugares próximos com base na latitude, longitude e raio
     */
    async fetchNearbyPlaces(lat, lon, radius, category = 'all') {
        const categories = {
            'comer': '["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|bakery"]',
            'dormir': '["tourism"~"hotel|hostel|guest_house|motel|apartment|camp_site|chalet"]',
            'visitar': '["tourism"~"museum|viewpoint|attraction|artwork|gallery|zoo|theme_park|picnic_site|park"]',
            'all': '["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|bakery"] ["tourism"~"hotel|hostel|guest_house|motel|apartment|camp_site|chalet|museum|viewpoint|attraction|artwork|gallery|zoo|theme_park|picnic_site|park"]'
        };

        let query = `
            [out:json][timeout:30];
            (
              node${category === 'all' ? categories['all'] : categories[category]}(around:${radius},${lat},${lon});
              way${category === 'all' ? categories['all'] : categories[category]}(around:${radius},${lat},${lon});
            );
            out center;
        `;

        try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query
            });

            if (!response.ok) throw new Error('Erro na Overpass API');

            const data = await response.json();
            const places = this.formatOverpassData(data.elements);
            
            // Só tenta enriquecer se a chave parecer válida (começa com fsq3)
            if (this.FOURSQUARE_API_KEY && this.FOURSQUARE_API_KEY.startsWith('fsq3')) {
                return await this.enrichWithFoursquarePhotos(places);
            }

            return places;
        } catch (error) {
            console.error('Erro ao buscar lugares:', error);
            return [];
        }
    },

    formatOverpassData(elements) {
        return elements.map(el => {
            const lat = el.lat || (el.center ? el.center.lat : null);
            const lon = el.lon || (el.center ? el.center.lon : null);
            const tags = el.tags || {};

            if (!lat || !lon) return null;

            const category = this.determineCategory(tags);
            return {
                id: el.id,
                name: tags.name || tags.brand || tags['addr:housename'] || 'Lugar sem nome',
                category: category,
                lat: lat,
                lng: lon,
                address: tags['addr:street'] ? `${tags['addr:street']}, ${tags['addr:housenumber'] || ''}` : 'Endereço não disponível',
                rating: (Math.random() * (5.0 - 4.0) + 4.0).toFixed(1),
                image: this.getPlaceholderImage(category)
            };
        }).filter(p => p !== null);
    },

    determineCategory(tags) {
        if (tags.amenity && /restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|bakery/.test(tags.amenity)) return 'comer';
        if (tags.tourism && /hotel|hostel|guest_house|motel|apartment|camp_site|chalet/.test(tags.tourism)) return 'dormir';
        return 'visitar';
    },

    getPlaceholderImage(category) {
        const images = {
            'comer': 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80',
            'dormir': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80',
            'visitar': 'https://images.unsplash.com/photo-1585829365291-1782bd5a3d4a?w=500&q=80'
        };
        return images[category];
    },

    async enrichWithFoursquarePhotos(places) {
        const enriched = await Promise.all(places.slice(0, 8).map(async (place) => {
            try {
                const searchUrl = `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(place.name)}&ll=${place.lat},${place.lng}&radius=150&limit=1`;
                const res = await fetch(searchUrl, {
                    headers: { 'Authorization': this.FOURSQUARE_API_KEY }
                });
                
                if (res.status === 401) {
                    console.warn('Chave do Foursquare inválida ou expirada.');
                    return place;
                }

                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    const fsqId = data.results[0].fsq_id;
                    const photoRes = await fetch(`https://api.foursquare.com/v3/places/${fsqId}/photos?limit=1`, {
                        headers: { 'Authorization': this.FOURSQUARE_API_KEY }
                    });
                    const photoData = await photoRes.json();
                    if (photoData.length > 0) {
                        place.image = `${photoData[0].prefix}500x300${photoData[0].suffix}`;
                    }
                }
            } catch (e) {
                // Silencioso para não poluir o console do usuário
            }
            return place;
        }));
        return [...enriched, ...places.slice(8)];
    }
};
