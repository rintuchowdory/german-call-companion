import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

type AssistInput = {
  germanText: string;
  targetLang: string;
  context?: string;
};

export const assistCall = createServerFn({ method: "POST" })
  .inputValidator((d: AssistInput) => {
    if (!d || typeof d.germanText !== "string" || typeof d.targetLang !== "string") {
      throw new Error("Invalid input");
    }
    return {
      germanText: d.germanText.slice(0, 4000),
      targetLang: d.targetLang.slice(0, 40),
      context: (d.context ?? "").slice(0, 2000),
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const system = `You are a real-time phone-call copilot for foreigners (Ausländer) living in Germany.
The user is on a phone call in GERMAN. You receive the latest German utterance from the other side.
Return STRICT JSON with these fields:
- translation: faithful translation of the German into ${data.targetLang}
- summary: one short sentence in ${data.targetLang} explaining what the caller wants
- intent: one of ["appointment","question","complaint","information","smalltalk","other"]
- suggestedReplies: array of 3 short natural replies the user can SAY in GERMAN, polite and clear
- repliesTranslated: same 3 replies translated into ${data.targetLang}
- tips: 1-2 short cultural/bureaucratic tips in ${data.targetLang} (e.g. ask for Terminbestätigung). Optional, [] if none.
Keep it concise. Output JSON only.`;

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Call context: ${data.context || "general call"}\n\nGerman utterance: """${data.germanText}"""`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "call_copilot",
            description: "Return structured copilot output",
            parameters: {
              type: "object",
              properties: {
                translation: { type: "string" },
                summary: { type: "string" },
                intent: { type: "string" },
                suggestedReplies: { type: "array", items: { type: "string" } },
                repliesTranslated: { type: "array", items: { type: "string" } },
                tips: { type: "array", items: { type: "string" } },
              },
              required: [
                "translation",
                "summary",
                "intent",
                "suggestedReplies",
                "repliesTranslated",
                "tips",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "call_copilot" } },
    };

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("Rate limit hit, please wait a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace Settings.");
      throw new Error(`AI gateway error ${res.status}: ${t.slice(0, 200)}`);
    }

    const json = await res.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(argsStr);
    } catch {
      parsed = {};
    }
    return parsed as {
      translation: string;
      summary: string;
      intent: string;
      suggestedReplies: string[];
      repliesTranslated: string[];
      tips: string[];
    };
  });

type BookingInput = {
  reason: string;
  preferredTimes: string;
  targetLang: string;
};

export const draftAppointment = createServerFn({ method: "POST" })
  .inputValidator((d: BookingInput) => ({
    reason: String(d.reason ?? "").slice(0, 500),
    preferredTimes: String(d.preferredTimes ?? "").slice(0, 300),
    targetLang: String(d.targetLang ?? "English").slice(0, 40),
  }))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You help an Ausländer book appointments by phone in Germany. Produce a short, polite German phone script the user can READ ALOUD, then a translation in ${data.targetLang}. Include greeting, reason, preferred times, asking for Terminbestätigung, and a polite goodbye. Use simple A2-B1 German. Output JSON: { "germanScript": string, "translation": string }`,
          },
          {
            role: "user",
            content: `Reason: ${data.reason}\nPreferred times: ${data.preferredTimes}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "appointment_script",
              parameters: {
                type: "object",
                properties: {
                  germanScript: { type: "string" },
                  translation: { type: "string" },
                },
                required: ["germanScript", "translation"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "appointment_script" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit hit, please wait a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI gateway error ${res.status}`);
    }
    const json = await res.json();
    const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}";
    try {
      return JSON.parse(argsStr) as { germanScript: string; translation: string };
    } catch {
      return { germanScript: "", translation: "" };
    }
  });
