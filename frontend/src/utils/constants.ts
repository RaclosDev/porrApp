/**
 * Porra Global: liga pública por defecto (demo, entrada desde LinkedIn y usuarios sin liga).
 * El backend garantiza este id al arrancar (League.GLOBAL_ID).
 */
export const GLOBAL_LEAGUE_ID = '1';

/** Comprueba si un id de liga (número o texto) es la Porra Global. */
export const isGlobalLeagueId = (id: string | number | null | undefined) =>
  id != null && String(id) === GLOBAL_LEAGUE_ID;

/**
 * Corrige mojibake UTF-8 decodificado erróneamente como Latin-1 / Windows-1252.
 */
export function fixMojibake(str: string): string {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã\u00AD/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã/g, 'Á')
    .replace(/Ã /g, 'Á')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã\u0089/g, 'É')
    .replace(/Ã/g, 'Í')
    .replace(/Ã\u008D/g, 'Í')
    .replace(/Ã“/g, 'Ó')
    .replace(/Ã\u0093/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ã\u009A/g, 'Ú')
    .replace(/Ã‘/g, 'Ñ')
    .replace(/Ã\u0091/g, 'Ñ')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã¼/g, 'ü');
}

/**
 * Normaliza nombres de participantes reparando mojibake y caracteres '??' o de reemplazo.
 */
export function normalizeParticipantName(name: string): string {
  if (!name || typeof name !== 'string') return name;
  const cleaned = fixMojibake(name.trim());
  return cleaned
    .replace(/An(\?\?|\uFFFD|\?)nimo/gi, 'Anónimo')
    .replace(/Ra(\?\?|\uFFFD|\?)l/gi, 'Raúl')
    .replace(/Jos(\?\?|\uFFFD|\?)/gi, 'José')
    .replace(/Adri(\?\?|\uFFFD|\?)n/gi, 'Adrián')
    .replace(/^(\?\?|\uFFFD|\?)ngel/gi, 'Ángel')
    .replace(/^(\?\?|\uFFFD|\?)lvaro/gi, 'Álvaro')
    .replace(/^(\?\?|\uFFFD|\?)scar/gi, 'Óscar')
    .replace(/I(\?\?|\uFFFD|\?)aki/gi, 'Iñaki')
    .replace(/Rub(\?\?|\uFFFD|\?)n/gi, 'Rubén')
    .replace(/V(\?\?|\uFFFD|\?)ctor/gi, 'Víctor')
    .replace(/Jes(\?\?|\uFFFD|\?)s/gi, 'Jesús')
    .replace(/H(\?\?|\uFFFD|\?)ctor/gi, 'Héctor')
    .replace(/C(\?\?|\uFFFD|\?)sar/gi, 'César')
    .replace(/F(\?\?|\uFFFD|\?)lix/gi, 'Félix')
    .replace(/Andr(\?\?|\uFFFD|\?)s/gi, 'Andrés')
    .replace(/Tom(\?\?|\uFFFD|\?)s/gi, 'Tomás')
    .replace(/Mat(\?\?|\uFFFD|\?)as/gi, 'Matías')
    .replace(/Nicol(\?\?|\uFFFD|\?)s/gi, 'Nicolás')
    .replace(/Agust(\?\?|\uFFFD|\?)n/gi, 'Agustín')
    .replace(/Mart(\?\?|\uFFFD|\?)n/gi, 'Martín')
    .replace(/Joaqu(\?\?|\uFFFD|\?)n/gi, 'Joaquín')
    .replace(/Iv(\?\?|\uFFFD|\?)n/gi, 'Iván')
    .replace(/Sebasti(\?\?|\uFFFD|\?)n/gi, 'Sebastián')
    .replace(/Gonz(\?\?|\uFFFD|\?)lez/gi, 'González')
    .replace(/Rodr(\?\?|\uFFFD|\?)guez/gi, 'Rodríguez')
    .replace(/Fern(\?\?|\uFFFD|\?)ndez/gi, 'Fernández')
    .replace(/L(\?\?|\uFFFD|\?)pez/gi, 'López')
    .replace(/Mart(\?\?|\uFFFD|\?)nez/gi, 'Martínez')
    .replace(/S(\?\?|\uFFFD|\?)nchez/gi, 'Sánchez')
    .replace(/P(\?\?|\uFFFD|\?)rez/gi, 'Pérez')
    .replace(/G(\?\?|\uFFFD|\?)mez/gi, 'Gómez')
    .replace(/D(\?\?|\uFFFD|\?)az/gi, 'Díaz')
    .replace(/(\?\?|\uFFFD|\?)lvarez/gi, 'Álvarez')
    .replace(/Mu(\?\?|\uFFFD|\?)oz/gi, 'Muñoz')
    .replace(/N(\?\?|\uFFFD|\?)ñez/gi, 'Núñez')
    .replace(/Pe(\?\?|\uFFFD|\?)a/gi, 'Peña');
}

/**
 * Normaliza nombres de países y repara posibles cadenas corruptas o con problemas de codificación (mojibake).
 */
export function normalizeCountryName(name: string): string {
  if (!name || typeof name !== 'string') return name;
  const cleaned = fixMojibake(name.trim());
  return cleaned
    .replace(/Espa(\?\?|\uFFFD|\?|n|ñ)?a/gi, 'España')
    .replace(/M(\?\?|\uFFFD|\?)xico/gi, 'México')
    .replace(/Sud(\?\?|\uFFFD|\?)frica/gi, 'Sudáfrica')
    .replace(/Canad(\?\?|\uFFFD|\?)/gi, 'Canadá')
    .replace(/Hait(\?\?|\uFFFD|\?)/gi, 'Haití')
    .replace(/Turqu(\?\?|\uFFFD|\?)a/gi, 'Turquía')
    .replace(/Cura(\?\?|\uFFFD|\?)ao/gi, 'Curaçao')
    .replace(/Pa(\?\?|\uFFFD|\?)ses Bajos/gi, 'Países Bajos')
    .replace(/Jap(\?\?|\uFFFD|\?)n/gi, 'Japón')
    .replace(/T(\?\?|\uFFFD|\?)nez/gi, 'Túnez')
    .replace(/B(\?\?|\uFFFD|\?)lgica/gi, 'Bélgica')
    .replace(/Ir(\?\?|\uFFFD|\?)n/gi, 'Irán')
    .replace(/Saud(\?\?|\uFFFD|\?)/gi, 'Saudí')
    .replace(/Panam(\?\?|\uFFFD|\?)/gi, 'Panamá')
    .replace(/Uzbekist(\?\?|\uFFFD|\?)n/gi, 'Uzbekistán')
    .replace(/Camer(\?\?|\uFFFD|\?)n/gi, 'Camerún')
    .replace(/Atl(\?\?|\uFFFD|\?)tico/gi, 'Atlético')
    .replace(/Alav(\?\?|\uFFFD|\?)s/gi, 'Alavés')
    .replace(/Legan(\?\?|\uFFFD|\?)s/gi, 'Leganés')
    .replace(/C(\?\?|\uFFFD|\?)diz/gi, 'Cádiz')
    .replace(/Almer(\?\?|\uFFFD|\?)a/gi, 'Almería')
    .replace(/M(\?\?|\uFFFD|\?)laga/gi, 'Málaga')
    .replace(/La Coru(\?\?|\uFFFD|\?)a/gi, 'La Coruña');
}

export const countryCodeMap: Record<string, string> = {
  México: 'mx',
  Sudáfrica: 'za',
  'Corea del Sur': 'kr',
  Chequia: 'cz',
  Canadá: 'ca',
  'Bosnia y Her.': 'ba',
  'Bosnia y Her': 'ba',
  Bosnia: 'ba',
  'Bosnia y Herzegovina': 'ba',
  Catar: 'qa',
  Suiza: 'ch',
  Brasil: 'br',
  Marruecos: 'ma',
  Haití: 'ht',
  Escocia: 'gb-sct',
  EEUU: 'us',
  Paraguay: 'py',
  Australia: 'au',
  Turquía: 'tr',
  Alemania: 'de',
  Curaçao: 'cw',
  'Costa de Marfil': 'ci',
  Ecuador: 'ec',
  'Países Bajos': 'nl',
  Japón: 'jp',
  Suecia: 'se',
  Túnez: 'tn',
  Bélgica: 'be',
  Egipto: 'eg',
  Irán: 'ir',
  'Nueva Zelanda': 'nz',
  España: 'es',
  'Cabo Verde': 'cv',
  'Arabia Saudí': 'sa',
  Uruguay: 'uy',
  Francia: 'fr',
  Senegal: 'sn',
  Irak: 'iq',
  Noruega: 'no',
  Argentina: 'ar',
  Argelia: 'dz',
  Austria: 'at',
  Jordania: 'jo',
  Portugal: 'pt',
  'RD Congo': 'cd',
  Uzbekistán: 'uz',
  Colombia: 'co',
  Inglaterra: 'gb-eng',
  Croacia: 'hr',
  Ghana: 'gh',
  Panamá: 'pa',
  'Nueva Caledonia': 'nc',
  'New Caledonia': 'nc',

  // Resiliencia a variantes sin tildes o con codificación alterada
  'Estados Unidos': 'us',
  'EE.UU.': 'us',
  'EE.UU': 'us',
  'United States of America': 'us',
  'Corea Sur': 'kr',
  Corea: 'kr',
  Korea: 'kr',
  'Korea Republic': 'kr',
  'República Democrática del Congo': 'cd',
  'Republica Democratica del Congo': 'cd',
  'R.D. Congo': 'cd',
  'R. D. Congo': 'cd',
  'DR Congo': 'cd',
  'Democratic Republic of the Congo': 'cd',
  'Cape Verde': 'cv',
  "Côte d'Ivoire": 'ci',
  "Cote d'Ivoire": 'ci',
  'Czech Republic': 'cz',
  Czechia: 'cz',
  'República Checa': 'cz',
  'Republica Checa': 'cz',
  'South Africa': 'za',
  'New Zealand': 'nz',
  'Bosnia & Herzegovina': 'ba',
  Espana: 'es',
  'Espa??a': 'es',
  Espaa: 'es',
  Spain: 'es',
  Mexico: 'mx',
  'M??xico': 'mx',
  Mxico: 'mx',
  Sudafrica: 'za',
  'Sud??frica': 'za',
  Canada: 'ca',
  'Canad??': 'ca',
  Haiti: 'ht',
  'Hait??': 'ht',
  Turquia: 'tr',
  'Turqu??a': 'tr',
  Turkiye: 'tr',
  Türkiye: 'tr',
  Curazao: 'cw',
  Curacao: 'cw',
  'Cura??ao': 'cw',
  'Paises Bajos': 'nl',
  'Pa??ses Bajos': 'nl',
  Netherlands: 'nl',
  Japon: 'jp',
  'Jap??n': 'jp',
  Japan: 'jp',
  Tunez: 'tn',
  'T??nez': 'tn',
  Tunisia: 'tn',
  Belgica: 'be',
  'B??lgica': 'be',
  Belgium: 'be',
  Iran: 'ir',
  'Ir??n': 'ir',
  'Arabia Saudi': 'sa',
  'Arabia Saud??': 'sa',
  'Saudi Arabia': 'sa',
  Panama: 'pa',
  'Panam??': 'pa',
  Uzbekistan: 'uz',
  'Uzbekist??n': 'uz',

  // English ESPN Fallbacks
  France: 'fr',
  Brazil: 'br',
  Germany: 'de',
  England: 'gb-eng',
  Norway: 'no',
  Egypt: 'eg',
  Poland: 'pl',
  Morocco: 'ma',
  Croatia: 'hr',
  Switzerland: 'ch',
  USA: 'us',
  'United States': 'us',
  'South Korea': 'kr',
  Cameroon: 'cm',
  Serbia: 'rs',
  Denmark: 'dk',
  'Ivory Coast': 'ci',
};

export function getCountryCode(name: string | null | undefined): string {
  if (!name) return 'xx';
  const normalized = normalizeCountryName(name).trim();
  if (countryCodeMap[normalized]) return countryCodeMap[normalized];

  const lower = normalized.toLowerCase();
  if (Object.values(countryCodeMap).includes(lower)) {
    return lower;
  }

  // Coincidencia insensible a mayúsculas
  const match = Object.keys(countryCodeMap).find((k) => k.toLowerCase() === lower);
  if (match) return countryCodeMap[match];

  // Coincidencia eliminando acentos/diacríticos
  const stripped = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const strippedMatch = Object.keys(countryCodeMap).find(
    (k) =>
      k
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase() === stripped,
  );
  return strippedMatch ? countryCodeMap[strippedMatch] : 'xx';
}

export function getCountryEmoji(name: string | null | undefined): string {
  const code = getCountryCode(name);
  if (!code || code === 'xx') return '🏴';
  if (code === 'gb-eng') return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (code === 'gb-sct') return '🏴󠁧󠁢󠁳󠁣󠁴󠁿';

  return code
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join('');
}
