// Вход по Face ID, Touch ID или код-паролю телефона — WebAuthn («ключи входа», passkeys),
// без сторонних библиотек. Секретная часть ключа живёт только в телефоне (в «Связке ключей»),
// сервер хранит открытую: P-256 (ES256) или RSA (RS256, например Windows Hello).
// Проверки — по спецификации W3C WebAuthn Level 2: регистрация с attestation «none»
// (производителя телефона не проверяем) и вход — подпись над authenticatorData и хэшем clientDataJSON.

import { b64u, unb64u } from './push.js';

export { b64u, unb64u };

const utf8 = new TextDecoder();

// ---------- CBOR (RFC 8949): только то, что бывает в ответах WebAuthn ----------

// Возвращает { value, end }: end — где закончилось значение (после ключа COSE могут идти расширения).
export function cborDecode(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const need = n => {
    if (pos + n > bytes.length) throw new Error('данные ключа оборвались');
  };
  function length(info) {
    if (info < 24) return info;
    if (info === 24) { need(1); return view.getUint8(pos++); }
    if (info === 25) { need(2); const v = view.getUint16(pos); pos += 2; return v; }
    if (info === 26) { need(4); const v = view.getUint32(pos); pos += 4; return v; }
    if (info === 27) { need(8); const v = Number(view.getBigUint64(pos)); pos += 8; return v; }
    throw new Error('неподдерживаемая длина CBOR');
  }
  function item(depth) {
    if (depth > 16) throw new Error('слишком глубокий CBOR');
    need(1);
    const first = bytes[pos++];
    const major = first >> 5, info = first & 31;
    if (major === 0) return length(info);
    if (major === 1) return -1 - length(info);
    if (major === 2 || major === 3) {
      const n = length(info);
      need(n);
      const chunk = bytes.slice(pos, pos + n);
      pos += n;
      return major === 2 ? chunk : utf8.decode(chunk);
    }
    if (major === 4) {
      const n = length(info), list = [];
      for (let i = 0; i < n; i++) list.push(item(depth + 1));
      return list;
    }
    if (major === 5) {
      const n = length(info), map = new Map();
      for (let i = 0; i < n; i++) {
        const key = item(depth + 1);
        map.set(key, item(depth + 1));
      }
      return map;
    }
    if (major === 7 && info === 20) return false;
    if (major === 7 && info === 21) return true;
    if (major === 7 && info === 22) return null;
    throw new Error('неподдерживаемое значение CBOR');
  }
  const value = item(0);
  return { value, end: pos };
}

// ---------- authenticatorData ----------

// rpIdHash (32) | флаги (1) | счётчик (4) | [AAGUID (16) | длина id (2) | id | ключ COSE]
export function parseAuthData(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 37) throw new Error('короткие данные ключа');
  const flags = bytes[32];
  const out = {
    rpIdHash: bytes.slice(0, 32),
    flags,
    up: Boolean(flags & 0x01), // пользователь был у телефона
    uv: Boolean(flags & 0x04), // подтвердил Face ID, Touch ID или код-паролем
    signCount: new DataView(bytes.buffer, bytes.byteOffset + 33, 4).getUint32(0),
  };
  if (flags & 0x40) {
    if (bytes.length < 55) throw new Error('нет данных нового ключа');
    const idLength = (bytes[53] << 8) | bytes[54];
    if (bytes.length < 55 + idLength) throw new Error('данные ключа оборвались');
    out.credentialId = bytes.slice(55, 55 + idLength);
    out.cose = cborDecode(bytes.subarray(55 + idLength)).value;
  }
  return out;
}

// Ключ COSE (RFC 9053) → JWK для WebCrypto. ES256 (P-256) или RS256.
export function coseToJwk(cose) {
  if (!(cose instanceof Map)) throw new Error('неверный ключ');
  const kty = cose.get(1), alg = cose.get(3);
  if (kty === 2 && alg === -7 && cose.get(-1) === 1) {
    const x = cose.get(-2), y = cose.get(-3);
    if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array) || x.length !== 32 || y.length !== 32) throw new Error('неверный ключ P-256');
    return { kty: 'EC', crv: 'P-256', x: b64u(x), y: b64u(y) };
  }
  if (kty === 3 && alg === -257) {
    const n = cose.get(-1), e = cose.get(-2);
    if (!(n instanceof Uint8Array) || !(e instanceof Uint8Array) || n.length < 256) throw new Error('неверный ключ RSA');
    return { kty: 'RSA', n: b64u(n), e: b64u(e), alg: 'RS256' };
  }
  throw new Error('телефон предложил неподдерживаемый вид ключа');
}

const algorithm = jwk => (jwk.kty === 'EC'
  ? { importAs: { name: 'ECDSA', namedCurve: 'P-256' }, verifyAs: { name: 'ECDSA', hash: 'SHA-256' } }
  : { importAs: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, verifyAs: { name: 'RSASSA-PKCS1-v1_5' } });

// Подпись ES256 от телефона — в DER: SEQUENCE { INTEGER r, INTEGER s }. WebCrypto ждёт r‖s по 32 байта.
export function derToRaw(der) {
  let pos = 0;
  const byte = () => {
    if (pos >= der.length) throw new Error('подпись оборвалась');
    return der[pos++];
  };
  if (byte() !== 0x30) throw new Error('неверная подпись');
  let length = byte();
  if (length & 0x80) {
    const n = length & 0x7f;
    length = 0;
    for (let i = 0; i < n; i++) length = (length << 8) | byte();
  }
  const raw = new Uint8Array(64);
  for (let k = 0; k < 2; k++) {
    if (byte() !== 0x02) throw new Error('неверная подпись');
    const n = byte();
    if (pos + n > der.length) throw new Error('подпись оборвалась');
    let value = der.subarray(pos, pos + n);
    pos += n;
    while (value.length > 32 && value[0] === 0) value = value.subarray(1);
    if (value.length > 32) throw new Error('неверная подпись');
    raw.set(value, k * 32 + 32 - value.length);
  }
  return raw;
}

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes));
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// clientDataJSON: что за операция, какой вызов подписан и на каком сайте.
function readClientData(bytes, type, challenge, origin) {
  let data;
  try {
    data = JSON.parse(utf8.decode(bytes));
  } catch (e) {
    throw new Error('неверный ответ телефона');
  }
  if (data.type !== type) throw new Error('не та операция');
  if (data.challenge !== challenge) throw new Error('вход устарел');
  if (data.origin !== origin) throw new Error('ключ с другого сайта');
  if (data.crossOrigin === true) throw new Error('ключ из чужой рамки');
  return data;
}

// Регистрация нового ключа. На входе — поля ответа браузера в base64url.
// Возвращает { id, jwk, rpId } для сохранения.
export async function verifyRegistration(response, { challenge, origin }) {
  readClientData(unb64u(response.clientDataJSON), 'webauthn.create', challenge, origin);
  const attestation = cborDecode(unb64u(response.attestationObject)).value;
  if (!(attestation instanceof Map) || !(attestation.get('authData') instanceof Uint8Array)) throw new Error('неверный ответ телефона');
  const auth = parseAuthData(attestation.get('authData'));
  const rpId = new URL(origin).hostname;
  if (!same(auth.rpIdHash, await sha256(rpId))) throw new Error('ключ для другого сайта');
  if (!auth.up || !auth.uv) throw new Error('телефон не подтвердил Face ID или код-пароль');
  if (!auth.credentialId) throw new Error('нет нового ключа');
  const jwk = coseToJwk(auth.cose);
  await crypto.subtle.importKey('jwk', jwk, algorithm(jwk).importAs, false, ['verify']); // ключ настоящий
  return { id: b64u(auth.credentialId), jwk, rpId };
}

// Вход: подпись телефона над authenticatorData ‖ SHA-256(clientDataJSON).
export async function verifyAssertion(response, { challenge, origin, rpId, jwk }) {
  const clientBytes = unb64u(response.clientDataJSON);
  readClientData(clientBytes, 'webauthn.get', challenge, origin);
  const authBytes = unb64u(response.authenticatorData);
  const auth = parseAuthData(authBytes);
  if (!same(auth.rpIdHash, await sha256(rpId))) throw new Error('ключ для другого сайта');
  if (!auth.up || !auth.uv) throw new Error('телефон не подтвердил Face ID или код-пароль');
  const { importAs, verifyAs } = algorithm(jwk);
  const key = await crypto.subtle.importKey('jwk', jwk, importAs, false, ['verify']);
  const signed = new Uint8Array(authBytes.length + 32);
  signed.set(authBytes);
  signed.set(await sha256(clientBytes), authBytes.length);
  const raw = unb64u(response.signature);
  const ok = await crypto.subtle.verify(verifyAs, key, jwk.kty === 'EC' ? derToRaw(raw) : raw, signed);
  if (!ok) throw new Error('подпись не сошлась');
  return { signCount: auth.signCount };
}
