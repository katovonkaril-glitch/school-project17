// netlify/functions/telegram-webhook.js
// Telegram -> this function (clean HTTP 200) -> Google Apps Script doPost.
//
// Netlify environment variables:
//   GAS_URL      https://script.google.com/macros/s/XXXX/exec
//   TG_SECRET    the same value you pass as secret_token in setWebhook
//   WEBHOOK_KEY  the same value as WEBHOOK_KEY in Код.gs (leave unset if you left it '' there)
//
// Apps Script answers every POST with a 302 redirect to the script's output. The script has
// already run by then, so a 3xx from Apps Script means "processed". Telegram, however, treats a
// 302 as a failed delivery and retries with growing delays. This relay converts that into a 200.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 200, body: 'ok' };

  const secret = process.env.TG_SECRET;
  if (secret && event.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return { statusCode: 403, body: 'forbidden' };
  }

  const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  const key = process.env.WEBHOOK_KEY;
  const url = process.env.GAS_URL + (key ? '?key=' + encodeURIComponent(key) : '');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(9000)
    });
    if (res.status >= 200 && res.status < 400) return { statusCode: 200, body: 'ok' };
    console.error('Apps Script answered', res.status);
  } catch (err) {
    console.error('Forward to Apps Script failed:', err.message);
  }
  // Real failure: let Telegram retry. Duplicate deliveries are harmless (Код.gs de-duplicates by message id).
  return { statusCode: 502, body: 'retry' };
};
