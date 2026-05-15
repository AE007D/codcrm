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
