/**
 * Server-side Farecrawl integration for live, real-time web retrieval.
 * All API keys and secrets are strictly retained on the server.
 */

export interface FarecrawlItem {
  title: string;
  url: string;
  description: string;
}

export interface FarecrawlSearchResult {
  success: boolean;
  query: string;
  results: FarecrawlItem[];
  error?: string;
}

export interface QueryRouting {
  isThanafus: boolean;
  requiresLiveInfo: boolean;
  searchQuery?: string;
}

function getApiKey(): string | undefined {
  const key = process.env["FIRECRAWL_API_KEY"] || process.env["FARECRAWL_API_KEY"];
  return key?.trim();
}

/**
 * Checks if a query is specific to Thanafus Art Fest 2026.
 */
export function isThanafusQuery(text: string): boolean {
  const lower = text.toLowerCase();
  const thanafusKeywords = [
    "thanafus",
    "tanafus",
    "തനാഫുസ്",
    "nilambur markaz",
    "നിലമ്പൂർ മർകസ്",
    "chandakkunnu",
    "ചന്ദക്കുന്ന്",
    "art fest",
    "arts fest",
    "fest chairman",
    "general convener",
    "treasurer",
    "binshid",
    "nashid",
    "dilshad",
    "sinan",
    "mashhoor",
    "anas",
    "jasir",
    "minhaj",
    "swalah",
    "nihal",
    "adil",
    "fawaz",
    "nafih",
    "badar",
    "uhad",
    "hunain",
    "khandaq",
    "ബദർ",
    "ഉഹദ്",
    "ഹുനൈൻ",
    "ഖന്ദഖ്",
    "daawa",
    "kulliyya",
    "shareea",
    "hifz",
  ];

  return thanafusKeywords.some((kw) => lower.includes(kw));
}

/**
 * Determines whether the user query requires live, current, or up-to-date web information.
 */
export function requiresLiveInfo(text: string): boolean {
  const lower = text.toLowerCase();

  // Exclusion: questions purely asking about today's calendar date are already provided by temporal context
  if (
    /what('s| is) (today('s)?|the) date/i.test(lower) ||
    /ഇന്നത്തെ തീയതി/i.test(lower) ||
    /تاريخ اليوم/i.test(lower)
  ) {
    return false;
  }

  // 1. Explicit current / temporal markers
  const temporalTerms = [
    "current",
    "currently",
    "presently",
    "at present",
    "now",
    "right now",
    "today",
    "today's",
    "tonight",
    "latest",
    "live",
    "recent",
    "recently",
    "up to date",
    "up-to-date",
    "newest",
    "breaking",
    // Malayalam
    "ഇപ്പോഴത്തെ",
    "നിലവിലെ",
    "നിലവിൽ",
    "ഇന്ന്",
    "ഇന്നത്തെ",
    "ഇപ്പോൾ",
    "ഏറ്റവും പുതിയ",
    "പുതിയ",
    // Arabic
    "اليوم",
    "الآن",
    "حاليا",
    "الحالي",
    "الحالية",
    "أحدث",
    "آخر",
  ];

  if (temporalTerms.some((t) => lower.includes(t))) {
    return true;
  }

  // 2. Questions about current office holders / politicians / leadership
  const officeHolderPatterns = [
    /chief minister/i,
    /prime minister/i,
    /president of/i,
    /governor of/i,
    /who is the president/i,
    /who is the cm/i,
    /who is the pm/i,
    /who is the mayor/i,
    /who is the mla/i,
    /who is the mp/i,
    /who leads/i,
    // Malayalam
    /മുഖ്യമന്ത്രി/i,
    /പ്രധാനമന്ത്രി/i,
    /രാഷ്ട്രപതി/i,
    /ഗവർണ്ണർ/i,
    /മന്ത്രി/i,
    // Arabic
    /رئيس الوزراء/i,
    /رئيس الجمهورية/i,
  ];

  if (officeHolderPatterns.some((pattern) => pattern.test(lower))) {
    return true;
  }

  // 3. News, weather, scores, prices
  const domainPatterns = [
    /weather/i,
    /temperature/i,
    /forecast/i,
    /rainfall/i,
    /gold rate/i,
    /gold price/i,
    /petrol price/i,
    /diesel price/i,
    /stock price/i,
    /news/i,
    /headlines/i,
    /sports score/i,
    /match score/i,
    /cricket score/i,
    /football score/i,
    /points table/i,
    // Malayalam
    /കാലാവസ്ഥ/i,
    /വാർത്ത/i,
    /വാർത്തകൾ/i,
    /സ്വർണ്ണവില/i,
    /പെട്രോൾ വില/i,
    /സ്കോർ/i,
    // Arabic
    /الطقس/i,
    /الأخبار/i,
    /سعر الذهب/i,
    /نتيجة/i,
  ];

  if (domainPatterns.some((pattern) => pattern.test(lower))) {
    return true;
  }

  return false;
}

/**
 * Intelligent Source Router
 */
export function routeQuery(text: string): QueryRouting {
  const isThanafus = isThanafusQuery(text);
  const isLive = requiresLiveInfo(text);

  // If question is purely about Thanafus facts (e.g. Fest Chairman, dates, groups, stages),
  // use the Thanafus database directly without live search unless external live info (weather, news) is also asked.
  if (isThanafus && !isLive) {
    return {
      isThanafus: true,
      requiresLiveInfo: false,
    };
  }

  // If live info is required (either general or combined with Thanafus, e.g. "What is the weather today in Nilambur?")
  if (isLive) {
    return {
      isThanafus,
      requiresLiveInfo: true,
      searchQuery: optimizeSearchQuery(text),
    };
  }

  // Normal general knowledge question
  return {
    isThanafus: false,
    requiresLiveInfo: false,
  };
}

/**
 * Optimizes conversational text into an effective web search query.
 */
function optimizeSearchQuery(raw: string): string {
  let q = raw.trim();

  // Strip common conversational intros
  q = q.replace(
    /^(can you tell me|please tell me|who is|what is|tell me about|do you know)\s+/i,
    "",
  );
  q = q.replace(/\?+$/, "");

  // If year is mentioned as past year 2025, or not specified, encourage current/2026 context
  if (
    /chief minister|prime minister|president|weather|news|gold price|petrol price/i.test(q) &&
    !q.includes("2026")
  ) {
    // Keep it natural for search
    return q.trim();
  }

  return q.trim() || raw.trim();
}

/**
 * Executes a live web search via Farecrawl / Firecrawl API.
 * Uses strict timeouts and handles network/rate limit issues gracefully.
 */
export async function searchLiveWeb(
  query: string,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<FarecrawlSearchResult> {
  const apiKey = getApiKey();
  const limit = options.limit ?? 3;
  const timeoutMs = options.timeoutMs ?? 6000;

  if (!apiKey) {
    console.warn("[Farecrawl] API key is not configured in environment.");
    return {
      success: false,
      query,
      results: [],
      error: "Farecrawl API key not configured",
    };
  }

  console.log(`[Farecrawl] Search Request: "${query}"`);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[Farecrawl] Search failed with status ${res.status}: ${errText.slice(0, 150)}`);
      return {
        success: false,
        query,
        results: [],
        error: `Farecrawl API error (${res.status})`,
      };
    }

    const data = (await res.json()) as {
      success?: boolean;
      data?: Array<{
        title?: string;
        url?: string;
        description?: string;
        markdown?: string;
      }>;
    };

    const rawItems = Array.isArray(data.data) ? data.data : [];
    const results: FarecrawlItem[] = rawItems.map((item) => ({
      title: item.title?.trim() || "Web Source",
      url: item.url?.trim() || "",
      description: item.description?.trim() || item.markdown?.slice(0, 300)?.trim() || "",
    }));

    console.log(`[Farecrawl] Search Results Count: ${results.length}`);

    return {
      success: results.length > 0,
      query,
      results,
    };
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    const msg = isAbort
      ? "Search request timed out"
      : err instanceof Error
        ? err.message
        : String(err);
    console.warn(`[Farecrawl] Error: ${msg}`);
    return {
      success: false,
      query,
      results: [],
      error: msg,
    };
  }
}

/**
 * Formats retrieved Farecrawl search results into a clean grounding prompt for Gemini.
 */
export function formatFarecrawlContext(searchResult: FarecrawlSearchResult): string {
  if (!searchResult.success || searchResult.results.length === 0) {
    return `
=== LIVE / CURRENT INFORMATION LOOKUP STATUS ===
Query: "${searchResult.query}"
Status: Live search via Farecrawl did not return verified results or was unavailable.
RULE: If the user is asking for current live facts (like today's weather, breaking news, or current office holders), state politely that fresh live information could not be verified right now. DO NOT invent facts or pretend that an old 2025 answer is current.
=== END OF LOOKUP STATUS ===
`;
  }

  const items = searchResult.results
    .map(
      (r, i) => `[Source ${i + 1}] Title: ${r.title}
URL: ${r.url}
Details: ${r.description}`,
    )
    .join("\n\n");

  return `
=== LIVE / CURRENT INFORMATION RETRIEVED VIA FARECRAWL (AS OF TODAY IN 2026) ===
Search Query: "${searchResult.query}"

${items}

GROUNDING INSTRUCTIONS:
1. The above live data was freshly retrieved from the web via Farecrawl.
2. Formulate a natural, accurate, conversational spoken answer based on this verified fresh information.
3. If this fresh information contradicts any static pre-trained knowledge or outdated 2025 data, you MUST prioritize this fresh live information.
4. Keep the answer friendly, clean, and concise (1 to 4 clear spoken sentences), with no markdown formatting or emojis, suitable for speech synthesis.
=== END OF LIVE INFORMATION ===
`;
}
