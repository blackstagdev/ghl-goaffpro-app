export async function POST({ request }) {
  // ✅ Optional: security check (keep this)
  const key = request.headers.get('x-api-key');
  if (key !== process.env.WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const contact = body.contacts?.[0];

  const targetFieldId = "UJBoqg0TlLO6GAVbzAag"; // ReferredBy custom field ID
  const field = contact?.customField?.find(f => f.id === targetFieldId);

  if (!field) {
    console.log(`ℹ️ No referredBy field for contact ${contact?.id}`);
    return new Response(
      JSON.stringify({
        ok: true,
        referredBy: null,
        message: "Custom field ReferredBy not found"
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const fieldValue = field.value?.trim();
  console.log("🎯 Extracted custom field:", fieldValue);

  try {
    // 1️⃣ Fetch all affiliates
    const res = await fetch(
      "https://api.goaffpro.com/v1/admin/affiliates?fields=id,name,email,created_at,ref_code",
      {
        method: "GET",
        headers: {
          "X-GOAFFPRO-ACCESS-TOKEN": process.env.GOAFFPRO_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    if (!res.ok) {
      throw new Error(`GoAffPro API error: ${res.statusText}`);
    }

    const data = await res.json();
    const affiliates = data.affiliates || [];

    console.log("✅ Affiliates fetched:", affiliates.length);

    // 2️⃣ Match referredBy to affiliate
    const matchedAffiliate = affiliates.find(
      a =>
        a.ref_code?.toLowerCase() === fieldValue.toLowerCase() ||
        a.name?.toLowerCase() === fieldValue.toLowerCase()
    );

    if (!matchedAffiliate) {
      console.log("❌ No match for:", fieldValue);
      return new Response(
        JSON.stringify({
          ok: true,
          match: null,
          topLevel: null,
          message: "No affiliate match found"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("🎉 Match found:", matchedAffiliate);

    // 3️⃣ Fetch MLM parent tree for top-level affiliate
    const parentRes = await fetch(
      `https://api.goaffpro.com/v1/admin/mlm/parents/${matchedAffiliate.id}`,
      {
        method: "GET",
        headers: {
          "X-GOAFFPRO-ACCESS-TOKEN": process.env.GOAFFPRO_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    let topLevel = null;

    if (parentRes.ok) {
      const parentData = await parentRes.json();
      const parents = parentData.parents || [];
      if (parents.length > 0) {
        topLevel = parents[0]; // Top-level (first in chain)
        console.log(`🌳 Top-level parent found: ${topLevel.name}`);
      } else {
        console.log("ℹ️ No MLM parents found for affiliate");
      }
    } else {
      console.warn(
        `⚠️ Failed to fetch MLM parents for ${matchedAffiliate.id}: ${parentRes.statusText}`
      );
    }

    // 4️⃣ Return results
    return new Response(
      JSON.stringify({
        ok: true,
        contactId: contact.id,
        contactName: `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
        referredBy: fieldValue,
        affiliate: {
          id: matchedAffiliate.id,
          name: matchedAffiliate.name,
          email: matchedAffiliate.email
        },
        topLevel: topLevel
          ? {
              id: topLevel.id,
              name: topLevel.name,
              email: topLevel.email
            }
          : null
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("GoAffPro fetch error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
