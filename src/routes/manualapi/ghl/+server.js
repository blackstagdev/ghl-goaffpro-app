import { json } from '@sveltejs/kit';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = "pit-13bada01-23cd-484e-909c-e9f49fc24546";
const LOCATION_ID = 'YKo6A5vmDaEqPUyWAi1r';
const PAGE_LIMIT = 500;

const REFERREDBY_FIELD_ID = "UJBoqg0TlLO6GAVbzAag"; 

async function fetchContactsPage({ searchAfter }) {
  const body = {
    locationId: LOCATION_ID,
    pageLimit: Number(PAGE_LIMIT)
  };

  if (searchAfter) {
    body.searchAfter = searchAfter;
  }

  const resp = await fetch(`${GHL_API_BASE}/contacts/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch contacts: ${resp.status} ${await resp.text()}`);
  }

  return resp.json();
}

async function fetchAffiliates() {
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

  const data = await res.json();
  return data.affiliates || [];
}

export async function GET() {
  try {
    // 1. Fetch all affiliates once
    const affiliates = await fetchAffiliates();
    console.log("✅ Affiliates fetched:", affiliates.length);

    // 2. Fetch all contacts with pagination
    const allContacts = [];
    let searchAfter = null;
    let keepGoing = true;

    while (keepGoing) {
      const data = await fetchContactsPage({ searchAfter });
      const contacts = data.contacts ?? [];
      allContacts.push(...contacts);

      console.log(`📦 Batch fetched: ${contacts.length} contacts`);

      if (contacts.length < PAGE_LIMIT) {
        keepGoing = false;
      } else {
        searchAfter = contacts[contacts.length - 1]?.searchAfter;
        if (!searchAfter) keepGoing = false;
      }

      if (allContacts.length >= 20000) {
        keepGoing = false;
      }
    }

    // 3. Filter contacts with ReferredBy (support both customField/customFields)
    const filteredContacts = allContacts.filter(c => {
      const fields = c.customField || c.customFields || [];
      return fields.some(f => f.id === REFERREDBY_FIELD_ID && f.value);
    });

    console.log(`ℹ️ Filtered contacts with referredBy: ${filteredContacts.length}`);

    // 4. Map contacts to affiliates
    const results = filteredContacts.map(c => {
      const fields = c.customField || c.customFields || [];
      const referredBy = fields.find(f => f.id === REFERREDBY_FIELD_ID)?.value;

      const matchedAffiliate = affiliates.find(
        a =>
          a.ref_code?.toLowerCase() === referredBy?.toLowerCase() ||
          a.name?.toLowerCase() === referredBy?.toLowerCase()
      );

      return {
        contactId: c.id,
        contactName: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        referredBy,
        affiliateName: matchedAffiliate?.name || null,
        affiliateEmail: matchedAffiliate?.email || null
      };
    });

    return json({
      ok: true,
      count: results.length,
      contacts: results
    });
  } catch (err) {
    console.error("❌ Error:", err);
    return json({ ok: false, error: String(err) }, { status: 500 });
  }
}