/**
 * Lightweight heuristic language hints.
 *
 * Not a language identifier — two focused utilities:
 *   - detectNeedsTranslation(text): does this message likely need translation
 *     to English? True when the text does NOT appear to be EN/PL/ES.
 *   - detectLanguage(text): best-guess display label (e.g. "English", "Polish",
 *     "Romanian") for the composer's translate popover. Returns null when the
 *     heuristic has no opinion.
 */

// Non-Latin Unicode scripts: Cyrillic, Greek, Hebrew, Arabic, Syriac,
// Devanagari, Bengali, Thai, Myanmar, Hiragana, Katakana, CJK, Hangul.
const NON_LATIN =
  /[Ѐ-ӿͰ-Ͽ֐-׿؀-ۿ܀-ݏऀ-ॿঀ-৿฀-๿က-႟぀-ゟ゠-ヿ一-鿿가-힯]/;

const EN_STOPWORDS = new Set([
  "the", "and", "is", "to", "of", "in", "it", "you", "that", "for", "on", "with",
  "this", "be", "are", "was", "have", "not", "but", "or", "if", "as", "at", "by",
  "a", "we", "he", "she", "they", "i", "an", "do", "can", "will", "would",
  "should", "could", "has", "had", "from", "your", "my", "me", "him", "her",
  "them", "what", "when", "where", "who", "how", "yes", "no", "ok", "okay",
  "hi", "hello", "thanks", "thank",
]);

const PL_STOPWORDS = new Set([
  "nie", "jest", "się", "tak", "jak", "ale", "czy", "po", "od", "za", "co",
  "ty", "ja", "my", "wy", "oni", "być", "ma", "są", "było", "będzie", "tylko",
  "który", "która", "które", "żeby", "bardzo", "tego", "temu", "dla", "przez",
  "bez", "pod", "nad", "mnie", "ciebie", "jego", "jej", "ich", "nas", "was",
  "teraz", "potem", "tutaj", "tam", "dzień", "dzisiaj", "jutro", "wczoraj",
  "dobrze", "źle", "wszystko", "nic", "coś", "ktoś", "gdzieś", "cześć",
  "dzięki", "proszę", "dziękuję",
]);

const ES_STOPWORDS = new Set([
  "el", "la", "los", "las", "de", "en", "que", "no", "es", "se", "un", "una",
  "por", "con", "para", "pero", "si", "me", "te", "lo", "le", "como", "más",
  "muy", "está", "son", "su", "sus", "al", "del", "yo", "tú", "él", "ella",
  "nosotros", "vosotros", "ellos", "ellas", "esto", "eso", "aquí", "allí",
  "ahora", "después", "hoy", "mañana", "ayer", "bien", "mal", "todo", "nada",
  "algo", "alguien", "hola", "gracias", "adiós", "sí",
]);

const PL_DIACRITICS = /[ąćęłńóśźż]/i;
const ES_STRONG = /[ñ¿¡]/i;
const RO_STRONG = /[șțȘȚăĂ]/;

const RO_STOPWORDS = new Set([
  "și", "si", "este", "sunt", "nu", "să", "sa", "cu", "pe", "în", "in",
  "pentru", "foarte", "dacă", "daca", "cum", "când", "cand", "unde", "cine",
  "ce", "da", "bună", "buna", "salut", "mulțumesc", "multumesc", "acest",
  "aceasta", "acel", "aceea", "am", "ai", "are", "avem", "aveți", "aveti",
  "au", "fac", "faci", "face", "facem", "faceți", "faceti", "merg", "mergi",
  "merge", "bine", "rău", "rau", "mâine", "maine", "ieri", "astăzi", "astazi",
  "aici", "acolo", "mai", "mult", "ma",
]);

const FR_STOPWORDS = new Set([
  "le", "la", "les", "de", "des", "un", "une", "et", "est", "que", "qui", "ne",
  "pas", "plus", "en", "dans", "pour", "avec", "je", "tu", "nous", "vous", "ils",
  "elles", "ce", "cette", "ces", "mais", "ou", "où", "très", "bien", "bonjour",
  "merci", "salut", "oui", "non",
]);

const DE_STOPWORDS = new Set([
  "der", "die", "das", "und", "ist", "nicht", "ich", "du", "wir", "sie", "er",
  "es", "in", "zu", "den", "dem", "mit", "auf", "für", "von", "bei", "aus",
  "nach", "über", "unter", "aber", "oder", "sehr", "gut", "danke", "hallo",
  "ja", "nein",
]);

const IT_STOPWORDS = new Set([
  "il", "lo", "la", "i", "gli", "le", "di", "e", "che", "non", "è", "un", "una",
  "in", "per", "con", "da", "su", "sono", "ho", "hai", "ha", "abbiamo", "molto",
  "bene", "ciao", "grazie", "sì",
]);

const PT_STOPWORDS = new Set([
  "o", "a", "os", "as", "de", "e", "que", "não", "é", "um", "uma", "em", "para",
  "com", "por", "são", "eu", "você", "vocês", "ele", "ela", "muito", "bem",
  "olá", "oi", "obrigado", "obrigada", "sim",
]);

function scriptHint(text: string): string | null {
  if (/[Ѐ-ӿ]/.test(text)) {
    if (/[іїєґ]/i.test(text)) return "Ukrainian";
    if (/[ыъэё]/i.test(text)) return "Russian";
    return "Russian";
  }
  if (/[Ͱ-Ͽ]/.test(text)) return "Greek";
  if (/[֐-׿]/.test(text)) return "Hebrew";
  if (/[؀-ۿ]/.test(text)) return "Arabic";
  if (/[ऀ-ॿ]/.test(text)) return "Hindi";
  if (/[฀-๿]/.test(text)) return "Thai";
  if (/[぀-ゟ゠-ヿ]/.test(text)) return "Japanese";
  if (/[一-鿿]/.test(text)) return "Chinese";
  if (/[가-힯]/.test(text)) return "Korean";
  return null;
}

export function detectNeedsTranslation(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;

  const cleaned = trimmed
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/@[\w.-]+:[\w.-]+/g, " ")
    .replace(/`[^`]*`/g, " ")
    .trim();
  if (cleaned.length < 4) return false;

  if (NON_LATIN.test(cleaned)) return true;
  if (RO_STRONG.test(cleaned)) return true;

  if (PL_DIACRITICS.test(cleaned)) return false;
  if (ES_STRONG.test(cleaned)) return false;

  const tokens = cleaned.toLowerCase().match(/[a-zà-ÿąćęłńóśźżșțăâî]+/gi);
  if (!tokens || tokens.length < 3) return false;

  let en = 0;
  let pl = 0;
  let es = 0;
  let ro = 0;
  for (const t of tokens) {
    if (EN_STOPWORDS.has(t)) en++;
    if (PL_STOPWORDS.has(t)) pl++;
    if (ES_STOPWORDS.has(t)) es++;
    if (RO_STOPWORDS.has(t)) ro++;
  }
  if (ro >= 2 && ro > en && ro > pl && ro > es) return true;
  const best = Math.max(en, pl, es);
  return best / tokens.length < 1 / 6;
}

/**
 * Best-guess display name for composer UI. Returns null when unsure.
 * Priority: non-Latin script → Romanian-strong → PL/ES diacritics → stopword vote.
 */
export function detectLanguage(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.length < 3) return null;

  const cleaned = trimmed
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/@[\w.-]+:[\w.-]+/g, " ")
    .replace(/`[^`]*`/g, " ")
    .trim();
  if (cleaned.length < 3) return null;

  const script = scriptHint(cleaned);
  if (script) return script;

  if (RO_STRONG.test(cleaned)) return "Romanian";
  if (PL_DIACRITICS.test(cleaned)) return "Polish";
  if (ES_STRONG.test(cleaned)) return "Spanish";

  const tokens = cleaned
    .toLowerCase()
    .match(/[a-zà-ÿąćęłńóśźżșțăâîß]+/gi);
  if (!tokens || tokens.length < 2) return null;

  const scores: Record<string, number> = {
    English: 0, Polish: 0, Spanish: 0, Romanian: 0,
    French: 0, German: 0, Italian: 0, Portuguese: 0,
  };
  for (const t of tokens) {
    if (EN_STOPWORDS.has(t)) scores.English++;
    if (PL_STOPWORDS.has(t)) scores.Polish++;
    if (ES_STOPWORDS.has(t)) scores.Spanish++;
    if (RO_STOPWORDS.has(t)) scores.Romanian++;
    if (FR_STOPWORDS.has(t)) scores.French++;
    if (DE_STOPWORDS.has(t)) scores.German++;
    if (IT_STOPWORDS.has(t)) scores.Italian++;
    if (PT_STOPWORDS.has(t)) scores.Portuguese++;
  }
  let best = "";
  let bestN = 0;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestN) {
      best = k;
      bestN = v;
    }
  }
  // Need at least 1 hit per 8 tokens to claim a language.
  if (bestN === 0 || bestN / tokens.length < 1 / 8) return null;
  return best;
}
