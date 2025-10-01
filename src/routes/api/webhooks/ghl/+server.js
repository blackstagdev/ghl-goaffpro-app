// src/routes/api/webhooks/ghl/+server.js
import { json } from '@sveltejs/kit';

/**
 * Helper: try multiple shapes to extract referred_by
 */
function extractRefCode(payload) {
  const opp = payload?.opportunity ?? payload?.opportunity_updated ?? payload;
  if (!opp) return null;

  // common shape: opportunity.customField.referred_by
  if (opp.customField && (opp.customField.referred_by || opp.customField.referredBy)) {
    return opp.customField.referred_by ?? opp.customField.referredBy;
  }

  // sometimes custom fields come as an object keyed by field name
  if (opp.custom_fields && typeof opp.custom_fields === 'object') {
    // object form: { referred_by: 'CODE', ... }
    if (opp.custom_fields.referred_by) return opp.custom_fields.referred_by;
    if (opp.custom_fields.referredBy) return opp.custom_fields.referredBy;
  }

  // array form: [ { name: 'referred_by', value: 'CODE' }, ... ]
  const arr = opp.custom_fields || opp.customFields || opp.custom_field;
  if (Array.isArray(arr)) {
    for (const f of arr) {
      const name = (f.name || f.field || f.key || '').toString().toLowerCase();
      if (name === 'referred_by' || name === 'referredby' || name === 'referred-by') {
        return f.value ?? f.val ?? f.v ?? null;
      }
    }
  }

  // fallback: check top-level keys common in some payloads
  if (opp.referred_by) return opp.referred_by;
  if (opp.referredBy) return opp.referredBy;

  return null;
}

export async function POST({ request, url }) {
  try {
    // Optional: simple shared-secret check via query string
    // Register the webhook in GHL with the URL like:
    // https://your-app.vercel.app/api/webhooks/ghl?secret=YOUR_SECRET
    const incomingSecret = url.searchParams.get('secret') || null;
    if (process.env.WEBHOOK_SECRET) {
      if (!incomingSecret || incomingSecret !== process.env.WEBHOOK_SECRET) {
        return json({ ok: false, message: 'invalid webhook secret' }, { status: 401 });
      }
    }

    // parse payload
    const body = await request.json();

    // quick sanity log (Vercel will capture console.log)
    console.log('[GHL WEBHOOK] raw payload:', JSON.stringify(body));

    // extract the referred_by value from opportunity
    const refCode = extractRefCode(body);

    if (!refCode) {
      console.log('[GHL WEBHOOK] referred_by field not found in payload.');
      // still respond 200 so GHL treats webhook as delivered; return helpful info
      return json({ ok: true, message: 'no referred_by found' }, { status: 200 });
    }

    // At this stage you have the ref code (e.g. "ANDREWDORSEY")
    console.log(`[GHL WEBHOOK] referred_by detected: ${refCode}`);

    // TODO next steps: query GoAffPro, resolve owner mapping, update GHL opportunity owner
    // For now we just log and respond
    // You can call internal helper functions here to continue the process.

    return json({ ok: true, refCode }, { status: 200 });
  } catch (err) {
    console.error('[GHL WEBHOOK] error:', err);
    return json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
