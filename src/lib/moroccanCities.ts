/**
 * Moroccan city aliases → canonical French name
 * Covers: Arabic names, common misspellings, abbreviations, Darija
 */
export const CITY_ALIASES: Record<string, string> = {
  // ── Casablanca ──────────────────────────────────────────────────────────────
  "casa":                  "Casablanca",
  "casablanca":            "Casablanca",
  "الدار البيضاء":         "Casablanca",
  "الدار":                 "Casablanca",
  "dar el beida":          "Casablanca",
  "dar beida":             "Casablanca",
  "casablanaca":           "Casablanca",
  "cazablanca":            "Casablanca",

  // ── Rabat ───────────────────────────────────────────────────────────────────
  "rabat":                 "Rabat",
  "الرباط":                "Rabat",
  "rbat":                  "Rabat",
  "rbt":                   "Rabat",

  // ── Salé ────────────────────────────────────────────────────────────────────
  "sale":                  "Salé",
  "salé":                  "Salé",
  "سلا":                   "Salé",
  "sla":                   "Salé",

  // ── Témara ──────────────────────────────────────────────────────────────────
  "temara":                "Témara",
  "témara":                "Témara",
  "تمارة":                 "Témara",
  "tmara":                 "Témara",

  // ── Marrakech ───────────────────────────────────────────────────────────────
  "marrakech":             "Marrakech",
  "marrakesh":             "Marrakech",
  "marakech":              "Marrakech",
  "marakesh":              "Marrakech",
  "مراكش":                 "Marrakech",
  "mrakech":               "Marrakech",
  "mrrakech":              "Marrakech",

  // ── Fès ─────────────────────────────────────────────────────────────────────
  "fes":                   "Fès",
  "fès":                   "Fès",
  "fez":                   "Fès",
  "فاس":                   "Fès",
  "fas":                   "Fès",

  // ── Meknès ──────────────────────────────────────────────────────────────────
  "meknes":                "Meknès",
  "meknès":                "Meknès",
  "meknas":                "Meknès",
  "mknès":                 "Meknès",
  "mknas":                 "Meknès",
  "مكناس":                 "Meknès",

  // ── Agadir ──────────────────────────────────────────────────────────────────
  "agadir":                "Agadir",
  "agadire":               "Agadir",
  "أكادير":                "Agadir",
  "agdire":                "Agadir",

  // ── Tanger ──────────────────────────────────────────────────────────────────
  "tanger":                "Tanger",
  "tangier":               "Tanger",
  "tanja":                 "Tanger",
  "طنجة":                  "Tanger",
  "tng":                   "Tanger",

  // ── Oujda ───────────────────────────────────────────────────────────────────
  "oujda":                 "Oujda",
  "wejda":                 "Oujda",
  "وجدة":                  "Oujda",
  "ujda":                  "Oujda",

  // ── Tétouan ─────────────────────────────────────────────────────────────────
  "tetouan":               "Tétouan",
  "tétouan":               "Tétouan",
  "tetwan":                "Tétouan",
  "تطوان":                 "Tétouan",
  "ttwan":                 "Tétouan",

  // ── Kénitra ─────────────────────────────────────────────────────────────────
  "kenitra":               "Kénitra",
  "kénitra":               "Kénitra",
  "القنيطرة":              "Kénitra",
  "qnitra":                "Kénitra",
  "knitra":                "Kénitra",

  // ── Mohammedia ──────────────────────────────────────────────────────────────
  "mohammedia":            "Mohammedia",
  "mohamadia":             "Mohammedia",
  "mohammédia":            "Mohammedia",
  "محمدية":                "Mohammedia",
  "m7ammadia":             "Mohammedia",

  // ── El Jadida ───────────────────────────────────────────────────────────────
  "el jadida":             "El Jadida",
  "eljadida":              "El Jadida",
  "jadida":                "El Jadida",
  "jdida":                 "El Jadida",
  "الجديدة":               "El Jadida",

  // ── Nador ───────────────────────────────────────────────────────────────────
  "nador":                 "Nador",
  "الناظور":               "Nador",
  "nadir":                 "Nador",

  // ── Béni Mellal ─────────────────────────────────────────────────────────────
  "beni mellal":           "Béni Mellal",
  "béni mellal":           "Béni Mellal",
  "bni mellal":            "Béni Mellal",
  "bni mlal":              "Béni Mellal",
  "بني ملال":              "Béni Mellal",
  "benimelal":             "Béni Mellal",
  "benimellal":            "Béni Mellal",

  // ── Khouribga ───────────────────────────────────────────────────────────────
  "khouribga":             "Khouribga",
  "khribga":               "Khouribga",
  "khuribga":              "Khouribga",
  "خريبكة":                "Khouribga",

  // ── Settat ──────────────────────────────────────────────────────────────────
  "settat":                "Settat",
  "سطات":                  "Settat",
  "setat":                 "Settat",

  // ── Berrechid ───────────────────────────────────────────────────────────────
  "berrechid":             "Berrechid",
  "berchid":               "Berrechid",
  "برشيد":                 "Berrechid",

  // ── Khémisset ───────────────────────────────────────────────────────────────
  "khemisset":             "Khémisset",
  "khémisset":             "Khémisset",
  "الخميسات":              "Khémisset",
  "khmisset":              "Khémisset",

  // ── Safi ────────────────────────────────────────────────────────────────────
  "safi":                  "Safi",
  "asfi":                  "Safi",
  "آسفي":                  "Safi",

  // ── Essaouira ───────────────────────────────────────────────────────────────
  "essaouira":             "Essaouira",
  "الصويرة":               "Essaouira",
  "mogador":               "Essaouira",
  "suwayra":               "Essaouira",

  // ── Laâyoune ────────────────────────────────────────────────────────────────
  "laayoune":              "Laâyoune",
  "laâyoune":              "Laâyoune",
  "العيون":                "Laâyoune",
  "el aaiun":              "Laâyoune",

  // ── Dakhla ──────────────────────────────────────────────────────────────────
  "dakhla":                "Dakhla",
  "الداخلة":               "Dakhla",
  "dahkla":                "Dakhla",

  // ── Al Hoceima ──────────────────────────────────────────────────────────────
  "al hoceima":            "Al Hoceima",
  "hoceima":               "Al Hoceima",
  "الحسيمة":               "Al Hoceima",
  "al hucemas":            "Al Hoceima",
  "alhocima":              "Al Hoceima",

  // ── Taza ────────────────────────────────────────────────────────────────────
  "taza":                  "Taza",
  "تازة":                  "Taza",

  // ── Ouarzazate ──────────────────────────────────────────────────────────────
  "ouarzazate":            "Ouarzazate",
  "warzazat":              "Ouarzazate",
  "ورزازات":               "Ouarzazate",
  "warzazate":             "Ouarzazate",

  // ── Errachidia ──────────────────────────────────────────────────────────────
  "errachidia":            "Errachidia",
  "الرشيدية":              "Errachidia",
  "rachid":                "Errachidia",

  // ── Chefchaouen ─────────────────────────────────────────────────────────────
  "chefchaouen":           "Chefchaouen",
  "chaouen":               "Chefchaouen",
  "شفشاون":                "Chefchaouen",
  "chauen":                "Chefchaouen",

  // ── Larache ─────────────────────────────────────────────────────────────────
  "larache":               "Larache",
  "العرائش":               "Larache",
  "laarache":              "Larache",

  // ── Guelmim ─────────────────────────────────────────────────────────────────
  "guelmim":               "Guelmim",
  "guelmin":               "Guelmim",
  "كلميم":                 "Guelmim",
  "gulmin":                "Guelmim",

  // ── Taroudant ───────────────────────────────────────────────────────────────
  "taroudant":             "Taroudant",
  "تارودانت":              "Taroudant",
  "taroudante":            "Taroudant",

  // ── Tiznit ──────────────────────────────────────────────────────────────────
  "tiznit":                "Tiznit",
  "تيزنيت":                "Tiznit",
  "tizenit":               "Tiznit",

  // ── Ifrane ──────────────────────────────────────────────────────────────────
  "ifrane":                "Ifrane",
  "إفران":                 "Ifrane",
  "ifran":                 "Ifrane",

  // ── Azrou ───────────────────────────────────────────────────────────────────
  "azrou":                 "Azrou",
  "أزرو":                  "Azrou",

  // ── Midelt ──────────────────────────────────────────────────────────────────
  "midelt":                "Midelt",
  "ميدلت":                 "Midelt",

  // ── Asilah ──────────────────────────────────────────────────────────────────
  "asilah":                "Asilah",
  "أصيلة":                 "Asilah",
  "asila":                 "Asilah",

  // ── Benslimane ──────────────────────────────────────────────────────────────
  "benslimane":            "Benslimane",
  "بنسليمان":              "Benslimane",

  // ── Souk Sebt ───────────────────────────────────────────────────────────────
  "souk sebt":             "Souk Sebt",
  "سوق السبت":             "Souk Sebt",

  // ── Fquih Ben Salah ─────────────────────────────────────────────────────────
  "fquih ben salah":       "Fquih Ben Salah",
  "الفقيه بن صالح":        "Fquih Ben Salah",
  "fkih ben salah":        "Fquih Ben Salah",

  // ── Sidi Kacem ──────────────────────────────────────────────────────────────
  "sidi kacem":            "Sidi Kacem",
  "سيدي قاسم":             "Sidi Kacem",
  "sidiqacem":             "Sidi Kacem",

  // ── Sidi Slimane ────────────────────────────────────────────────────────────
  "sidi slimane":          "Sidi Slimane",
  "سيدي سليمان":           "Sidi Slimane",

  // ── Tiflet ──────────────────────────────────────────────────────────────────
  "tiflet":                "Tiflet",
  "تيفلت":                 "Tiflet",

  // ── Ain Aouda ───────────────────────────────────────────────────────────────
  "ain aouda":             "Ain Aouda",
  "عين عودة":              "Ain Aouda",
};

/**
 * Hardcoded Ameex city list — used as fallback when the API returns nothing.
 * IDs confirmed by user: 2 = Meknès.
 * The list covers the most common Moroccan cities used in COD shipping.
 * Update via Intégrations → Ameex → Villes tab once the API is confirmed.
 */
export const AMEEX_CITIES_FALLBACK: { id: string; name: string }[] = [
  { id: "1",  name: "Casablanca" },
  { id: "2",  name: "Meknès" },
  { id: "3",  name: "Rabat" },
  { id: "4",  name: "Marrakech" },
  { id: "5",  name: "Agadir" },
  { id: "6",  name: "Tanger" },
  { id: "7",  name: "Fès" },
  { id: "8",  name: "Oujda" },
  { id: "9",  name: "Kénitra" },
  { id: "10", name: "Tétouan" },
  { id: "11", name: "Salé" },
  { id: "12", name: "Mohammedia" },
  { id: "13", name: "El Jadida" },
  { id: "14", name: "Settat" },
  { id: "15", name: "Béni Mellal" },
  { id: "16", name: "Nador" },
  { id: "17", name: "Khouribga" },
  { id: "18", name: "Berrechid" },
  { id: "19", name: "Khémisset" },
  { id: "20", name: "Safi" },
  { id: "21", name: "Essaouira" },
  { id: "22", name: "Al Hoceima" },
  { id: "23", name: "Larache" },
  { id: "24", name: "Guelmim" },
  { id: "25", name: "Tiznit" },
  { id: "26", name: "Taroudant" },
  { id: "27", name: "Ouarzazate" },
  { id: "28", name: "Errachidia" },
  { id: "29", name: "Laâyoune" },
  { id: "30", name: "Dakhla" },
  { id: "31", name: "Témara" },
  { id: "32", name: "Chefchaouen" },
  { id: "33", name: "Taza" },
  { id: "34", name: "Ifrane" },
  { id: "35", name: "Azrou" },
  { id: "36", name: "Midelt" },
  { id: "37", name: "Asilah" },
  { id: "38", name: "Sidi Kacem" },
  { id: "39", name: "Sidi Slimane" },
  { id: "40", name: "Fquih Ben Salah" },
  { id: "41", name: "Souk Sebt" },
  { id: "42", name: "Benslimane" },
  { id: "43", name: "Tiflet" },
  { id: "44", name: "Ain Aouda" },
];

/**
 * Normalize a city name: lowercase + strip accents
 */
export function normalizeCity(city: string): string {
  return city.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Resolve a user-entered city to the canonical French name.
 * Returns the canonical name, or the original if no alias found.
 */
export function resolveCity(input: string): string {
  const key = input.toLowerCase().trim();
  // Direct alias lookup
  if (CITY_ALIASES[key]) return CITY_ALIASES[key];
  // Accent-stripped lookup
  const stripped = normalizeCity(key);
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    if (normalizeCity(alias) === stripped) return canonical;
  }
  return input; // fallback: return as-is
}

/**
 * Multi-strategy city resolver: given a raw city string and a list of
 * Ameex cities {id, name}, returns the best matching Ameex city ID or null.
 *
 * Strategies (in order of confidence):
 * 1. Exact match after alias resolution + normalization
 * 2. Input contains a known city name (e.g. "Hay Hassani Casablanca" → Casa)
 * 3. A known city name contains the input (e.g. "Casa" → Casablanca)
 * 4. Partial word overlap ≥ 1 word ≥ 4 chars
 */
export function resolveAmeexCityId(
  rawCity: string,
  ameexCities: { id: string; name: string }[]
): string | null {
  if (!rawCity.trim() || !ameexCities.length) return null;

  const n = normalizeCity;

  // Build map from normalized name → id
  const idMap: Record<string, string> = {};
  for (const c of ameexCities) idMap[n(c.name)] = c.id;

  // 1. Exact match via alias resolution
  const canonical = resolveCity(rawCity.trim());
  if (idMap[n(canonical)]) return idMap[n(canonical)];
  if (idMap[n(rawCity)]) return idMap[n(rawCity)];

  const normInput = n(rawCity);

  // 2. Input CONTAINS a known city name (e.g. "Sidi Bernoussi, Casablanca")
  for (const c of ameexCities) {
    const normName = n(c.name);
    if (normName.length >= 4 && normInput.includes(normName)) return c.id;
  }

  // 3. Known city name CONTAINS the input (e.g. "al hoc" → "Al Hoceima")
  for (const c of ameexCities) {
    const normName = n(c.name);
    if (normInput.length >= 4 && normName.includes(normInput)) return c.id;
  }

  // 4. Try resolving each word of the input against aliases, then look up
  const words = normInput.split(/[\s,;/\\-]+/).filter(w => w.length >= 3);
  for (const word of words) {
    // Check word directly against city names
    for (const c of ameexCities) {
      if (n(c.name).startsWith(word) && word.length >= 4) return c.id;
    }
    // Check word against all aliases
    for (const [alias, canonical2] of Object.entries(CITY_ALIASES)) {
      if (n(alias) === word || n(alias).startsWith(word) && word.length >= 4) {
        const resolvedId = idMap[n(canonical2)];
        if (resolvedId) return resolvedId;
      }
    }
  }

  return null;
}
