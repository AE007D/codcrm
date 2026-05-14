import { NextRequest, NextResponse } from "next/server";

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  channel: string;
}

function extractChannel(url: string): string {
  try {
    const parsed = new URL(url);
    // pathname is like /channelname or /channelname/123
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[0] ?? "";
  } catch {
    // Fallback: grab the path segment after t.me or telegram.me
    const match = url.match(/(?:t\.me|telegram\.me)\/([^/?#]+)/);
    return match?.[1] ?? "";
  }
}

function parseResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Extract result blocks — each result sits inside a <div class="result ...">
  const blockRe = /<div[^>]+class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;

  // We parse the whole HTML for links tagged result__a and their adjacent snippets
  // Pattern: <a class="result__a" href="...">title</a>
  const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  // Collect all links
  const links: Array<{ url: string; title: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const rawUrl = m[1];
    const rawTitle = m[2].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();
    links.push({ url: rawUrl, title: rawTitle });
  }

  // Collect all snippets
  const snippets: string[] = [];
  while ((m = snippetRe.exec(html)) !== null) {
    const rawSnippet = m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();
    snippets.push(rawSnippet);
  }

  // Pair links with snippets by index
  for (let i = 0; i < links.length; i++) {
    const { url, title } = links[i];

    // Filter to Telegram URLs only
    if (!url.includes("t.me") && !url.includes("telegram.me")) continue;

    const snippet = snippets[i] ?? "";
    const channel = extractChannel(url);

    results.push({ url, title, snippet, channel });
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return results.filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

export async function POST(request: NextRequest) {
  let query: string;
  let imageBase64: string | undefined;

  try {
    const body = await request.json();
    query = body.query;
    imageBase64 = body.imageBase64;
  } catch {
    return NextResponse.json({ results: [], error: "Invalid JSON body" }, { status: 400 });
  }

  if (!query || typeof query !== "string") {
    return NextResponse.json({ results: [], error: "Missing or invalid query" }, { status: 400 });
  }

  // Build Yandex reverse image URL if imageBase64 provided
  let reverseImageUrl: string | undefined;
  if (imageBase64) {
    reverseImageUrl = `https://yandex.com/images/search?rpt=imageview&url=data:image/jpeg;base64,${encodeURIComponent(imageBase64)}`;
  }

  try {
    const encodedQuery = encodeURIComponent(`site:t.me ${query}`);
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    const res = await fetch(ddgUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://duckduckgo.com/",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { results: [], error: `DuckDuckGo returned HTTP ${res.status}`, reverseImageUrl },
        { status: 502 }
      );
    }

    const html = await res.text();
    const results = parseResults(html);

    return NextResponse.json({ results, reverseImageUrl });
  } catch (err) {
    return NextResponse.json(
      { results: [], error: String(err), reverseImageUrl },
      { status: 500 }
    );
  }
}
