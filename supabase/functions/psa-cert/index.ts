// Supabase Edge Function: psa-cert
// Looks up one PSA cert with PSA's public API and returns only the fields the
// Card Ledger is allowed to keep: verified, cert, name, year, set, grade.
// The full PSA response is never returned or stored.
//
// Needs the PSA_API_TOKEN secret (Project Settings > Edge Functions > Secrets).
// Request body: { "cert": "12345678" }
// Responses (always JSON):
//   200 { verified: true,  cert, name, year, set, grade }   cert found
//   200 { verified: false, cert, error }                    PSA says no such cert
//   4xx/5xx { error }                                       could not check (bad input,
//       missing token, PSA down, rate limit); the app falls back to the photo reading
//       and does not store anything, so it can try again later.

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

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let cert = "";
  try {
    const body = await req.json();
    cert = text(body?.cert).replace(/\D/g, "");
  } catch {
    return json({ error: "Body must be JSON like {\"cert\":\"12345678\"}" }, 400);
  }
  if (!cert || cert.length > 12) return json({ error: "Invalid cert number" }, 400);

  const token = Deno.env.get("PSA_API_TOKEN");
  if (!token) return json({ error: "PSA_API_TOKEN secret is not set" }, 500);

  let res: Response;
  try {
    res = await fetch(`https://api.psacard.com/publicapi/cert/GetByCertNumber/${cert}`, {
      headers: { Authorization: `bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    return json({ error: `Could not reach PSA: ${e instanceof Error ? e.message : e}` }, 502);
  }

  if (res.status === 429) return json({ error: "PSA rate limit reached; try again later" }, 429);
  if (res.status === 401 || res.status === 403) return json({ error: "PSA rejected the API token" }, 502);
  if (res.status === 204) return json({ verified: false, cert, error: "PSA returned no data for this cert" });
  if (!res.ok) return json({ error: `PSA error ${res.status}` }, 502);

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    return json({ error: "PSA sent a response that is not JSON" }, 502);
  }

  const p = data?.PSACert as Record<string, unknown> | undefined;
  if (data?.IsValidRequest === false || !p || !text(p.CertNumber)) {
    return json({ verified: false, cert, error: text(data?.ServerMessage) || "Cert not found at PSA" });
  }

  // Field names from PSA's PublicCertificationModel. Older docs use Year /
  // GradeDescription, so fall back to those if the newer names are missing.
  const subject = text(p.Subject);
  const variety = text(p.Variety);
  return json({
    verified: true,
    cert: text(p.CertNumber) || cert,
    name: [subject, variety].filter(Boolean).join(" "),
    year: text(p.YearIssued ?? p.Year),
    set: text(p.Brand),
    grade: text(p.CardGrade ?? p.GradeDescription),
  });
});
