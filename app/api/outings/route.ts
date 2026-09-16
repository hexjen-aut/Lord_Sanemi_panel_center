import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

interface OutingResult {
  name: string;
  description: string;
  area: string;
  image: string | null;
}

interface CommonsSearchResponse {
  query?: {
    pages?: Record<string, { imageinfo?: { thumburl?: string }[] }>;
  };
}

async function findCommonsImage(query: string): Promise<string | null> {
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6" +
      `&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as CommonsSearchResponse;
    const pages = data.query?.pages ? Object.values(data.query.pages) : [];
    return pages[0]?.imageinfo?.[0]?.thumburl ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { mood, budgetLabel } = (await req.json()) as { mood: string; budgetLabel: string };

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ results: null, reason: "not_configured" });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      system:
        "Tu es un agent qui trouve de vraies sorties à Casablanca, Maroc, adaptées à une humeur et un budget donnés. " +
        "Utilise la recherche web pour vérifier que les lieux existent réellement, sont actuels et correspondent au budget. " +
        "Réponds UNIQUEMENT avec un tableau JSON (3 à 5 éléments), sans texte avant ni après, au format : " +
        '[{"name":"...","description":"une phrase, ton direct","area":"quartier ou zone de Casablanca"}]',
      messages: [
        { role: "user", content: `Humeur : ${mood}. Budget : ${budgetLabel}. Trouve des sorties à Casablanca.` },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    const jsonStart = text.indexOf("[");
    const jsonEnd = text.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) {
      return NextResponse.json({ results: null, reason: "no_json" });
    }

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Omit<OutingResult, "image">[];
    const results: OutingResult[] = await Promise.all(
      parsed.map(async (o) => ({ ...o, image: await findCommonsImage(`${o.name} Casablanca`) }))
    );
    return NextResponse.json({ results });
  } catch (error) {
    console.error("outings AI search failed:", error);
    return NextResponse.json({ results: null, reason: "error" });
  }
}
