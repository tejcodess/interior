import { getJson } from "serpapi";

export const runtime = "nodejs";
export const maxDuration = 30;

const FALLBACK_SERPAPI_KEY =
  "d3b62911d5c425d41054d04b7148497451fa881e47dbb267da5a963ea4fb1667";
const RESULT_LIMIT = 18;

type SerpApiAmazonResult = {
  title?: unknown;
  link?: unknown;
  price?: unknown;
  thumbnail?: unknown;
  rating?: unknown;
  reviews?: unknown;
  badges?: unknown;
  tags?: unknown;
  prime?: unknown;
  bought_last_month?: unknown;
  delivery?: unknown;
  shipping?: unknown;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (!query)
    return Response.json(
      { error: "Missing product search query." },
      { status: 400 },
    );

  const apiKey = process.env.SERPAPI_API_KEY ?? FALLBACK_SERPAPI_KEY;

  try {
    const json = await getJson({
      api_key: apiKey,
      engine: "amazon",
      amazon_domain: "amazon.in",
      k: query,
    });

    const organicResults = [
      ...(Array.isArray(json.organic_results)
        ? (json.organic_results as SerpApiAmazonResult[])
        : []),
      ...(Array.isArray(json.products)
        ? (json.products as SerpApiAmazonResult[])
        : []),
    ];

    return Response.json({
      query,
      totalResults: numberValue(json.search_information?.total_results),
      results: organicResults
        .slice(0, RESULT_LIMIT)
        .map(normalizeResult)
        .filter(Boolean),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "SerpAPI Amazon search failed.",
      },
      { status: 502 },
    );
  }
}

function normalizeResult(result: SerpApiAmazonResult) {
  const title = stringValue(result.title);
  const link = stringValue(result.link);
  if (!title || !link) return null;

  return {
    id: link,
    title,
    link,
    thumbnail: stringValue(result.thumbnail),
    price: priceText(result.price),
    rating: numberValue(result.rating),
    reviews: numberValue(result.reviews),
    badges: listText(result.badges),
    tags: listText(result.tags),
    prime: booleanValue(result.prime),
    boughtLastMonth: stringValue(result.bought_last_month),
    delivery: listText(result.delivery),
    shipping: shippingText(result.shipping),
  };
}

function priceText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  const price = value as {
    raw?: unknown;
    from?: { raw?: unknown };
    to?: { raw?: unknown };
  };
  const raw = stringValue(price.raw);
  if (raw) return raw;
  const from = stringValue(price.from?.raw);
  const to = stringValue(price.to?.raw);
  if (from && to) return `${from} - ${to}`;
  return from ?? to;
}

function shippingText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  return stringValue((value as { raw?: unknown }).raw);
}

function listText(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map(stringValue)
    .filter((item): item is string => Boolean(item));
  return items.length ? items : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
