export async function POST({ request }) {
  const key = request.headers.get('x-api-key');

  // ✅ Compare with secret from .env
  if (key !== process.env.WEBHOOK_SECRET) {
    console.warn('Unauthorized webhook attempt');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    console.log('✅ Verified GHL webhook payload:');
    console.log(JSON.stringify(body, null, 2));

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('❌ Error parsing webhook payload:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
