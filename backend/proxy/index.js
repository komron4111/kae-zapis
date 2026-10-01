// Прежний адрес сервера (kae-zapis-api.kae-zapis.workers.dev) после переезда на свой сервер (2.9.0):
// он только пересылает запросы туда. Приложения, установленные со старых адресов, работают как раньше —
// с той же базой. Адрес посетителя (для ограничения попыток) уходит в X-Real-IP вместе с общим
// ключом X-Proxy-Key (секрет PROXY_KEY здесь и в /etc/beautybook/secrets.env на сервере).
// Выкладка: из папки backend/proxy — wrangler deploy (секрет — wrangler secret put PROXY_KEY).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    headers.set('X-Real-IP', request.headers.get('CF-Connecting-IP') || '');
    headers.set('X-Proxy-Key', env.PROXY_KEY || '');
    headers.delete('Host');
    const hasBody = !['GET', 'HEAD'].includes(request.method);
    try {
      return await fetch(new URL(url.pathname + url.search, env.TARGET), {
        method: request.method,
        headers,
        body: hasBody ? await request.arrayBuffer() : undefined,
        redirect: 'manual',
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Сервер временно недоступен. Попробуйте позже' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
