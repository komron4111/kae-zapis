// Тесты входа по Face ID (src/webauthn.js) с программным «телефоном» (soft-authenticator.mjs).
// Запуск из папки backend: ~/.local/node/bin/node --test "tests/*.test.js"
import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../src/webauthn.js';
import * as T from './soft-authenticator.mjs';

const ORIGIN = 'https://nailapp.pages.dev';
const challenge = () => crypto.getRandomValues(new Uint8Array(32));

async function register(options = {}) {
  const ch = challenge();
  const credential = await T.create({ challenge: ch, rp: { id: 'nailapp.pages.dev', name: 'Nailapp' } }, options.origin || ORIGIN, options);
  return { credential, challenge: T.b64u(ch), body: T.registrationJson(credential) };
}

async function login(credential, options = {}) {
  const ch = challenge();
  const assertion = await T.get({ challenge: ch, rpId: 'nailapp.pages.dev', allowCredentials: [{ type: 'public-key', id: credential.rawId }] }, options.origin || ORIGIN, options);
  return { challenge: T.b64u(ch), body: T.assertionJson(assertion) };
}

test('ключ P-256 (iPhone): регистрация и вход', async () => {
  const r = await register();
  const key = await W.verifyRegistration(r.body, { challenge: r.challenge, origin: ORIGIN });
  assert.equal(key.id, r.body.id);
  assert.equal(key.rpId, 'nailapp.pages.dev');
  assert.equal(key.jwk.kty, 'EC');
  const l = await login(r.credential);
  await W.verifyAssertion(l.body, { challenge: l.challenge, origin: ORIGIN, rpId: key.rpId, jwk: key.jwk });
});

test('ключ RSA (Windows Hello): регистрация и вход', async () => {
  const r = await register({ alg: -257 });
  const key = await W.verifyRegistration(r.body, { challenge: r.challenge, origin: ORIGIN });
  assert.equal(key.jwk.kty, 'RSA');
  const l = await login(r.credential);
  await W.verifyAssertion(l.body, { challenge: l.challenge, origin: ORIGIN, rpId: key.rpId, jwk: key.jwk });
});

test('чужой сайт, чужой вызов, без Face ID — отказ', async () => {
  const r = await register();
  await assert.rejects(W.verifyRegistration(r.body, { challenge: r.challenge, origin: 'https://evil.example' }), /другого сайта/);
  await assert.rejects(W.verifyRegistration(r.body, { challenge: T.b64u(challenge()), origin: ORIGIN }), /устарел/);
  const noFace = await register({ flags: 0x41 }); // пользователь был, но Face ID не подтверждал
  await assert.rejects(W.verifyRegistration(noFace.body, { challenge: noFace.challenge, origin: ORIGIN }), /не подтвердил/);

  const key = await W.verifyRegistration(r.body, { challenge: r.challenge, origin: ORIGIN });
  const l = await login(r.credential);
  await assert.rejects(W.verifyAssertion(l.body, { challenge: T.b64u(challenge()), origin: ORIGIN, rpId: key.rpId, jwk: key.jwk }), /устарел/);
  await assert.rejects(W.verifyAssertion(l.body, { challenge: l.challenge, origin: ORIGIN, rpId: 'komron4111.github.io', jwk: key.jwk }), /другого сайта/);
  const weak = await login(r.credential, { flags: 0x01 });
  await assert.rejects(W.verifyAssertion(weak.body, { challenge: weak.challenge, origin: ORIGIN, rpId: key.rpId, jwk: key.jwk }), /не подтвердил/);
});

test('подпись другим ключом или изменённые данные — отказ', async () => {
  const a = await register(), b = await register();
  const keyB = await W.verifyRegistration(b.body, { challenge: b.challenge, origin: ORIGIN });
  const l = await login(a.credential);
  await assert.rejects(W.verifyAssertion(l.body, { challenge: l.challenge, origin: ORIGIN, rpId: 'nailapp.pages.dev', jwk: keyB.jwk }), /не сошлась/);
  const keyA = await W.verifyRegistration(a.body, { challenge: a.challenge, origin: ORIGIN });
  const data = T.unb64u(l.body.authenticatorData);
  data[33] = 7; // счётчик изменён — подпись должна не сойтись
  await assert.rejects(W.verifyAssertion({ ...l.body, authenticatorData: T.b64u(data) }, { challenge: l.challenge, origin: ORIGIN, rpId: 'nailapp.pages.dev', jwk: keyA.jwk }), /не сошлась/);
});

test('DER-подпись → r‖s и разбор CBOR', () => {
  const der = Uint8Array.of(0x30, 0x08, 0x02, 0x02, 0x00, 0x81, 0x02, 0x02, 0x01, 0x02);
  const raw = W.derToRaw(der);
  assert.equal(raw[31], 0x81);
  assert.equal(raw[62], 0x01);
  assert.equal(raw[63], 0x02);
  const { value } = W.cborDecode(Uint8Array.of(0xa2, 0x01, 0x02, 0x20, 0x43, 1, 2, 3));
  assert.equal(value.get(1), 2);
  assert.deepEqual([...value.get(-1)], [1, 2, 3]);
  assert.throws(() => W.cborDecode(Uint8Array.of(0x5f)), /неподдерживаемая длина/);
  assert.throws(() => W.cborDecode(Uint8Array.of(0x43, 1)), /оборвались/);
});
