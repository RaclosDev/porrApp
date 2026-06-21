export const countryCodeMap = {
  "México": "mx", "Sudáfrica": "za", "Corea del Sur": "kr", "Chequia": "cz",
  "Canadá": "ca", "Bosnia y Her.": "ba", "Bosnia y Her": "ba", "Bosnia": "ba", "Bosnia y Herzegovina": "ba", "Catar": "qa", "Suiza": "ch",
  "Brasil": "br", "Marruecos": "ma", "Haití": "ht", "Escocia": "gb-sct",
  "EEUU": "us", "Paraguay": "py", "Australia": "au", "Turquía": "tr",
  "Alemania": "de", "Curaçao": "cw", "Costa de Marfil": "ci", "Ecuador": "ec",
  "Países Bajos": "nl", "Japón": "jp", "Suecia": "se", "Túnez": "tn",
  "Bélgica": "be", "Egipto": "eg", "Irán": "ir", "Nueva Zelanda": "nz",
  "España": "es", "Cabo Verde": "cv", "Arabia Saudí": "sa", "Uruguay": "uy",
  "Francia": "fr", "Senegal": "sn", "Irak": "iq", "Noruega": "no",
  "Argentina": "ar", "Argelia": "dz", "Austria": "at", "Jordania": "jo",
  "Portugal": "pt", "RD Congo": "cd", "Uzbekistán": "uz", "Colombia": "co",
  "Inglaterra": "gb-eng", "Croacia": "hr", "Ghana": "gh", "Panamá": "pa"
};

export function getCountryCode(name) {
  if (!name) return "xx";
  let cleanName = name.trim();
  if (countryCodeMap[cleanName]) return countryCodeMap[cleanName];
  
  // Try case insensitive fallback just in case
  const match = Object.keys(countryCodeMap).find(k => k.toLowerCase() === cleanName.toLowerCase());
  return match ? countryCodeMap[match] : "xx";
}

export function getCountryEmoji(name) {
  const code = countryCodeMap[name];
  if (!code || code === "xx") return "🏴";
  if (code === "gb-eng") return "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
  if (code === "gb-sct") return "🏴󠁧󠁢󠁳󠁣󠁴󠁿";
  
  return code
    .toUpperCase()
    .split('')
    .map(char => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join('');
}
