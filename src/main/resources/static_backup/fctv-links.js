// Helper para normalizar nombres de equipos al formato del mapa FCTV
window._normalizeFctv = function(name) {
    const map = {
        'méxico': 'mexico', 'sudáfrica': 'sudafrica', 'corea del sur': 'corea del sur',
        'chequia': 'chequia', 'canadá': 'canada', 'bosnia y her.': 'bosnia',
        'catar': 'catar', 'suiza': 'suiza', 'brasil': 'brasil', 'marruecos': 'marruecos',
        'haití': 'haiti', 'escocia': 'escocia', 'eeuu': 'eeuu', 'paraguay': 'paraguay',
        'australia': 'australia', 'turquía': 'turquia', 'alemania': 'alemania',
        'curaçao': 'curazao', 'costa de marfil': 'costa de marfil', 'ecuador': 'ecuador',
        'países bajos': 'holanda', 'japón': 'japon', 'suecia': 'suecia', 'túnez': 'tunez',
        'bélgica': 'belgica', 'egipto': 'egipto', 'irán': 'iran', 'nueva zelanda': 'nueva zelanda',
        'españa': 'espana', 'cabo verde': 'cabo verde', 'arabia saudí': 'arabia saudi',
        'uruguay': 'uruguay', 'francia': 'francia', 'senegal': 'senegal', 'irak': 'irak',
        'noruega': 'noruega', 'argentina': 'argentina', 'argelia': 'argelia',
        'austria': 'austria', 'jordania': 'jordania', 'portugal': 'portugal',
        'rd congo': 'rd congo', 'uzbekistán': 'uzbekistan', 'colombia': 'colombia',
        'inglaterra': 'inglaterra', 'croacia': 'croacia', 'ghana': 'ghana', 'panamá': 'panama'
    };
    return map[(name || '').toLowerCase()] || (name || '').toLowerCase();
};

// Mapa de TODOS los partidos del Mundial con sus URLs de FCTV
// LOS ENLACES SE HAN MOVIDO AL CLOUDFLARE WORKER POR SEGURIDAD

// Partidos que se emiten en abierto por La 1 (RTVE)
// Solo necesitamos comparar los equipos normalizados
window.la1Matches = [
    'mexico vs sudafrica',
    'canada vs bosnia',
    'brasil vs marruecos',
    'alemania vs curazao',
    'espana vs cabo verde',
    'francia vs senegal',
    'inglaterra vs croacia',
    'suiza vs bosnia',
    'eeuu vs australia',
    'holanda vs suecia',
    'espana vs arabia saudi',
    'argentina vs austria',
    'inglaterra vs ghana',
    'escocia vs brasil',
    'ecuador vs alemania',
    'uruguay vs espana',
    'colombia vs portugal'
];

// Opcional: Proxy de Cloudflare para saltarse el bloqueo de iframes de SofaScore
// Si creas un Worker en Cloudflare, pon aquí su URL sin la barra final (ej: 'https://sofa.tu-usuario.workers.dev')
window.sofascoreProxy = 'https://polished-frost-dabd.cst-pod.workers.dev';

// Enlaces directos a las estadísticas de SofaScore para los partidos terminados
window.sofascoreUrls = {
    // ===== RONDA 1 =====
    'mexico vs sudafrica': 'https://www.fotmob.com/es/matches/south-africa-vs-mexico/1einvt#4667751:tab=stats',
    'corea del sur vs chequia': 'https://www.fotmob.com/es/matches/south-korea-vs-czechia/273opa#4667752:tab=stats',
    'canada vs bosnia': 'https://www.fotmob.com/es/matches/canada-vs-bosnia-herzegovina/23f1qo#4667757:tab=stats',
    'eeuu vs paraguay': 'https://www.fotmob.com/es/matches/usa-vs-paraguay/1hr85j#4667771:tab=stats',
    'catar vs suiza': 'https://www.fotmob.com/es/matches/qatar-vs-switzerland/1beswv#4667758:tab=stats',
    'brasil vs marruecos': 'https://www.fotmob.com/es/matches/morocco-vs-brazil/1qr4gd#4667764:tab=stats',
    'haiti vs escocia': 'https://www.fotmob.com/es/matches/haiti-vs-scotland/1q0g2q#4667765:tab=stats',
    'australia vs turquia': 'https://www.fotmob.com/es/matches/turkiye-vs-australia/1gr3uk#4667772:tab=stats',
    'alemania vs curazao': 'https://www.fotmob.com/es/matches/germany-vs-curacao/k77fsyu#4667777:tab=stats',
    'holanda vs japon': 'https://www.fotmob.com/es/matches/netherlands-vs-japan/1hn72b#4667783:tab=stats',
    'costa de marfil vs ecuador': 'https://www.fotmob.com/es/matches/ecuador-vs-ivory-coast/1hl6kp#4667778:tab=stats',
    'suecia vs tunez': 'https://www.fotmob.com/es/matches/tunisia-vs-sweden/1x5290#4667784:tab=stats',
    'espana vs cabo verde': 'https://www.fotmob.com/es/matches/cape-verde-vs-spain/1bbtuo#4667798:tab=stats',
    'belgica vs egipto': 'https://www.fotmob.com/es/matches/belgium-vs-egypt/2u3bhg#4667790:tab=stats',
    'uruguay vs arabia saudi': 'https://www.fotmob.com/es/matches/uruguay-vs-saudi-arabia/1izuvb#4667799:tab=stats',
    'iran vs nueva zelanda': 'https://www.fotmob.com/es/matches/new-zealand-vs-iran/1ar30l#4667791:tab=stats',
    'francia vs senegal': 'https://www.fotmob.com/es/matches/senegal-vs-france/1f8fvo#4667804:tab=stats',
    
    'sudafrica vs chequia': 'https://www.sofascore.com/football/match/south-africa-czechia/oUbsLUb#id:15186731,tab:statistics',
    'suiza vs bosnia': 'https://www.sofascore.com/football/match/switzerland-bosnia-and-herzegovina/EObsZTb#id:15186806,tab:statistics',
    'catar vs canada': 'https://www.sofascore.com/football/match/qatar-canada/cVbsRVb#id:15186798,tab:statistics',
    'mexico vs corea del sur': 'https://www.sofascore.com/football/match/mexico-south-korea/KUbsGVb#id:15186490,tab:statistics',
    'australia vs eeuu': 'https://www.sofascore.com/football/match/australia-usa/zUbsQUb#id:15186878,tab:statistics',
    'marruecos vs escocia': 'https://www.sofascore.com/football/match/morocco-scotland/VTbsDVb#id:15186859,tab:statistics',
    'haiti vs brasil': 'https://www.sofascore.com/football/match/haiti-brazil/YUbsEUc#id:15186856,tab:statistics',
    'paraguay vs turquia': 'https://www.sofascore.com/football/match/paraguay-turkiye/aUbsOVb#id:15186879,tab:statistics',
    'holanda vs suecia': 'https://www.sofascore.com/football/match/netherlands-sweden/NTbsfUb#id:15186957,tab:statistics',
    'costa de marfil vs alemania': 'https://www.sofascore.com/football/match/cote-divoire-germany/lUbstVb#id:15186905,tab:statistics',
    'curazao vs ecuador': 'https://www.sofascore.com/football/match/curacao-ecuador/hVbsCqx#id:15186906,tab:statistics',
    'japon vs tunez': 'https://www.sofascore.com/football/match/japan-tunisia/EUbsvVb#id:15186963,tab:statistics',
    'arabia saudi vs espana': 'https://www.sofascore.com/football/match/saudi-arabia-spain/xUbsJUb#id:15186840,tab:statistics'
};
