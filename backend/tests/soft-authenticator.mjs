// Программный «телефон» для тестов входа по Face ID: создаёт ключ и подписывает вход так же,
// как настоящий (WebAuthn, attestation «none», ES256 с подписью в DER или RS256).
// Работает и в Node (tests/), и в браузере — подменяет navigator.credentials на странице
// администратора при проверке на компьютере, где нет Face ID.

const b64u = bytes => {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = str => {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
};
const bytes = x => (x instanceof Uint8Array ? x : ArrayBuffer.isView(x) ? new Uint8Array(x.buffer, x.byteOffset, x.byteLength) : new Uint8Array(x));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
const sha256 = async data => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? new TextEncoder().encode(data) : data));

// CBOR для записи: целые, байты, строки, карты.
function cbor(value) {
  const head = (major, n) => (n < 24 ? [major << 5 | n] : n < 256 ? [major << 5 | 24, n] : [major << 5 | 25, n >> 8, n & 255]);
  if (typeof value === 'number') return Uint8Array.from(value >= 0 ? head(0, value) : head(1, -1 - value));
  if (typeof value === 'string') { const b = new TextEncoder().encode(value); return concat(Uint8Array.from(head(3, b.length)), b); }
  if (value instanceof Uint8Array) return concat(Uint8Array.from(head(2, value.length)), value);
  if (value instanceof Map) return concat(Uint8Array.from(head(5, value.size)), ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)]));
  throw new Error('cbor: неизвестный тип');
}

// r‖s → DER, как отдают настоящие телефоны.
function rawToDer(raw) {
  const int = part => {
    let i = 0;
    while (i < part.length - 1 && part[i] === 0) i++;
    let v = part.subarray(i);
    if (v[0] & 0x80) v = concat(Uint8Array.of(0), v);
    return concat(Uint8Array.of(0x02, v.length), v);
  };
  const body = concat(int(raw.subarray(0, 32)), int(raw.subarray(32)));
  return concat(Uint8Array.of(0x30, body.length), body);
}

const credentials = new Map(); // id → { privateKey, alg, rpId }

// navigator.credentials.create({ publicKey }) → PublicKeyCredential-подобный объект.
export async function create(publicKey, origin, { flags = 0x45, alg = -7 } = {}) {
  const rpId = (publicKey.rp && publicKey.rp.id) || new URL(origin).hostname;
  const keys = alg === -7
    ? await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    : await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
  const cose = alg === -7
    ? new Map([[1, 2], [3, -7], [-1, 1], [-2, unb64u(jwk.x)], [-3, unb64u(jwk.y)]])
    : new Map([[1, 3], [3, -257], [-1, unb64u(jwk.n)], [-2, unb64u(jwk.e)]]);
  const id = crypto.getRandomValues(new Uint8Array(16));
  const authData = concat(await sha256(rpId), Uint8Array.of(flags, 0, 0, 0, 0), new Uint8Array(16), Uint8Array.of(0, id.length), id, cbor(cose));
  const attestationObject = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
  const clientDataJSON = new TextEncoder().encode(JSON.stringify({ type: 'webauthn.create', challenge: b64u(bytes(publicKey.challenge)), origin, crossOrigin: false }));
  credentials.set(b64u(id), { privateKey: keys.privateKey, alg, rpId });
  return { id: b64u(id), rawId: id.buffer, type: 'public-key', response: { clientDataJSON: clientDataJSON.buffer, attestationObject: attestationObject.buffer } };
}

// navigator.credentials.get({ publicKey }) — подписывает вход ключом из allowCredentials (или последним).
export async function get(publicKey, origin, { flags = 0x05 } = {}) {
  const allowed = (publicKey.allowCredentials || []).map(c => b64u(bytes(c.id)));
  const id = allowed.find(x => credentials.has(x)) || (allowed.length ? null : [...credentials.keys()].pop());
  if (!id) throw Object.assign(new Error('Нет ключа для этого сайта'), { name: 'NotAllowedError' });
  const { privateKey, alg, rpId } = credentials.get(id);
  const clientDataJSON = new TextEncoder().encode(JSON.stringify({ type: 'webauthn.get', challenge: b64u(bytes(publicKey.challenge)), origin, crossOrigin: false }));
  const authenticatorData = concat(await sha256(publicKey.rpId || rpId), Uint8Array.of(flags, 0, 0, 0, 0));
  const signed = concat(authenticatorData, await sha256(clientDataJSON));
  const signature = alg === -7
    ? rawToDer(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, signed)))
    : new Uint8Array(await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, privateKey, signed));
  return { id, rawId: unb64u(id).buffer, type: 'public-key', response: { clientDataJSON: clientDataJSON.buffer, authenticatorData: authenticatorData.buffer, signature: signature.buffer, userHandle: null } };
}

// Ответы браузера → тело запроса к серверу (как на странице администратора).
export const registrationJson = c => ({ id: b64u(c.rawId), clientDataJSON: b64u(c.response.clientDataJSON), attestationObject: b64u(c.response.attestationObject) });
export const assertionJson = c => ({ id: b64u(c.rawId), clientDataJSON: b64u(c.response.clientDataJSON), authenticatorData: b64u(c.response.authenticatorData), signature: b64u(c.response.signature) });
export { b64u, unb64u };
