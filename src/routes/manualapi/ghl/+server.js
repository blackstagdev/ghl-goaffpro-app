import { json } from '@sveltejs/kit';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = "pit-13bada01-23cd-484e-909c-e9f49fc24546";
const LOCATION_ID = 'YKo6A5vmDaEqPUyWAi1r';
const PAGE_LIMIT = 500;

const REFERREDBY_FIELD_ID = "UJBoqg0TlLO6GAVbzAag";
const GOAFFPRO_API_KEY = "5d7c7806d9545a1d44d0dfd9da39e4b9fc513d43fe24a56cb9ced3280252ac22";

// --- Fetch a page of GHL contacts ---
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

// --- Fetch all affiliates ---
async function fetchAffiliates() {
  const res = await fetch("https://api.goaffpro.com/v1/admin/affiliates?fields=id,name,email,created_at,ref_code", {
    method: "GET",
    headers: {
      "X-GOAFFPRO-ACCESS-TOKEN": GOAFFPRO_API_KEY,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`GoAffPro API error: ${res.statusText}`);
  }

  const data = await res.json();
  return data.affiliates || [];
}

// --- Fetch top-level upline for an affiliate ---
async function fetchTopLevelParent(affiliateId) {
  const url = `https://api.goaffpro.com/v1/admin/mlm/parents/${affiliateId}`;
  const res = await fetch(url, {
    headers: {
      "X-GOAFFPRO-ACCESS-TOKEN": GOAFFPRO_API_KEY,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    console.warn(`⚠️ Failed to fetch MLM parents for affiliate ${affiliateId}: ${res.status}`);
    return null;
  }

  const data = await res.json();
  if (!Array.isArray(data.parents) || data.parents.length === 0) return null;

  // The first parent is the top-level (oldest ancestor)
  return data.parents[0];
}

// --- Main handler ---
export async function GET() {
  try {
    // 1️⃣ Fetch all affiliates
    const affiliates = await fetchAf
