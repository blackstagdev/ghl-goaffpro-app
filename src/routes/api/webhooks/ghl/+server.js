export async function POST({ request }) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const contact = body.contacts?.[0];

  const targetFieldId = "UJBoqg0TlLO6GAVbzAag"; 
  const field = contact?.customField?.find(f => f.id === targetFieldId);

  if (!field) {
    console.log(`ℹ️ No referredBy field for contact ${contact?.id}`);
    return new Response(
      JSON.stringify({ ok: true, referredBy: null, message: "Custom field ReferredBy not found" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const fieldValue = field.value;
  console.log("🎯 Extracted custom field:", fieldValue);

  try {
    const res = await fetch("https://api.goaffpro.com/v1/admin/affiliates?fields=id,name,email,created_at,ref_code", {
      method: "GET",
      headers: {
        "X-GOAFFPRO-ACCESS-TOKEN": process.env.GOAFFPRO_API_KEY,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`GoAffPro API error: ${res.statusText}`);
    }

    const data = await res.json();
    const affiliates = data.affiliates || [];

    console.log("✅ Affiliates fetched:", affiliates.length);

    const matchedAffiliate = affiliates.find(
      a =>
        a.ref_code?.toLowerCase() === fieldValue.toLowerCase() ||
        a.name?.toLowerCase() === fieldValue.toLowerCase()
    );

    if (matchedAffiliate) {
      console.log("🎉 Match found:", matchedAffiliate);
      return new Response(JSON.stringify({ ok: true, match: matchedAffiliate }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      console.log("❌ No match for:", fieldValue);
      return new Response(JSON.stringify({ ok: true, match: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    console.error("GoAffPro fetch error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
