// Адрес сервера (с 2.9.0 — свой сервер в Казахстане, backend/node). На beautybook.kz сайт и сервер — один адрес.
// Прежние адреса сайта (Cloudflare Pages, GitHub Pages) ходят на прежний адрес сервера на Cloudflare — он только
// пересылает запросы на свой сервер (backend/proxy). Для проверки на компьютере адрес подменяется: localStorage['kae:api'].
// Сменился адрес — поменяйте его и в политике безопасности (CSP) в index.html, okna/ и admin/, и в errors.js.
export const OWN_HOSTS = ['beautybook.kz', 'www.beautybook.kz'];
export const API_URL = OWN_HOSTS.includes(location.hostname) ? location.origin : 'https://kae-zapis-api.kae-zapis.workers.dev';

// Основной адрес сайта (с 2.9.0 — свой домен). На нём ссылки для клиентов — okna/?m=… и личные ссылки на запись,
// даже если приложение открыто со старых адресов beautybook-kz.pages.dev, nailapp.pages.dev или
// komron4111.github.io/kae-zapis/ (они работают по-прежнему).
export const PUBLIC_URL = 'https://beautybook.kz/';

// Версия сайта: приложение мастера, страница клиентов и «BB Админ» выкладываются вместе. Поднимать при каждом
// выпуске вместе с VERSION в sw.js. Её показывают «Настройки» приложения и низ страницы администратора (2.9.2).
export const APP_VERSION = '2.9.2';

// Сайт открыт на компьютере для проверки — ссылки тогда ведут на него же.
export const IS_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/.test(location.hostname);
