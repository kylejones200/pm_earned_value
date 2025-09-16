// Minimal API handler for development and simple deployments
// Supports:
// - Next.js App Router (exported POST function)
// - Next.js Pages Router (default export handler with req/res)
// - Generic Fetch-style runtimes (Response-based)

type TranscriptPayload = {
  subject?: string;
  transcript?: string;
};

// App Router / Fetch-style handler
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TranscriptPayload;
    // Here you would send email via your provider (SendGrid, SES, etc.)
    // For now, just echo success for development
    return new Response(
      JSON.stringify({ ok: true, received: { subject: body?.subject, length: body?.transcript?.length ?? 0 } }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: "Bad Request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}

// Pages Router style default export
export default async function handler(req: any, res: any) {
  try {
    if (req?.method !== "POST") {
      res?.status?.(405)?.json?.({ error: "Method Not Allowed" });
      return;
    }
    const body: TranscriptPayload = req?.body ?? {};
    try {
      res?.status?.(200)?.json?.({ ok: true, received: { subject: body?.subject, length: body?.transcript?.length ?? 0 } });
    } catch (e: any) {
      res?.status?.(400)?.json?.({ ok: false, error: 'Bad Request' });
    }
  } catch (e) {
    res?.status?.(400)?.json?.({ ok: false, error: "Bad Request" });
  }
}

