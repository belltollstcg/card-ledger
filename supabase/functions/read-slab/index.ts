// Supabase Edge Function: read-slab
// Reads a graded-card slab label from a photo with Claude Haiku 5.5 and returns
// { grader, grade, cert, name, set }. The app only calls this when it couldn't read
// the slab's barcode, and sends the photo shrunk to 800px on the long side.
//
// Needs the ANTHROPIC_API_KEY secret (Project Settings > Edge Functions > Secrets).
// Request body: { "image": "<base64 JPEG, no data: prefix>" }
// Responses (JSON):
//   200 { grader, grade, cert, name, set }   any field it can't read is ""
//   4xx/5xx { error }                        the app falls back to manual entry

import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

// Structured output: the response text is guaranteed to be JSON matching this schema.
const SCHEMA = {
  type: "object",
  properties: {
    grader: { type: "string", description: "Grading company: PSA, CGC, BGS, SGC, TAG, ACE, or as printed" },
    grade: { type: "string", description: "Numeric grade only, e.g. 10, 9.5, 8" },
    cert: { type: "string", description: "Cert / serial number, digits only" },
    name: { type: "string", description: "Card name with number and variant as printed, e.g. Charizard Holo 4/102" },
    set: { type: "string", description: "Year and set as printed, e.g. 1999 Pokemon Base Set" },
  },
  required: ["grader", "grade", "cert", "name", "set"],
  additionalProperties: false,
};

const PROMPT =
  "This is a photo of a graded trading card slab. Read the slab's label and return the grader, grade, " +
  "cert number, card name and set exactly as printed. Use an empty string for anything you can't read.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let image = "";
  try {
    image = String((await req.json())?.image ?? "").replace(/^data:[^,]*,/, "");
  } catch {
    return json({ error: "Body must be JSON like {\"image\":\"<base64 JPEG>\"}" }, 400);
  }
  if (!image) return json({ error: "No image" }, 400);

  try {
    const response = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 200,
      // Short, fast extraction: no thinking (allowed at effort low-high), so all 200 tokens go to the answer.
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
          { type: "text", text: PROMPT },
        ],
      }],
    });

    if (response.stop_reason === "refusal") return json({ error: "The model declined to read this image" }, 422);
    if (response.stop_reason === "max_tokens") return json({ error: "The reading was cut off" }, 502);
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return json({ error: "No reading returned" }, 502);

    const d = JSON.parse(text.text);
    const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    return json({
      grader: s(d.grader),
      grade: s(d.grade),
      cert: s(d.cert).replace(/\D/g, ""),
      name: s(d.name),
      set: s(d.set),
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "Rate limited; try again shortly" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "ANTHROPIC_API_KEY is missing or invalid" }, 500);
    if (e instanceof Anthropic.BadRequestError) return json({ error: `Bad request: ${e.message}` }, 400);
    if (e instanceof Anthropic.APIError) return json({ error: `Claude API error ${e.status}` }, 502);
    return json({ error: `Could not read the slab: ${e instanceof Error ? e.message : e}` }, 500);
  }
});
