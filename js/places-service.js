export const PlacesService = {
    FOURSQUARE_API_KEY: 'NXS0K1J0CAENODMNPBMOHPRN01AQF3KMNY0PQK4NLFZMQLHJ', 

    async fetchNearbyPlaces(lat, lon, radius, category = 'all') {
        const categories = {
            'comer': '["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|bakery"]',
            'dormir': '["tourism"~"hotel|hostel|guest_house|motel|apartment|camp_site|chalet"]',
            'visitar': '["tourism"~"museum|viewpoint|attraction|artwork|gallery|zoo|theme_park|picnic_site|park"]',
            'all': '["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|bakery"] ["tourism"~"hotel|hostel|guest_house|motel|apartment|camp_site|chalet|museum|viewpoint|attraction|artwork|gallery|zoo|theme_park|picnic_site|park"]'
        };

        let query = '';
        if (category === 'all') {
            query = `
                [out:json][timeout:30];
                (
                  node["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|bakery"](around:${radius},${lat},${lon});
                  way["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|bakery"](around:${radius},${lat},${lon});
                  node["tourism"~"hotel|hostel|guest_house|motel|apartment|camp_site|chalet|museum|viewpoint|attraction|artwork|gallery|zoo|theme_park|picnic_site|park"](around:${radius},${lat},${lon});
                  way["tourism"~"hotel|hostel|guest_house|motel|apartment|camp_site|chalet|museum|viewpoint|attraction|artwork|gallery|zoo|theme_park|picnic_site|park"](around:${radius},${lat},${lon});
                );
                out center;
            `;
        } else {
            const filter = categories[category];
            query = `
                [out:json][timeout:30];
                (
                  node${filter}(around:${radius},${lat},${lon});
                  way${filter}(around:${radius},${lat},${lon});
                );
                out center;
            `;
        }

        try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query
            });

            if (!response.ok) throw new Error('Erro na Overpass API');

            const data = await response.json();
            const places = this.formatOverpassData(data.elements);
            
            // Tentar buscar fotos reais se houver chave do Foursquare
            if (this.FOURSQUARE_API_KEY && places.length > 0) {
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
        const enriched = await Promise.all(places.slice(0, 10).map(async (place) => {
            try {
                const searchUrl = `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(place.name)}&ll=${place.lat},${place.lng}&radius=100&limit=1`;
                const res = await fetch(searchUrl, {
                    headers: { 'Authorization': this.FOURSQUARE_API_KEY }
                });
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
                console.warn('Erro ao buscar foto real:', e);
            }
            return place;
        }));
        
        return [...enriched, ...places.slice(10)];
    }
};
