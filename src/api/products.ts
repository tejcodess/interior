export type AmazonProductResult = {
  id: string;
  title: string;
  link: string;
  thumbnail?: string;
  price?: string;
  rating?: number;
  reviews?: number;
  badges?: string[];
  tags?: string[];
  prime?: boolean;
  boughtLastMonth?: string;
  delivery?: string[];
  shipping?: string;
};

export type AmazonProductSearchResponse = {
  query: string;
  totalResults?: number;
  results: AmazonProductResult[];
};

export async function searchAmazonProducts(
  query: string,
): Promise<AmazonProductSearchResponse> {
  const response = await fetch(
    `/api/products/amazon?q=${encodeURIComponent(query)}`,
  );
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `Amazon product search failed: ${response.status}`;
    throw new Error(message);
  }

  return body as AmazonProductSearchResponse;
}
