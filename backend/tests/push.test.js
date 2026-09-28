// Тесты уведомлений (src/push.js): шифрование и подпись VAPID.
// Запуск из папки backend: ~/.local/node/bin/node --test "tests/*.test.js"
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/push.js';

test('шифрование уведомления совпадает с примером RFC 8291 байт в байт', async () => {
  const clean = x => x.replace(/\s+/g, '');
  const asPublic = P.unb64u(clean('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIg Dll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'));
  const jwk = { kty: 'EC', crv: 'P-256', x: P.b64u(asPublic.slice(1, 33)), y: P.b64u(asPublic.slice(33, 65)), d: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw' };
  const serverKeys = {
    publicKey: await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
    privateKey: await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
  };
  const subscription = { keys: { p256dh: clean('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV- JvLexhqUzORcx aOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'), auth: 'BTBZMqHH6r4Tts7J_aSIgg' } };
  const body = await P.encryptPayload(subscription, P.unb64u('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24'), { salt: P.unb64u('DGv6ra1nlYgDCS1FRnbzlw'), serverKeys });
  const expected = clean('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z 9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml mlMoZIIgDll6e3vCYLocInmYWAmS6Tlz AC8wEqKK6PBru3jl7A8')
    + '|' + clean('8pfeW0KbunFT06SuDKoJH9Ql87S1QUrd irN6GcG7sFz1y1sqLgVi1VhjVkHsUoEs bI_0LpXMuGvnzQ');
  const [header, ciphertext] = expected.split('|');
  assert.equal(P.b64u(body), P.b64u(new Uint8Array([...P.unb64u(header), ...P.unb64u(ciphertext)])));
});

test('подпись VAPID проверяется публичным ключом сервера', async () => {
  const vapid = await P.generateVapidKeys();
  const auth = await P.vapidAuthorization('https://web.push.apple.com/QGd1', vapid, 'https://komron4111.github.io/kae-zapis/', Date.UTC(2026, 8, 29));
  const [, token, key] = auth.match(/^vapid t=([^,]+), k=(.+)$/);
  const [head, claims, signature] = token.split('.');
  const pub = await crypto.subtle.importKey('raw', P.unb64u(key), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.equal(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, P.unb64u(signature), new TextEncoder().encode(`${head}.${claims}`)), true);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(P.unb64u(claims))), { aud: 'https://web.push.apple.com', exp: 1790683200, sub: 'https://komron4111.github.io/kae-zapis/' });
});
