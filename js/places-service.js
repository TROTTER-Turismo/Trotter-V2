// =============================================================
// places-service.js
// • Busca lugares via Overpass API (OpenStreetMap)
// • Fotos reais via:  1) tag image do OSM
//                     2) Wikidata → Wikimedia Commons
//                     3) Wikipedia thumbnail
//                     4) Unsplash curado por categoria (fallback)
// =============================================================

// ── Servidores Overpass (fallback automático) ─────────────────
const OVERPASS_SERVERS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

// ── Fotos Unsplash curadas por tipo (sem API key) ─────────────
// IDs de fotos públicas do Unsplash selecionadas por categoria
const UNSPLASH = {
    restaurant : ['1414235077428-338989a2e8c0','1517248135467-4c7edcad34c4','1552566626-52f8b828add9','1559339352-11d035aa65de','1424847651672-bf20a4b0982b','1565299624946-b28f40a0ae38','1544025162-d76538c72b1a'],
    cafe       : ['1501339847302-ac426a4a7cbb','1495474472287-4d71bcdd2085','1509042239860-f550ce710b93','1511920183353-8a2e87640e58','1442975631134-67e1c041e0a6'],
    bar        : ['1575444758702-4a6b9222336e','1572116469696-31de0f17cc34','1543253135-7b9e1ebb17f5','1470337458703-83c1c0bc6ef2'],
    pub        : ['1575444758702-4a6b9222336e','1543253135-7b9e1ebb17f5','1507671238675-ec40e8daa78d'],
    fast_food  : ['1561758033-d89a2468ea3e','1568901346375-b53157f60c43','1550547660-d9054cb7f375'],
    bakery     : ['1509440159596-0249088772ff','1486887396153-fa416526c108','1555507036-ab794e1e0c06'],
    ice_cream  : ['1501443762994-1c15c4c4d8d4','1580367340394-40ef05e18069'],
    hotel      : ['1566073771259-6a8506099945','1582719478250-c89cae4dc85b','1445019980597-93fa8acb246c','1587985063135-eb0f00aed99c','1520250497591-112f2f40a3f4'],
    hostel     : ['1555854877-bab93d396a51','1520250497591-112f2f40a3f4','1631049307264-da0ec9d70304'],
    guest_house: ['1566073771259-6a8506099945','1582719478250-c89cae4dc85b','1455587734955-081b22074882'],
    motel      : ['1566073771259-6a8506099945','1445019980597-93fa8acb246c'],
    camp_site  : ['1504280390367-361c6d9f38f4','1445116778267-3a2b07ab4b6d','1528360983277-13d401cdc186'],
    museum     : ['1518998053901-5348d3961a04','1554907984-15263bfd63bd','1526481280693-3bfa7568e0f3','1541367777-065528ea6d42'],
    attraction : ['1476514525535-07fb3b4ae5f1','1469854523086-cc02fe5d8800','1506905925346-21bda4d32df4','1551918120-9739cb430f5f'],
    viewpoint  : ['1506905925346-21bda4d32df4','1469854523086-cc02fe5d8800','1464822759023-fed622ff2c3b','1501854140801-50d01698950b'],
    park       : ['1501854140801-50d01698950b','1519331379826-f10be5486c6f','1448375240586-882707db888b','1441974231531-c6227db76b6e'],
    garden     : ['1416879595882-3373a0480b5b','1530836176759-510136704678','1464820453369-31d2d382ad97'],
    historic   : ['1539768942893-daf2b0a9c2f7','1467269204519-e3a17a59aae8','1548013146-8e07c1eb3a91','1558618666-fcd25c85cd64'],
    theatre    : ['1507924538820-ede94a04019d','1581281292462-6e31756a6f77'],
    cinema     : ['1489599849927-2ee91cede3ba','1440404653325-ab127d49abc1'],
    gallery    : ['1544967082-d9d25d867d66','1531243866928-19546055dfd3'],
    zoo        : ['1534567153574-4fb4e4b89498','1474511320723-9a56873867b5'],
    default    : ['1476514525535-07fb3b4ae5f1','1501854140801-50d01698950b','1469854523086-cc02fe5d8800','1506905925346-21bda4d32df4']
};

// ── Definições de categoria ───────────────────────────────────
export const CATEGORIES = {
    comer   : { label: 'Comer',   emoji: '🍽️', cor: '#009D71' },
    dormir  : { label: 'Dormir',  emoji: '🛏️', cor: '#2563eb' },
    visitar : { label: 'Visitar', emoji: '🗺️', cor: '#d97706' }
};

// ── Distância Haversine ───────────────────────────────────────
export function calcDist(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2
            + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180)
            * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function formatDist(km) {
    return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

// ── Hash simples para índice consistente ─────────────────────
function hashId(id) {
    let h = 0;
    const s = String(id);
    for (let i = 0; i < s.length; i++) {
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

// ── Normalizar elemento Overpass → objeto place ───────────────
export function normalizePlace(el, userLat, userLon) {
    const t   = el.tags || {};
    const lat = el.lat  ?? el.center?.lat;
    const lon = el.lon  ?? el.center?.lon;
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) return null;

    // detectar categoria e tipo
    let category = 'visitar', type = '', subtype = '';

    const am = t.amenity   || '';
    const tu = t.tourism   || '';
    const hi = t.historic  || '';
    const le = t.leisure   || '';

    if      (am === 'restaurant') { category='comer';  type='Restaurante'; subtype='restaurant'; }
    else if (am === 'cafe')       { category='comer';  type='Café';         subtype='cafe'; }
    else if (am === 'fast_food')  { category='comer';  type='Lanchonete';   subtype='fast_food'; }
    else if (am === 'bar')        { category='comer';  type='Bar';          subtype='bar'; }
    else if (am === 'pub')        { category='comer';  type='Pub';          subtype='pub'; }
    else if (am === 'bakery')     { category='comer';  type='Padaria';      subtype='bakery'; }
    else if (am === 'ice_cream')  { category='comer';  type='Sorveteria';   subtype='ice_cream'; }
    else if (am === 'food_court') { category='comer';  type='Praça Alimentação'; subtype='restaurant'; }
    else if (tu === 'hotel')      { category='dormir'; type='Hotel';        subtype='hotel'; }
    else if (tu === 'hostel')     { category='dormir'; type='Hostel';       subtype='hostel'; }
    else if (tu === 'guest_house'){ category='dormir'; type='Pousada';      subtype='guest_house'; }
    else if (tu === 'motel')      { category='dormir'; type='Motel';        subtype='motel'; }
    else if (tu === 'apartment')  { category='dormir'; type='Apartamento';  subtype='hotel'; }
    else if (tu === 'camp_site')  { category='dormir'; type='Camping';      subtype='camp_site'; }
    else if (tu === 'attraction') { category='visitar';type='Atração';      subtype='attraction'; }
    else if (tu === 'museum')     { category='visitar';type='Museu';        subtype='museum'; }
    else if (tu === 'viewpoint')  { category='visitar';type='Mirante';      subtype='viewpoint'; }
    else if (tu === 'gallery')    { category='visitar';type='Galeria';      subtype='gallery'; }
    else if (tu === 'zoo')        { category='visitar';type='Zoológico';    subtype='zoo'; }
    else if (tu === 'aquarium')   { category='visitar';type='Aquário';      subtype='zoo'; }
    else if (tu === 'theme_park') { category='visitar';type='Parque Temático'; subtype='attraction'; }
    else if (hi)                  { category='visitar';type='Local Histórico';  subtype='historic'; }
    else if (le === 'park')       { category='visitar';type='Parque';       subtype='park'; }
    else if (le === 'garden')     { category='visitar';type='Jardim';       subtype='garden'; }
    else if (le === 'nature_reserve'){category='visitar';type='Reserva Natural'; subtype='park'; }
    else if (am === 'theatre')    { category='visitar';type='Teatro';       subtype='theatre'; }
    else if (am === 'cinema')     { category='visitar';type='Cinema';       subtype='cinema'; }
    else if (am === 'arts_centre'){ category='visitar';type='Centro Cultural'; subtype='gallery'; }

    if (!type) return null; // sem tipo reconhecido

    const nome    = t.name || t['name:pt'] || type;
    const cuisine = t.cuisine?.replace(/_/g,' ') || '';
    const stars   = t.stars   ? `${t.stars}★` : '';
    const subtitle= cuisine || stars || '';

    // foto direta no OSM
    let osmImage = null;
    if (t.image && /^https?:\/\//.test(t.image))      osmImage = t.image;
    if (t['contact:website_photo'])                    osmImage = t['contact:website_photo'];

    return {
        id        : el.id,
        nome,
        type,
        subtype,
        subtitle,
        category,
        lat, lon,
        dist      : calcDist(userLat, userLon, lat, lon),
        tel       : t.phone || t['contact:phone'] || '',
        site      : t.website || t['contact:website'] || '',
        horas     : t.opening_hours || '',
        endereco  : [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', '),
        wikidata  : t.wikidata || '',
        wikipedia : t.wikipedia || '',
        wikimediaCommons: t.wikimedia_commons || '',
        osmImage,
        // foto resolvida depois
        photo     : null,
        photoLoaded: false
    };
}

// ── Foto: Wikidata → Wikimedia Commons ───────────────────────
async function fetchWikidataPhoto(wikidataId) {
    try {
        const resp = await fetch(
            `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`,
            { signal: AbortSignal.timeout(4000) }
        );
        if (!resp.ok) return null;
        const data = await resp.json();
        const entity = data.entities?.[wikidataId];
        const imgName = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
        if (!imgName) return null;
        const enc = encodeURIComponent(imgName.replace(/ /g,'_'));
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${enc}?width=400`;
    } catch { return null; }
}

// ── Foto: Wikipedia thumbnail ─────────────────────────────────
async function fetchWikipediaPhoto(wpTag) {
    try {
        const parts = wpTag.split(':');
        const lang  = parts.length > 1 ? parts[0] : 'pt';
        const title = parts.length > 1 ? parts.slice(1).join(':') : parts[0];
        const resp  = await fetch(
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
            { signal: AbortSignal.timeout(4000) }
        );
        if (!resp.ok) return null;
        const data = await resp.json();
        return data.thumbnail?.source || null;
    } catch { return null; }
}

// ── Foto: Wikimedia Commons direto ───────────────────────────
async function fetchCommonsPhoto(commonsTag) {
    // wikimedia_commons pode ser "File:SomeName.jpg" ou "Category:SomeCat"
    if (!commonsTag.startsWith('File:')) return null;
    try {
        const title = commonsTag; // e.g. "File:Foo.jpg"
        const enc   = encodeURIComponent(title.replace(/ /g,'_'));
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${enc.replace('File%3A','')}?width=400`;
    } catch { return null; }
}

// ── Foto Unsplash curada (fallback, sem API key) ──────────────
function unsplashPhoto(place) {
    const set = UNSPLASH[place.subtype] || UNSPLASH[place.type?.toLowerCase()] || UNSPLASH.default;
    const idx = hashId(place.id) % set.length;
    return `https://images.unsplash.com/photo-${set[idx]}?w=400&q=75&auto=format&fit=crop`;
}

// ── Resolver foto de um place (async) ────────────────────────
export async function resolvePhoto(place) {
    if (place.photoLoaded) return place.photo;

    // 1. Tag direta no OSM
    if (place.osmImage) {
        place.photo      = place.osmImage;
        place.photoLoaded = true;
        return place.photo;
    }

    // 2. Wikidata
    if (place.wikidata) {
        const url = await fetchWikidataPhoto(place.wikidata);
        if (url) {
            place.photo      = url;
            place.photoLoaded = true;
            return place.photo;
        }
    }

    // 3. Wikimedia Commons
    if (place.wikimediaCommons) {
        const url = await fetchCommonsPhoto(place.wikimediaCommons);
        if (url) {
            place.photo      = url;
            place.photoLoaded = true;
            return place.photo;
        }
    }

    // 4. Wikipedia
    if (place.wikipedia) {
        const url = await fetchWikipediaPhoto(place.wikipedia);
        if (url) {
            place.photo      = url;
            place.photoLoaded = true;
            return place.photo;
        }
    }

    // 5. Unsplash curado (sempre funciona)
    place.photo      = unsplashPhoto(place);
    place.photoLoaded = true;
    return place.photo;
}

// ── Construir query Overpass ──────────────────────────────────
function buildQuery(lat, lon, radius, category) {
    const ar = `(around:${radius},${lat},${lon})`;
    const p  = [];

    if (category === 'todos' || category === 'comer') {
        p.push(`node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|bakery|ice_cream|food_court)$"]${ar};`);
        p.push(`way["amenity"~"^(restaurant|cafe|fast_food|bar|pub|bakery)$"]${ar};`);
    }
    if (category === 'todos' || category === 'dormir') {
        p.push(`node["tourism"~"^(hotel|hostel|guest_house|motel|apartment|camp_site)$"]${ar};`);
        p.push(`way["tourism"~"^(hotel|hostel|guest_house|motel)$"]${ar};`);
    }
    if (category === 'todos' || category === 'visitar') {
        p.push(`node["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|aquarium|theme_park)$"]${ar};`);
        p.push(`way["tourism"~"^(attraction|museum|viewpoint|gallery)$"]${ar};`);
        p.push(`node["historic"]${ar};`);
        p.push(`node["leisure"~"^(park|garden|nature_reserve)$"]${ar};`);
        p.push(`way["leisure"~"^(park|garden|nature_reserve)$"]${ar};`);
        p.push(`node["amenity"~"^(theatre|cinema|arts_centre)$"]${ar};`);
    }

    return `[out:json][timeout:30];(${p.join('')});out center body qt;`;
}

// ── Fetch Overpass com fallback de servidor ───────────────────
async function fetchOverpass(query, serverIdx = 0) {
    if (serverIdx >= OVERPASS_SERVERS.length) throw new Error('All Overpass servers failed');
    const url = OVERPASS_SERVERS[serverIdx];
    try {
        const resp = await fetch(url, {
            method : 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body   : `data=${encodeURIComponent(query)}`,
            signal : AbortSignal.timeout(20000)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    } catch (e) {
        console.warn(`[overpass] server ${serverIdx} failed:`, e.message);
        return fetchOverpass(query, serverIdx + 1);
    }
}

// ── API principal ─────────────────────────────────────────────
/**
 * Busca lugares próximos via Overpass API.
 * @param {number} lat
 * @param {number} lon
 * @param {number} radius  metros
 * @param {string} category  'todos' | 'comer' | 'dormir' | 'visitar'
 * @param {number} limit    máx de resultados
 * @returns {Promise<Array>}
 */
export async function searchNearby(lat, lon, radius = 2000, category = 'todos', limit = 60) {
    const query  = buildQuery(lat, lon, radius, category);
    const data   = await fetchOverpass(query);
    const places = (data.elements || [])
        .map(el => normalizePlace(el, lat, lon))
        .filter(Boolean)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, limit);

    // Iniciar resolução de fotos em background (lazy)
    places.forEach(p => resolvePhoto(p).catch(() => {}));

    return places;
}

// ── Geocodificação reversa (cidade/bairro) ───────────────────
export async function reverseGeocode(lat, lon) {
    try {
        const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt`,
            {
                headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
                signal : AbortSignal.timeout(5000)
            }
        );
        if (!resp.ok) return 'sua região';
        const d = await resp.json();
        return d.address?.suburb
            || d.address?.neighbourhood
            || d.address?.city_district
            || d.address?.city
            || d.address?.town
            || d.address?.village
            || 'sua região';
    } catch { return 'sua região'; }
}
