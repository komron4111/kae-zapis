// Адрес сервера заявок и облака (Cloudflare Workers, папка backend/).
// Для проверки на компьютере его можно подменить: localStorage['kae:api'].
// Сменился адрес — поменяйте его и в политике безопасности (CSP) в index.html, okna/ и admin/,
// и в errors.js.
export const API_URL = 'https://kae-zapis-api.kae-zapis.workers.dev';

// Основной адрес сайта (Cloudflare Pages). На нём ссылки для клиентов — okna/?m=… и личные
// ссылки на запись, даже если приложение открыто со старого адреса komron4111.github.io/kae-zapis/.
export const PUBLIC_URL = 'https://nailapp.pages.dev/';

// Сайт открыт на компьютере для проверки — ссылки тогда ведут на него же.
export const IS_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/.test(location.hostname);
