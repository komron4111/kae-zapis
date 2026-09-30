-- Вход администратора по Face ID, Touch ID или код-паролю телефона (WebAuthn, «ключи входа»).
-- Секретная часть ключа — только в телефоне, здесь — открытая.
CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,            -- id ключа (base64url)
  owner TEXT NOT NULL,            -- чей ключ: 'admin'
  rp_id TEXT NOT NULL,            -- для какого сайта: nailapp.pages.dev, komron4111.github.io
  public_key TEXT NOT NULL,       -- открытый ключ (JWK)
  name TEXT NOT NULL DEFAULT '',  -- «iPhone», «Mac» — чтобы администратор узнал своё устройство
  created TEXT NOT NULL,
  used TEXT                       -- последний вход
);
CREATE INDEX passkeys_by_owner ON passkeys (owner, rp_id);

-- Одноразовые вызовы WebAuthn: живут 5 минут, удаляются при проверке.
CREATE TABLE challenges (value TEXT PRIMARY KEY, kind TEXT NOT NULL, at INTEGER NOT NULL);

-- Вход администратора по Face ID действует 12 часов; хранится только хэш.
CREATE TABLE admin_sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
