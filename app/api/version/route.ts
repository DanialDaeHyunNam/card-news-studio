import { VERSION } from "@/lib/site";

// Returns this deployment's version. A locally-running copy fetches the canonical
// deployment's copy of this route (cross-origin) to detect updates, so allow any
// origin and never cache — the value is non-sensitive and must stay fresh.
export function GET() {
  return Response.json(
    { version: VERSION },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
