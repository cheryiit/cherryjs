import { internalAction } from "../../_generated/server";
import { v } from "convex/values";

export const createCheckoutSession = internalAction({
  args: {
    productId: v.string(),
    email: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { productId, email, userId }) => {
    const baseUrl =
      process.env.POLAR_SERVER === "sandbox"
        ? "https://sandbox-api.polar.sh"
        : "https://api.polar.sh";

    const headers = {
      Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    };

    const productRes = await fetch(`${baseUrl}/v1/products/${productId}`, {
      headers,
    });
    if (!productRes.ok) {
      throw new Error("Failed to fetch product"); // cherry:allow
    }
    const product = await productRes.json();
    const priceId = product.prices?.[0]?.id;
    if (!priceId) {
      throw new Error("No price found for product"); // cherry:allow
    }

    const checkoutRes = await fetch(`${baseUrl}/v1/checkouts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        product_price_id: priceId,
        success_url: `${process.env.SITE_URL}/success`,
        customer_email: email,
        metadata: { userId },
      }),
    });
    if (!checkoutRes.ok) {
      throw new Error("Failed to create checkout"); // cherry:allow
    }
    const checkout = await checkoutRes.json();
    return checkout.url as string;
  },
});

export const getAvailablePlans = internalAction({
  args: {},
  handler: async () => {
    const baseUrl =
      process.env.POLAR_SERVER === "sandbox"
        ? "https://sandbox-api.polar.sh"
        : "https://api.polar.sh";

    const res = await fetch(
      `${baseUrl}/v1/products?organization_id=${process.env.POLAR_ORGANIZATION_ID}&is_archived=false`,
      {
        headers: {
          Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
        },
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  },
});
