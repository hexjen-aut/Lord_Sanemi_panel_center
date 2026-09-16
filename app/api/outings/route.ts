import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

interface OutingResult {
  name: string;
  description: string;
  area: string;
  image: string | null;
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
        "Pour chaque lieu, si tu croises pendant ta recherche une URL d'image directe (se terminant par .jpg, .jpeg, .png ou .webp) " +
        "qui montre vraiment ce lieu, inclus-la dans \"image\". Si tu n'es pas sûr qu'elle montre le bon lieu, ou si tu n'en as pas trouvé, mets \"image\" à null — n'invente jamais d'URL. " +
        "Réponds UNIQUEMENT avec un tableau JSON (3 à 5 éléments), sans texte avant ni après, au format : " +
        '[{"name":"...","description":"une phrase, ton direct","area":"quartier ou zone de Casablanca","image":"URL directe ou null"}]',
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

    const results = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as OutingResult[];
    return NextResponse.json({ results });
  } catch (error) {
    console.error("outings AI search failed:", error);
    return NextResponse.json({ results: null, reason: "error" });
  }
}
