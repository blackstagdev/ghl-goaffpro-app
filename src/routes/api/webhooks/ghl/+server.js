export async function POST({ request }) {
  const key = request.headers.get('x-api-key');
  if (key !== process.env.WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const contact = body.contacts?.[0];

  // 1. Get the specific custom field
  const targetFieldId = "UJBoqg0TlLO6GAVbzAag"; // Wellness Solutions field
  const field = contact?.customField?.find(f => f.id === targetFieldId);

  if (!field) {
    console.warn(`⚠️ Contact ${contact?.id} does not have custom field ${targetFieldId}`);
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Custom field ${targetFieldId} not found for this contact`
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const fieldValue = field.value;
  console.log("🎯 Extracted custom field:", fieldValue);

  // 2. Fetch affiliates from GoAffPro
  try {
    const res = await fetch("https://api.goaffpro.com/v1/admin/affiliates?fields=id,name,email,created_at,ref_code", {
      method: "GET",
      headers: {
        "X-GOAFFPRO-ACCESS-TOKEN": "5d7c7806d9545a1d44d0dfd9da39e4b9fc513d43fe24a56cb9ced3280252ac22", 
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`GoAffPro API error: ${res.statusText}`);
    }

    const affiliates = await res.json();
    console.log("✅ Affiliates fetched:", affiliates.length);

    // 3. Compare fieldValue with ref_code
    const matchedAffiliate = affiliates.find(a => a => a.ref_code === fieldValue || a.name === fieldValue);

    if (matchedAffiliate) {
      console.log("🎉 Match found:", matchedAffiliate);
      return new Response(JSON.stringify({ ok: true, match: matchedAffiliate }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      console.log("❌ No match for:", fieldValue);
      return new Response(JSON.stringify({ ok: false, match: null }), {
        status: 404,
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
