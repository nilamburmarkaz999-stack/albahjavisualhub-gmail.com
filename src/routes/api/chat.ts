import { createFileRoute } from "@tanstack/react-router";
import { getGeminiClient, buildSystemInstruction } from "../../lib/gemini.server";
import {
  routeQuery,
  searchLiveWeb,
  formatFarecrawlContext,
  FarecrawlSearchResult,
} from "../../lib/farecrawl.server";

type Msg = { role: "user" | "assistant"; content: string };

const CANDIDATE_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.7-flash"];

function fallbackAnswerFromSearch(searchResult: FarecrawlSearchResult): string {
  if (searchResult.success && searchResult.results.length > 0) {
    const top = searchResult.results[0];
    const snippet = top.description
      ? top.description
          .replace(/\[.*?\]\(.*?\)/g, "")
          .replace(/[*_#`~]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : top.title;
    return `According to current live information: ${snippet.slice(0, 250)}`;
  }
  return "I searched for the latest live information, but could not verify a fresh result at this moment.";
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as { messages?: Msg[] };
          const rawMessages = Array.isArray(body.messages) ? body.messages : [];
          const validMessages = rawMessages.filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string" &&
              m.content.trim().length > 0,
          );

          if (!validMessages.length) {
            return new Response(JSON.stringify({ error: "No messages provided." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Keep recent multi-turn context
          const messages = validMessages.slice(-12);

          let ai;
          try {
            ai = getGeminiClient();
          } catch {
            return new Response(
              JSON.stringify({
                reply:
                  "I am unable to connect to Gemini at the moment. Please ensure your API key is configured.",
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }

          // 1. Intelligent source routing: Thanafus Database vs Farecrawl Live Search vs Gemini
          const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
          const userQuery = lastUserMsg?.content?.trim() || "";

          const routing = routeQuery(userQuery);
          let farecrawlContext = "";
          let lastSearchResult: FarecrawlSearchResult | null = null;

          if (routing.requiresLiveInfo) {
            const searchQuery = routing.searchQuery || userQuery;
            lastSearchResult = await searchLiveWeb(searchQuery);
            farecrawlContext = formatFarecrawlContext(lastSearchResult);
          }

          const systemInstruction = buildSystemInstruction();
          const contents = messages.map((m) => {
            const isTargetUser = m === lastUserMsg;
            if (isTargetUser && farecrawlContext) {
              return {
                role: "user",
                parts: [{ text: `${farecrawlContext}\n\nUser Question: ${m.content.trim()}` }],
              };
            }
            return {
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content.trim() }],
            };
          });

          let replyText = "";

          // Attempt generation across available models, seamlessly trying the next candidate without noisy error logs
          for (const model of CANDIDATE_MODELS) {
            try {
              const response = await ai.models.generateContent({
                model,
                contents,
                config: {
                  systemInstruction,
                },
              });

              const text = response.text?.trim() ?? "";
              if (text) {
                replyText = text;
                break;
              }
            } catch {
              // Proceed to next fallback model without throwing
              continue;
            }
          }

          // Fallback if all models encounter temporary rate-limits
          if (!replyText) {
            if (lastSearchResult && lastSearchResult.success) {
              replyText = fallbackAnswerFromSearch(lastSearchResult);
            } else if (routing.isThanafus) {
              replyText =
                "Thanafus Art Fest 2026 is scheduled for September 25, 26, and 27, 2026 at Nilambur Markaz, Chandakkunnu, Malappuram. The Fest Chairman is Binshid Edakkara and General Convener is Dilshad.";
            } else {
              replyText =
                "I am experiencing temporary high demand right now. Please ask me again in just a moment.";
            }
          }

          // Clean any formatting markers for natural voice output
          const reply = replyText
            .replace(/[*_#`~]+/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

          return new Response(JSON.stringify({ reply }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          return new Response(
            JSON.stringify({
              reply:
                "I had trouble processing that request just now. Please try asking again in a moment.",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});
