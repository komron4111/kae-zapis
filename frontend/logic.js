// Логика без интерфейса: даты, деньги, рабочее время и свободные окошки,
// заявки клиентов, отчёт за месяц, телефоны, клиенты, резервная копия.
// Общая для приложения, страницы клиентов и сервера (backend/ берёт этот файл при выкладке).
// Проверяется тестами в tests/.

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// ---------- Язык (2.7.0): русский и казахский ----------
// Язык выбирает i18n.js (приложение, страница клиентов, администратор): setLang('kk', t).
// Сервер язык не ставит — у него всё по-русски, а казахский он просит явно (shortDate(d, 'kk')).
const KK_MONTHS = ['Қаңтар', 'Ақпан', 'Наурыз', 'Сәуір', 'Мамыр', 'Маусым', 'Шілде', 'Тамыз', 'Қыркүйек', 'Қазан', 'Қараша', 'Желтоқсан'];
const KK_WEEKDAYS = ['Жексенбі', 'Дүйсенбі', 'Сейсенбі', 'Сәрсенбі', 'Бейсенбі', 'Жұма', 'Сенбі'];
const KK_WEEKDAYS_SHORT = ['Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб', 'Жс'];
let LANG = 'ru';
let translate = text => text;
export function setLang(lang, tr) {
  LANG = lang === 'kk' ? 'kk' : 'ru';
  if (tr) translate = tr;
}
export const getLang = () => LANG;
// Название месяца: «Октябрь» / «Қазан».
export const monthName = (i, lang = LANG) => (lang === 'kk' ? KK_MONTHS : MONTHS)[i];
// Месяц после числа: «1 октября» / «1 қазан».
export const dateMonth = (i, lang = LANG) => (lang === 'kk' ? KK_MONTHS[i].toLowerCase() : MONTHS_GEN[i]);
export const weekdaysShort = (lang = LANG) => (lang === 'kk' ? KK_WEEKDAYS_SHORT : WEEKDAYS_SHORT);

export const DEFAULT_RENT = 0; // своя сумма — в «Настройки» → «Аренда» (до 2.2.1 было 70 000 ₸ Арай)

// Рабочее время: запись можно начать с dayStart до lastStart включительно.
// duration — сколько длится услуга, у которой в прайсе не указана длительность.
// specialty — направление мастера, instagram — ник для клиентов, kaspi — номер для счёта Kaspi за подписку.
// remindDays, remindHours — за сколько дней и часов до записи напомнить мастеру уведомлением (2.8.0; 0 — не напоминать).
export const DEFAULT_SETTINGS = { dayStart: '09:00', lastStart: '20:00', duration: 150, clientName: '', whatsapp: '', address: '', gis: '', instagram: '', specialty: '', kaspi: '', theme: 'neon', remindDays: 0, remindHours: 2 };
// Что можно выбрать в «Напоминаниях о записях».
export const REMIND_DAYS = [0, 1, 2, 3, 7];
export const REMIND_HOURS = [0, 1, 2, 3, 4, 5, 6, 12];
// Темы оформления: id → название в «Настройках». Цвета — в style.css. «Графит» — тёмная,
// без розового (например, для парикмахеров и барберов). Клиенты видят страницу записи в теме мастера.
// «Розово-чёрная» (2.7.0) — как фон значка на экране «Домой»: чёрный с розовым неоном; в «Оформлении» — первой, во всю ширину.
export const THEMES = { neon: 'Розово-чёрная', rose: 'Розовая', plum: 'Пурпурная', lavender: 'Фиолетовая', graphite: 'Графит' };

// 2.9.1: исходная тема — розово-чёрная (до 2.9.1 — пурпурная). У данных до 2.9.1 пурпурная один раз меняется
// на розово-чёрную; пурпурная, выбранная после этого, остаётся: отметка themeV в настройках (она же — в копии).
export const THEME_V = 2;
export function upgradeTheme(settings) {
  if (!settings || settings.themeV === THEME_V) return false;
  if (settings.theme === 'plum') settings.theme = 'neon';
  settings.themeV = THEME_V;
  return true;
}

// Направления мастера — подсказки при регистрации; можно вписать своё.
export const SPECIALTIES = ['Маникюр и педикюр', 'Парикмахер', 'Барбер', 'Брови и ресницы', 'Визажист', 'Косметолог', 'Массаж', 'Депиляция и шугаринг', 'Тату и перманент'];
// Одна строка до 40 знаков; теги и угловые скобки убираем: направление — простой текст.
export const specialtyText = value => String(value == null ? '' : value).replace(/<[^>]*>/g, ' ').replace(/[<>]/g, '')
  .trim().replace(/\s+/g, ' ').slice(0, 40);

// Прайс по направлению (с 2.5.0): новому мастеру прайс заполняется услугами его направления
// с длительностью, цены мастер вписывает сам. [название, минуты]
export const SPECIALTY_SERVICES = {
  'Маникюр и педикюр': [
    ['Маникюр без покрытия', 60], ['Маникюр с покрытием гель-лак', 90], ['Маникюр с укреплением и покрытием', 120],
    ['Наращивание ногтей', 150], ['Коррекция наращивания', 120], ['Снятие покрытия', 20], ['Дизайн ногтей', 30],
    ['Педикюр без покрытия', 60], ['Педикюр с покрытием гель-лак', 90], ['Маникюр и педикюр с покрытием', 180],
  ],
  'Парикмахер': [
    ['Женская стрижка', 60], ['Мужская стрижка', 45], ['Детская стрижка', 30], ['Стрижка чёлки', 15], ['Укладка', 45],
    ['Окрашивание в один тон', 120], ['Окрашивание корней', 90], ['Мелирование', 180], ['Сложное окрашивание (балаяж, шатуш)', 240],
    ['Тонирование', 60], ['Кератиновое выпрямление', 180], ['Вечерняя причёска', 60],
  ],
  'Барбер': [
    ['Мужская стрижка', 60], ['Стрижка машинкой', 30], ['Стрижка и борода', 90], ['Оформление бороды', 30],
    ['Королевское бритьё', 45], ['Детская стрижка', 45], ['Камуфляж седины', 30], ['Отец и сын', 90],
  ],
  'Брови и ресницы': [
    ['Коррекция бровей', 30], ['Коррекция и окрашивание бровей', 45], ['Ламинирование бровей', 60],
    ['Наращивание ресниц (классика)', 120], ['Наращивание ресниц (2D–3D)', 150], ['Коррекция наращивания ресниц', 90],
    ['Снятие ресниц', 20], ['Ламинирование ресниц', 60], ['Окрашивание ресниц', 20],
  ],
  'Визажист': [
    ['Дневной макияж', 60], ['Вечерний макияж', 75], ['Свадебный макияж', 90], ['Пробный свадебный макияж', 90],
    ['Макияж и причёска', 120], ['Экспресс-макияж', 30], ['Урок макияжа для себя', 120],
  ],
  'Косметолог': [
    ['Консультация', 30], ['Комбинированная чистка лица', 90], ['Ультразвуковая чистка лица', 60], ['Пилинг', 45],
    ['Уход по типу кожи', 60], ['Массаж лица', 45], ['Альгинатная маска', 30], ['Карбокситерапия', 45],
    ['Биоревитализация', 45], ['Мезотерапия', 45],
  ],
  'Массаж': [
    ['Классический массаж всего тела', 60], ['Массаж спины', 40], ['Массаж шейно-воротниковой зоны', 30],
    ['Антицеллюлитный массаж', 60], ['Лимфодренажный массаж', 60], ['Расслабляющий массаж', 60], ['Спортивный массаж', 60],
    ['Массаж лица', 30], ['Массаж ног', 30], ['Детский массаж', 30],
  ],
  'Депиляция и шугаринг': [
    ['Шугаринг подмышек', 20], ['Шугаринг голеней', 30], ['Шугаринг ног полностью', 60], ['Шугаринг рук', 30],
    ['Классическое бикини', 30], ['Глубокое бикини', 45], ['Шугаринг лица', 20],
    ['Комплекс: глубокое бикини и подмышки', 60], ['Восковая депиляция ног', 60],
  ],
  'Тату и перманент': [
    ['Консультация и эскиз', 30], ['Перманентный макияж бровей', 120], ['Перманентный макияж губ', 120],
    ['Межресничная стрелка', 90], ['Коррекция перманента', 90], ['Удаление перманента ремувером', 60],
    ['Мини-тату', 60], ['Тату (средний размер)', 180],
  ],
};

// По-казахски: направления (те же ключи) и услуги для прайса мастера, выбравшего казахский язык.
export const SPECIALTIES_KK = {
  'Маникюр и педикюр': 'Маникюр және педикюр', 'Парикмахер': 'Шаштараз', 'Барбер': 'Барбер', 'Брови и ресницы': 'Қас пен кірпік',
  'Визажист': 'Визажист', 'Косметолог': 'Косметолог', 'Массаж': 'Массаж', 'Депиляция и шугаринг': 'Депиляция және шугаринг',
  'Тату и перманент': 'Тату және перманент',
};
export const SPECIALTY_SERVICES_KK = {
  'Маникюр и педикюр': ['Жабынсыз маникюр', 'Гель-лак жабыны бар маникюр', 'Нығайтып, жабын салатын маникюр', 'Тырнақ ұзарту',
    'Ұзартылған тырнақты түзету', 'Жабынды алу', 'Тырнақ дизайны', 'Жабынсыз педикюр', 'Гель-лак жабыны бар педикюр', 'Жабыны бар маникюр мен педикюр'],
  'Парикмахер': ['Әйелдер шаш үлгісі', 'Ерлер шаш үлгісі', 'Балалар шаш үлгісі', 'Кекіл қию', 'Шаш сәндеу', 'Шашты бір түске бояу',
    'Шаш түбін бояу', 'Мелирлеу', 'Күрделі бояу (балаяж, шатуш)', 'Тондау', 'Кератинмен түзулеу', 'Кешкі шаш үлгісі'],
  'Барбер': ['Ерлер шаш үлгісі', 'Машинкамен қию', 'Шаш үлгісі және сақал', 'Сақалды сәндеу', 'Корольдік қырыну', 'Балалар шаш үлгісі',
    'Ақ шашты бояу (камуфляж)', 'Әке мен бала'],
  'Брови и ресницы': ['Қас түзету', 'Қас түзету және бояу', 'Қасты ламинациялау', 'Кірпік ұзарту (классика)', 'Кірпік ұзарту (2D–3D)',
    'Ұзартылған кірпікті түзету', 'Кірпікті алу', 'Кірпікті ламинациялау', 'Кірпікті бояу'],
  'Визажист': ['Күндізгі макияж', 'Кешкі макияж', 'Той макияжы', 'Той макияжын алдын ала жасап көру', 'Макияж және шаш үлгісі',
    'Жедел макияж', 'Өзіңізге макияж жасауды үйрену'],
  'Косметолог': ['Кеңес', 'Бетті аралас тазалау', 'Бетті ультрадыбыспен тазалау', 'Пилинг', 'Тері түріне қарай күтім', 'Бет массажы',
    'Альгинат маскасы', 'Карбокситерапия', 'Биоревитализация', 'Мезотерапия'],
  'Массаж': ['Бүкіл денеге классикалық массаж', 'Арқа массажы', 'Мойын мен жауырын массажы', 'Антицеллюлит массажы', 'Лимфодренаж массажы',
    'Босаңсытатын массаж', 'Спорттық массаж', 'Бет массажы', 'Аяқ массажы', 'Балалар массажы'],
  'Депиляция и шугаринг': ['Қолтық шугарингі', 'Сирақ шугарингі', 'Аяқты толық шугаринг', 'Қол шугарингі', 'Классикалық бикини',
    'Терең бикини', 'Бет шугарингі', 'Кешен: терең бикини және қолтық', 'Аяқты балауызбен депиляциялау'],
  'Тату и перманент': ['Кеңес және эскиз', 'Қастың перманентті макияжы', 'Еріннің перманентті макияжы', 'Кірпікаралық сызық',
    'Перманентті түзету', 'Перманентті ремувермен кетіру', 'Шағын тату', 'Тату (орташа көлем)'],
};

// Направление на языке страницы: из списка — переводим (в обе стороны), своё — как вписал мастер.
export function specialtyName(value, lang = LANG) {
  const text = specialtyText(value);
  if (lang === 'kk') return SPECIALTIES_KK[text] || text;
  return Object.keys(SPECIALTIES_KK).find(k => SPECIALTIES_KK[k] === text) || text;
}

// Своё направление (вписано словами) — по ключевым словам; берётся первое подходящее
// в этом порядке: «перманентный макияж бровей» — перманент, «барбер, мужские стрижки» — барбер.
const SPECIALTY_KEYS = [
  ['Тату и перманент', /тату|перман|tattoo/],
  ['Барбер', /барбер|barber|бород|сақал/],
  ['Маникюр и педикюр', /маник|педик|ногт|тырнақ|nail/],
  ['Брови и ресницы', /бров|ресниц|қас|кірпік|лэш|lash|brow/],
  ['Визажист', /визаж|макияж|make ?up/],
  ['Косметолог', /космет|эстетист|чистк/],
  ['Массаж', /массаж|massage/],
  ['Депиляция и шугаринг', /депил|шугар|эпил|воск|балауыз|sugar/],
  ['Парикмахер', /парикмах|шаштараз|стилист|колорист|волос|шаш|стриж|hair/],
];

// Услуги для прайса по направлению: [[название, минуты], …]; не узнали направление — пусто.
// lang = 'kk' — названия по-казахски (длительность та же).
export function servicesForSpecialty(value, lang = LANG) {
  const text = specialtyText(value).toLowerCase();
  if (!text) return [];
  const key = Object.keys(SPECIALTY_SERVICES).find(k => k.toLowerCase() === text || SPECIALTIES_KK[k].toLowerCase() === text)
    || (SPECIALTY_KEYS.find(([, re]) => re.test(text)) || [])[0];
  if (!key) return [];
  return SPECIALTY_SERVICES[key].map(([name, minutes], i) => [lang === 'kk' ? SPECIALTY_SERVICES_KK[key][i] : name, minutes]);
}

// Тариф «Про» (единственный): месяц или год. Первые TRIAL_DAYS дней после регистрации — бесплатно.
export const TARIFF = { month: { months: 1, price: 2990, title: 'Месяц' }, year: { months: 12, price: 29900, title: 'Год' } };
export const TRIAL_DAYS = 7;
// Клиентам время предлагается с шагом 30 минут.
export const SLOT_STEP = 30;
// На сколько дней вперёд публикуются свободные окошки.
export const HORIZON_DAYS = 30;

// booked — записана (получена только предоплата), paid — оплачено полностью,
// cancelled — отменена (предоплата остаётся у мастера, если её не вернули).
export const STATUSES = ['booked', 'paid', 'cancelled'];
export const STATUS_LABELS = { booked: 'Записана', paid: 'Оплачена', cancelled: 'Отменена' };

// ---------- Даты ----------
// Только местное время: toISOString() сдвинул бы дату (Казахстан — UTC+5).

const pad2 = n => String(n).padStart(2, '0');

export function ymd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseYmd(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function monthOf(dateStr) {
  return dateStr.slice(0, 7);
}

export function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function monthTitle(ym, lang = LANG) {
  const [y, m] = ym.split('-').map(Number);
  return `${monthName(m - 1, lang)} ${y}`;
}

// «Четверг, 1 октября» / «Бейсенбі, 1 қазан».
export function dayTitle(dateStr, lang = LANG) {
  const d = parseYmd(dateStr);
  return `${(lang === 'kk' ? KK_WEEKDAYS : WEEKDAYS)[d.getDay()]}, ${d.getDate()} ${dateMonth(d.getMonth(), lang)}`;
}

export function shortDate(dateStr, lang = LANG) {
  const d = parseYmd(dateStr);
  return `${d.getDate()} ${dateMonth(d.getMonth(), lang)}`;
}

// Дата с падежом по-казахски: «7 қазанда» (когда) и «7 қазанға дейін» (до какого дня);
// по-русски — «7 октября» и «до 7 октября».
const KK_AT = ['да', 'да', 'да', 'де', 'да', 'да', 'де', 'да', 'те', 'да', 'да', 'да'];
const KK_TO = ['ға', 'ға', 'ға', 'ге', 'ға', 'ға', 'ге', 'ға', 'ке', 'ға', 'ға', 'ға'];
export function dateOn(dateStr, lang = LANG) {
  const d = parseYmd(dateStr);
  return lang === 'kk' ? `${d.getDate()} ${dateMonth(d.getMonth(), 'kk')}${KK_AT[d.getMonth()]}` : shortDate(dateStr, lang);
}
export function dateUntil(dateStr, lang = LANG) {
  const d = parseYmd(dateStr);
  return lang === 'kk' ? `${d.getDate()} ${dateMonth(d.getMonth(), 'kk')}${KK_TO[d.getMonth()]} дейін` : `до ${shortDate(dateStr, lang)}`;
}

// С годом: «7 октября 2026» / «2026 ж. 7 қазан» (по-казахски год впереди); с падежом — «2026 ж. 7 қазанда»,
// «2026 ж. 7 қазанға дейін» (по-русски — «7 октября 2026», «до 7 октября 2026»).
const withYear = (dateStr, text, lang) => (lang === 'kk' ? `${dateStr.slice(0, 4)} ж. ${text}` : `${text} ${dateStr.slice(0, 4)}`);
export const fullDate = (dateStr, lang = LANG) => withYear(dateStr, shortDate(dateStr, lang), lang);
export const fullDateOn = (dateStr, lang = LANG) => withYear(dateStr, dateOn(dateStr, lang), lang);
export const fullDateUntil = (dateStr, lang = LANG) => withYear(dateStr, dateUntil(dateStr, lang), lang);

// Срок: «1 октября – 31 октября 2026» / «2026 ж. 1 қазан – 31 қазан» (год один раз, если он общий).
export function dateSpan(from, until, lang = LANG) {
  if (lang === 'kk' && from.slice(0, 4) === until.slice(0, 4)) return withYear(until, `${shortDate(from, 'kk')} – ${shortDate(until, 'kk')}`, 'kk');
  return `${lang === 'kk' ? fullDate(from, 'kk') : shortDate(from, lang)} – ${fullDate(until, lang)}`;
}
// То же словами по-русски: «с 1 октября по 31 октября 2026».
export const dateRange = (from, until, lang = LANG) => (lang === 'kk' ? dateSpan(from, until, 'kk') : `с ${shortDate(from, lang)} по ${fullDate(until, lang)}`);

export function addDays(dateStr, n) {
  const d = parseYmd(dateStr);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

// Клетки календаря: недели с понедельника, 5 или 6 строк.
export function monthGrid(ym) {
  const [y, m] = ym.split('-').map(Number);
  const shift = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = Math.ceil((shift + daysInMonth) / 7) * 7;
  const out = [];
  for (let i = 0; i < cells; i++) out.push(ymd(new Date(y, m - 1, 1 - shift + i)));
  return out;
}

// plural(5, ['запись', 'записи', 'записей', 'жазылу']) → 'записей'. По-казахски слово после числа
// не меняется — четвёртое слово (или перевод первого): «5 жазылу».
export function plural(n, forms, lang = LANG) {
  if (lang === 'kk') return forms[3] || translate(forms[0]);
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}

// ---------- Услуги: в одной записи может быть несколько ----------

// Старые записи хранили одну услугу строкой в поле service.
export function servicesOf(a) {
  if (Array.isArray(a.services)) return a.services;
  return a.service ? [a.service] : [];
}

export function servicesLabel(list) {
  return list.join(' + ');
}

// Сумма по прайсу; услуги, которых в прайсе нет, не считаются.
export function servicesTotal(names, prices) {
  return names.reduce((sum, name) => {
    const p = prices.find(x => x.name === name);
    return sum + (p ? p.price : 0);
  }, 0);
}

// ---------- Деньги: целые тенге ----------

// «12 000» → 12000. В поле суммы вводятся только цифры.
export function toMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const digits = String(value == null ? '' : value).replace(/\D/g, '').slice(0, 9);
  return digits ? parseInt(digits, 10) : 0;
}

function groupDigits(n, sep) {
  return String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

// 70000 → «70 000 ₸», −5000 → «−5 000 ₸» (неразрывные пробелы).
export function formatMoney(n) {
  return `${n < 0 ? '−' : ''}${groupDigits(n, ' ')} ₸`;
}

// Для полей ввода: 12000 → «12 000», 0 → пусто.
export function formatAmount(n) {
  return n ? groupDigits(n, ' ') : '';
}

// ---------- Запись: сколько получено и сколько осталось ----------

export function received(a) {
  return a.status === 'paid' ? a.total : a.prepaid;
}

export function balanceDue(a) {
  return a.status === 'booked' ? Math.max(a.total - a.prepaid, 0) : 0;
}

// ---------- Аренда: каждая сумма действует с месяца from ----------

export function rentFor(history, ym) {
  let best = null;
  for (const r of history) if (r.from <= ym && (!best || r.from > best.from)) best = r;
  return best ? best.amount : 0;
}

// Новая сумма с месяца ym; прошлые месяцы сохраняют старую.
export function setRent(history, ym, amount) {
  return history.filter(r => r.from < ym).concat({ from: ym, amount });
}

// ---------- Отчёт за месяц ----------
// Приход — деньги, реально полученные по записям месяца:
// полная сумма оплаченных записей и предоплаты остальных.

export function monthReport(data, ym) {
  let income = 0, expected = 0, paidVisits = 0;
  for (const a of data.appointments) {
    if (monthOf(a.date) !== ym) continue;
    income += received(a);
    expected += balanceDue(a);
    if (a.status === 'paid') paidVisits++;
  }
  let materials = 0;
  for (const e of data.expenses) if (monthOf(e.date) === ym) materials += e.amount;
  const rent = rentFor(data.rent, ym);
  return { income, materials, rent, profit: income - materials - rent, expected, paidVisits };
}

// ---------- Время ----------

export function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(min) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

// '09:00' → '9:00'
export function shortTime(hhmm) {
  return String(hhmm).replace(/^0(\d)/, '$1');
}

// Время с падежом по-казахски — окончание по последнему слову числа («нөл», «отыз», «бес»…):
// timeTo — «16:00-ге дейін» / «до 16:00», timeFrom — «9:00-ден» / «с 9:00», timeAt — «14:30-да» / «в 14:30».
const KK_DIGIT = ['нөл', 'бір', 'екі', 'үш', 'төрт', 'бес', 'алты', 'жеті', 'сегіз', 'тоғыз'];
const KK_TENS = ['нөл', 'он', 'жиырма', 'отыз', 'қырық', 'елу'];
const KK_CASES = { // слово: [барыс «до», шығыс «с», жатыс «в»]
  'нөл': ['ге', 'ден', 'де'], 'бір': ['ге', 'ден', 'де'], 'екі': ['ге', 'ден', 'де'], 'үш': ['ке', 'тен', 'те'], 'төрт': ['ке', 'тен', 'те'],
  'бес': ['ке', 'тен', 'те'], 'алты': ['ға', 'дан', 'да'], 'жеті': ['ге', 'ден', 'де'], 'сегіз': ['ге', 'ден', 'де'], 'тоғыз': ['ға', 'дан', 'да'],
  'он': ['ға', 'нан', 'да'], 'жиырма': ['ға', 'дан', 'да'], 'отыз': ['ға', 'дан', 'да'], 'қырық': ['қа', 'тан', 'та'], 'елу': ['ге', 'ден', 'де'],
};
function kkTime(hhmm, c) {
  const min = Number(String(hhmm).slice(-2)) || 0;
  const word = min % 10 ? KK_DIGIT[min % 10] : KK_TENS[min / 10];
  return `${shortTime(hhmm)}-${KK_CASES[word][c]}`;
}
export const timeTo = (hhmm, lang = LANG) => (lang === 'kk' ? `${kkTime(hhmm, 0)} дейін` : `до ${shortTime(hhmm)}`);
export const timeFrom = (hhmm, lang = LANG) => (lang === 'kk' ? kkTime(hhmm, 1) : `с ${shortTime(hhmm)}`);
export const timeAt = (hhmm, lang = LANG) => (lang === 'kk' ? kkTime(hhmm, 2) : `в ${shortTime(hhmm)}`);

// 150 → '2 ч 30 мин' / '2 сағ 30 мин'
export function formatDuration(min, lang = LANG) {
  const h = Math.floor(min / 60), m = min % 60;
  return [h ? `${h} ${lang === 'kk' ? 'сағ' : 'ч'}` : '', m ? `${m} мин` : ''].filter(Boolean).join(' ');
}

// ---------- Закрытые дни и закрытое время ----------

// Блок записи: { id, from, to, note } — даты включительно, закрыт весь день.
// С start и end ('HH:MM') в каждый из этих дней закрыто только время [start, end):
// для клиентов оно занято, как запись.
export function isTimeBlock(b) {
  return Boolean(b && b.start && b.end);
}

// Время start–end подходит для закрытия: 'HH:MM' в пределах суток, начало раньше конца.
export function isTimeWindow(start, end) {
  const ok = t => TIME_RE.test(t || '') && Number(t.slice(0, 2)) < 24 && Number(t.slice(3)) < 60;
  return ok(start) && ok(end) && start < end;
}

// Закрытый целиком день.
export function blockFor(blocks, date) {
  return (blocks || []).find(b => !isTimeBlock(b) && b.from <= date && date <= b.to) || null;
}

// Закрытое время дня — по порядку начала.
export function timeBlocksOn(blocks, date) {
  return (blocks || []).filter(b => isTimeBlock(b) && b.from <= date && date <= b.to).sort((x, y) => x.start.localeCompare(y.start));
}

// Закрытое время дня в минутах: [начало, конец).
export function closedIntervals(blocks, date) {
  return timeBlocksOn(blocks, date).map(b => [toMinutes(b.start), toMinutes(b.end)]);
}

// Закрытое время, с которым пересечётся запись в time длиной need.
export function closedConflicts(blocks, date, time, need) {
  const start = toMinutes(time);
  return timeBlocksOn(blocks, date).filter(b => start < toMinutes(b.end) && toMinutes(b.start) < start + need);
}

// Записи (кроме отменённых), которые попадут в закрытое: в закрытые дни — все,
// в закрытое время — те, что с ним пересекаются по длительности своих услуг.
export function blockConflicts(appointments, block, { prices = [], settings = DEFAULT_SETTINGS } = {}) {
  const timed = isTimeBlock(block);
  const from = timed ? toMinutes(block.start) : 0, to = timed ? toMinutes(block.end) : 0;
  return appointments.filter(a => {
    if (a.status === 'cancelled' || a.date < block.from || a.date > block.to) return false;
    if (!timed) return true;
    if (!a.time) return false;
    const start = toMinutes(a.time);
    return start < to && from < start + servicesDuration(servicesOf(a), prices, settings);
  });
}

// ---------- Длительность услуг ----------

// Сколько минут длится услуга по прайсу; без длительности — duration из настроек.
export function serviceMinutes(name, prices, settings) {
  const p = (prices || []).find(x => x.name === name);
  return p && p.duration > 0 ? p.duration : settings.duration;
}

// Сколько займёт запись: сумма её услуг. Без услуг — duration из настроек.
export function servicesDuration(services, prices, settings) {
  const list = (services || []).filter(Boolean);
  return list.length ? list.reduce((sum, name) => sum + serviceMinutes(name, prices, settings), 0) : settings.duration;
}

// Самая короткая услуга прайса. Пока услуги не выбраны, время свободно,
// если в него помещается хотя бы она.
export function shortestService(prices, settings) {
  const list = (prices || []).filter(p => p.name && p.name.trim()).map(p => (p.duration > 0 ? p.duration : settings.duration));
  return list.length ? Math.min(...list) : settings.duration;
}

// ---------- Свободное время ----------

const activeOn = (items, date, excludeId) => items.filter(a => a.date === date && a.status !== 'cancelled' && a.time && a.id !== excludeId);

// Занятое время дня: [начало, конец) в минутах — записи (кроме отменённых) и заявки.
// Конец — по услугам записи: после снятия маникюра время освобождается через 20 минут.
export function busyIntervals(items, date, prices, settings, excludeId) {
  return activeOn(items, date, excludeId).map(a => {
    const start = toMinutes(a.time);
    return [start, start + servicesDuration(servicesOf(a), prices, settings)];
  }).sort((x, y) => x[0] - y[0]);
}

// Свободные начала записи с шагом SLOT_STEP: не внутри занятого времени, и запись
// длиной need успевает закончиться до следующей. after — минуты: не позже него не предлагаем.
export function freeStarts(busy, settings, need, after = -1) {
  const out = [];
  for (let s = toMinutes(settings.dayStart); s <= toMinutes(settings.lastStart); s += SLOT_STEP) {
    if (s > after && busy.every(([b, e]) => s >= e || s + need <= b)) out.push(fromMinutes(s));
  }
  return out;
}

// Свободное время дня по записям (и заявкам) и закрытому времени из blocks — для приложения мастера.
// need — сколько длится новая запись (по умолчанию duration из настроек).
export function freeTimes(items, date, settings, after = -1, excludeId, { prices = [], need = settings.duration, blocks = [] } = {}) {
  return freeStarts([...busyIntervals(items, date, prices, settings, excludeId), ...closedIntervals(blocks, date)], settings, need, after);
}

// Записи, с которыми пересечётся новая запись в time длиной need.
export function conflicts(items, date, time, need, excludeId, { prices = [], settings = DEFAULT_SETTINGS } = {}) {
  const start = toMinutes(time);
  return activeOn(items, date, excludeId).filter(a => {
    const b = toMinutes(a.time);
    return start < b + servicesDuration(servicesOf(a), prices, settings) && b < start + need;
  });
}

// ['09:00', '09:30', '14:30'] → [['09:00', '09:30'], ['14:30', '14:30']]
export function toRanges(times) {
  const ranges = [];
  for (const t of times) {
    const last = ranges[ranges.length - 1];
    if (last && toMinutes(t) - toMinutes(last[1]) === SLOT_STEP) last[1] = t;
    else ranges.push([t, t]);
  }
  return ranges;
}

// → '9:00–9:30, 14:30'
export function formatRanges(ranges) {
  return ranges.map(([a, b]) => (a === b ? shortTime(a) : `${shortTime(a)}–${shortTime(b)}`)).join(', ');
}

// ---------- Подписка мастера ----------
// Доступ открыт по последний день периода включительно; на следующий день приложение
// просит продлить подписку. Период — месяц: с даты по день перед тем же числом следующего месяца.

// Тот же день через n месяцев; если такого дня нет (31 января → февраль) — последний день месяца.
export function addMonthsToDate(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12), nm = total - ny * 12;
  const last = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${pad2(nm + 1)}-${pad2(Math.min(d, last))}`;
}

// Последний день месячного периода, который начинается с start.
export function subscriptionEnd(start) {
  return addDays(addMonthsToDate(start, 1), -1);
}

// Следующий оплаченный срок (months месяцев: 1 — месяц, 12 — год): сразу после текущего периода,
// а если доступ уже закончился (или его не было) — с сегодняшнего дня.
export function nextPeriod(until, today, months = 1) {
  const start = until && until >= today ? addDays(until, 1) : today;
  return { start, end: addDays(addMonthsToDate(start, months), -1) };
}

// Бесплатные дни после регистрации: с дня регистрации, TRIAL_DAYS дней включительно.
export function trialPeriod(start) {
  return { start, end: addDays(start, TRIAL_DAYS - 1) };
}

// sub — { until: 'YYYY-MM-DD' | null, unlimited }.
export function subscriptionActive(sub, today) {
  return Boolean(sub && (sub.unlimited || (sub.until && today <= sub.until)));
}

// Сколько дней осталось после сегодняшнего (0 — сегодня последний день). null — бессрочно или без даты.
export function subscriptionDaysLeft(sub, today) {
  if (!sub || sub.unlimited || !sub.until) return null;
  return Math.round((parseYmd(sub.until) - parseYmd(today)) / 864e5);
}

// ---------- Где принимает мастер: адрес и 2ГИС ----------

// Адрес одной строкой, до 150 знаков.
export function addressText(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, 150);
}

// Ссылка на место в 2ГИС. Из текста «Поделиться» берём первую ссылку; можно и без https://.
// Подходят только адреса 2ГИС (2gis.kz, go.2gis.com и т. п.) — чужую ссылку клиентам не покажем.
// Возвращает https-ссылку или пусто.
export function gisLink(value) {
  const text = String(value == null ? '' : value);
  const found = text.match(/https?:\/\/[^\s<>"'«»]+/i) || text.match(/(?:^|\s)((?:[a-z0-9-]+\.)*2gis\.[a-z]{2,4}\/[^\s<>"'«»]*)/i);
  if (!found) return '';
  let url;
  try {
    url = new URL(found[1] && !/^https?:/i.test(found[0]) ? `https://${found[1]}` : found[0]);
  } catch (e) {
    return '';
  }
  if (!/^https?:$/.test(url.protocol) || !/(^|\.)2gis\.[a-z]{2,4}$/i.test(url.hostname) || url.username || url.password) return '';
  url.protocol = 'https:';
  return url.href.length <= 600 ? url.href : '';
}

// Что видят клиенты: занятое время на days дней вперёд (без имён и телефонов) — записи
// и закрытое мастером время, одинаково; рабочие часы и услуги с ценами и длительностью.
// Свободное время страница клиентов и сервер считают сами — под выбранные услуги.
// Прошедшее время сегодня отсекается там же.
export function buildSchedule(data, now = new Date(), days = HORIZON_DAYS) {
  const s = { ...DEFAULT_SETTINGS, ...data.settings };
  const prices = data.prices || [];
  const first = ymd(now);
  const list = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(first, i);
    if (blockFor(data.blocks, date)) {
      list.push({ date, off: true });
      continue;
    }
    const busy = [...busyIntervals(data.appointments, date, prices, s), ...closedIntervals(data.blocks, date)];
    list.push({ date, busy: busy.sort((x, y) => x[0] - y[0]) });
  }
  return {
    app: BACKUP_APP,
    kind: 'okna',
    v: 2,
    name: s.clientName,
    whatsapp: phoneDigits(s.whatsapp),
    address: addressText(s.address),
    gis: gisLink(s.gis),
    instagram: instagramName(s.instagram),
    specialty: specialtyText(s.specialty),
    theme: THEMES[s.theme] ? s.theme : DEFAULT_SETTINGS.theme,
    dayStart: s.dayStart,
    lastStart: s.lastStart,
    duration: s.duration,
    tzOffset: now.getTimezoneOffset(),
    services: prices.filter(p => p.name && p.name.trim()).map(p => ({ name: p.name.trim(), price: p.price, duration: p.duration > 0 ? p.duration : 0 })),
    updated: now.toISOString(),
    days: list,
  };
}

// Расписание приходит на сервер с телефона мастера как есть, а мастеров много. Всё, что
// увидят клиенты, пропускаем по образцу: даты, время и числа — строго своего вида,
// строки — обрезаны, лишние поля — отброшены. null — это не расписание.
export function cleanSchedule(raw) {
  if (!raw || typeof raw !== 'object' || raw.kind !== 'okna' || !Array.isArray(raw.days)) return null;
  const int = (v, min, max, def) => (Number.isFinite(v) && Math.round(v) >= min && Math.round(v) <= max ? Math.round(v) : def);
  const text = (v, max) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max);
  const interval = x => Array.isArray(x) && Number.isFinite(x[0]) && Number.isFinite(x[1]) && x[0] >= 0 && x[1] >= x[0] && x[1] <= 2880;
  const days = raw.days.slice(0, 62).filter(d => d && typeof d === 'object' && DATE_RE.test(d.date)).map(d => {
    if (d.off) return { date: d.date, off: true };
    if (Array.isArray(d.busy)) return { date: d.date, busy: d.busy.filter(interval).slice(0, 100).map(x => [Math.round(x[0]), Math.round(x[1])]) };
    return { date: d.date, times: (Array.isArray(d.times) ? d.times : []).filter(t => TIME_RE.test(t)).slice(0, 100) };
  });
  const updated = new Date(typeof raw.updated === 'string' ? raw.updated : 0);
  return {
    app: BACKUP_APP,
    kind: 'okna',
    v: int(raw.v, 1, 9, 1),
    name: text(raw.name, 40),
    whatsapp: phoneDigits(raw.whatsapp).slice(0, 15),
    address: addressText(raw.address),
    gis: gisLink(raw.gis),
    instagram: instagramName(raw.instagram),
    specialty: specialtyText(raw.specialty),
    theme: Object.prototype.hasOwnProperty.call(THEMES, raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
    dayStart: TIME_RE.test(raw.dayStart) ? raw.dayStart : DEFAULT_SETTINGS.dayStart,
    lastStart: TIME_RE.test(raw.lastStart) ? raw.lastStart : DEFAULT_SETTINGS.lastStart,
    duration: int(raw.duration, 5, 720, DEFAULT_SETTINGS.duration),
    tzOffset: int(raw.tzOffset, -900, 900, 0),
    services: (Array.isArray(raw.services) ? raw.services : []).slice(0, 60)
      .filter(p => p && typeof p === 'object')
      .map(p => ({ name: String(p.name == null ? '' : p.name).trim().slice(0, 80), price: toMoney(p.price), duration: int(p.duration, 0, 720, 0) }))
      .filter(p => p.name),
    updated: isNaN(updated) ? new Date(0).toISOString() : updated.toISOString(),
    days,
  };
}

// Рабочие часы из расписания.
export function scheduleSettings(schedule) {
  return {
    dayStart: TIME_RE.test(schedule.dayStart) ? schedule.dayStart : DEFAULT_SETTINGS.dayStart,
    lastStart: TIME_RE.test(schedule.lastStart) ? schedule.lastStart : DEFAULT_SETTINGS.lastStart,
    duration: schedule.duration > 0 ? schedule.duration : DEFAULT_SETTINGS.duration,
  };
}

// Свободные начала в день расписания для записи длиной need.
// Расписание прежнего вида (до 1.8.0) — готовый список времени.
export function scheduleTimes(schedule, day, need, after = -1) {
  if (!day || day.off) return [];
  if (!Array.isArray(day.busy)) return (day.times || []).filter(t => toMinutes(t) > after);
  return freeStarts(day.busy, scheduleSettings(schedule), need, after);
}

// «Сейчас» по часам мастера: tzOffset — как getTimezoneOffset() на её телефоне.
export function masterClock(tzOffset, nowMs = Date.now()) {
  const d = new Date(nowMs - tzOffset * 60000);
  return {
    date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

// ---------- Заявки клиентов ----------

// Заявки, которые ждут подтверждения, занимают время так же, как записи.
// holds — { date, time, services }.
export function applyHolds(schedule, holds) {
  const byDate = {};
  for (const h of holds) (byDate[h.date] = byDate[h.date] || []).push(h);
  const settings = scheduleSettings(schedule);
  return {
    ...schedule,
    days: schedule.days.map(d => {
      if (d.off || !byDate[d.date]) return d;
      if (!Array.isArray(d.busy)) {
        // Расписание прежнего вида: между началами — duration.
        return { ...d, times: d.times.filter(t => byDate[d.date].every(h => Math.abs(toMinutes(h.time) - toMinutes(t)) >= settings.duration)) };
      }
      const held = byDate[d.date].map(h => {
        const start = toMinutes(h.time);
        return [start, start + servicesDuration(h.services, schedule.services, settings)];
      });
      return { ...d, busy: [...d.busy, ...held].sort((x, y) => x[0] - y[0]) };
    }),
  };
}

// Проверяет заявку клиента по опубликованному расписанию (уже с учётом других заявок).
// clock — «сейчас» по часам мастера. Возвращает { ok: true, request } или { ok: false, status, error }.
export function validateRequest(body, schedule, clock) {
  const fail = (error, status = 400) => ({ ok: false, status, error });
  const b = body && typeof body === 'object' ? body : {};
  const name = String(b.name || '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 60) return fail('Укажите имя');
  const digits = phoneDigits(b.phone);
  if (digits.length < 10 || digits.length > 15) return fail('Укажите номер телефона');
  const known = (schedule.services || []).map(x => x.name);
  const services = [...new Set((Array.isArray(b.services) ? b.services : []).map(x => String(x).trim()).filter(Boolean))];
  if (!services.length) return fail('Выберите, что будем делать');
  if (services.length > 10 || services.some(x => (known.length ? !known.includes(x) : x.length > 60))) return fail('Такой услуги нет в прайсе');
  if (!DATE_RE.test(b.date) || !TIME_RE.test(b.time)) return fail('Выберите день и время');
  const day = (schedule.days || []).find(d => d.date === b.date);
  const past = b.date < clock.date || (b.date === clock.date && toMinutes(b.time) <= clock.minutes);
  const settings = scheduleSettings(schedule);
  const v2 = Boolean(day && Array.isArray(day.busy));
  const duration = v2 ? servicesDuration(services, schedule.services, settings) : settings.duration;
  const after = b.date === clock.date ? clock.minutes : -1;
  if (!day || day.off || past || !scheduleTimes(schedule, day, duration, after).includes(b.time)) {
    // Время свободно, но выбранные услуги не успеют закончиться до следующей записи.
    const fitsShort = v2 && !past && scheduleTimes(schedule, day, shortestService(schedule.services, settings), after).includes(b.time);
    return fail(fitsShort ? 'На это время выбранные услуги не поместятся — выберите время пораньше или меньше услуг' : 'Это время уже занято — выберите другое', 409);
  }
  const comment = String(b.comment || '').trim().slice(0, 300);
  return { ok: true, request: { date: b.date, time: b.time, name, phone: formatPhone(digits), services, comment, duration } };
}

// ---------- Напоминания мастеру о записях (2.8.0) ----------
// Телефон считает ближайшие напоминания и отдаёт их серверу, сервер присылает их уведомлениями
// в нужное время — даже когда приложение закрыто. due — когда напомнить, at — начало записи
// (мс, по часам телефона: Казахстан — UTC+5). Отменённые и уже начавшиеся записи не напоминаем.
// id — запись и вид («d» — за дни, «h» — за часы): по нему сервер не пришлёт одно напоминание дважды.
export function reminderItems(appointments, settings, nowMs, limit = 300) {
  const s = settings || {};
  const kinds = [['d', (REMIND_DAYS.includes(s.remindDays) ? s.remindDays : 0) * 864e5],
    ['h', (REMIND_HOURS.includes(s.remindHours) ? s.remindHours : 0) * 36e5]].filter(([, ms]) => ms > 0);
  const items = [];
  for (const a of kinds.length ? appointments || [] : []) {
    if (!a || a.status === 'cancelled' || !DATE_RE.test(a.date) || !TIME_RE.test(a.time)) continue;
    const at = parseYmd(a.date).getTime() + toMinutes(a.time) * 6e4;
    if (at <= nowMs) continue;
    for (const [kind, ms] of kinds) {
      if (at - ms <= nowMs) continue;
      items.push({ id: `${a.id}:${kind}`, due: at - ms, at, date: a.date, time: a.time,
        name: String(a.name || '').trim().slice(0, 60), services: servicesOf(a).map(x => String(x).slice(0, 60)).slice(0, 10) });
    }
  }
  return items.sort((x, y) => x.due - y.due).slice(0, limit);
}

// Список напоминаний, присланный телефоном, — на сервере: только своего вида, без сильно опоздавших
// (больше 5 минут), не дальше чем за 8 дней до записи, не больше 300, по порядку.
export function cleanReminders(raw, nowMs) {
  const out = [];
  for (const x of (Array.isArray(raw) ? raw : []).slice(0, 400)) {
    if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !/^[\w:-]{1,80}$/.test(x.id)) continue;
    const due = Number(x.due), at = Number(x.at);
    if (!Number.isFinite(due) || !Number.isFinite(at) || due >= at || at - due > 8 * 864e5 || due < nowMs - 5 * 6e4 || at > nowMs + 400 * 864e5) continue;
    if (!DATE_RE.test(x.date) || !TIME_RE.test(x.time)) continue;
    out.push({ id: x.id, due: Math.round(due), at: Math.round(at), date: x.date, time: x.time,
      name: String(x.name == null ? '' : x.name).trim().replace(/\s+/g, ' ').slice(0, 60),
      services: (Array.isArray(x.services) ? x.services : []).map(v => String(v).trim().slice(0, 60)).filter(Boolean).slice(0, 10) });
  }
  return out.sort((a, b) => a.due - b.due).slice(0, 300);
}

// ---------- Личная ссылка клиента на запись ----------

// Что видит клиент по своей ссылке: pending — заявка ждёт ответа,
// confirmed — подтверждена, done — состоялась, cancelled — отменена, declined — отклонена.
export const BOOKING_STATUSES = ['confirmed', 'done', 'cancelled', 'declined'];

export function publicBooking(a) {
  return {
    status: a.status === 'paid' ? 'done' : a.status === 'cancelled' ? 'cancelled' : 'confirmed',
    date: a.date,
    time: a.time,
    name: a.name,
    services: servicesOf(a),
    total: a.total,
    prepaid: a.prepaid,
  };
}

// Проверка записи, которую телефон мастера выкладывает для клиента. null — неверная.
export function normalizeBooking(b) {
  if (!b || typeof b !== 'object' || !BOOKING_STATUSES.includes(b.status) || !DATE_RE.test(b.date) || !TIME_RE.test(b.time)) return null;
  return {
    status: b.status,
    date: b.date,
    time: b.time,
    name: String(b.name || '').trim().slice(0, 60),
    services: (Array.isArray(b.services) ? b.services : []).map(x => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 10),
    total: toMoney(b.total),
    prepaid: toMoney(b.prepaid),
  };
}

// Сообщение клиенту в WhatsApp после подтверждения записи — на языке приложения мастера.
export function confirmationText(a, link, lang = LANG) {
  const what = servicesLabel(servicesOf(a)).toLowerCase();
  if (lang === 'kk') {
    let kk = `Сәлеметсіз бе${a.name ? ', ' + a.name : ''}! Жазылуыңыз расталды: ${shortDate(a.date, 'kk')}, ${shortTime(a.time)}${what ? ` (${what})` : ''}.`;
    if (a.prepaid) kk += ` ${formatMoney(a.prepaid)} алдын ала төлем алынды.`;
    return `${kk} Жазылуыңызды мына сілтемеден көре аласыз: ${link}`;
  }
  let text = `Здравствуйте${a.name ? ', ' + a.name : ''}! Ваша запись подтверждена: ${shortDate(a.date, 'ru')} в ${shortTime(a.time)}${what ? ` (${what})` : ''}.`;
  if (a.prepaid) text += ` Предоплата ${formatMoney(a.prepaid)} получена.`;
  return `${text} Ваша запись: ${link}`;
}

// «Айгуль · 30 сентября в 14:30 · Маникюр + Педикюр» — для уведомления мастеру (lang — язык его телефона).
export function requestSummary(r, lang = LANG) {
  return `${r.name} · ${requestWhen(r, lang)} · ${servicesLabel(r.services)}`;
}

// Когда заявка: «3 октября в 14:30» (по-казахски — «3 қазан, 14:30»).
export function requestWhen(r, lang = LANG) {
  return `${shortDate(r.date, lang)}${lang === 'kk' ? ',' : ' в'} ${shortTime(r.time)}`;
}

// ---------- base64url (ключи уведомлений и устройства) ----------

export function bytesToB64u(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uToBytes(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(s + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// ---------- Аккаунт мастера ----------

// Ссылка мастера для клиентов по имени: «Арай» → «aray», «Айгүл Нұр» → «aygul-nur».
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'q', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
};

export function slugify(name) {
  const slug = [...String(name || '').toLowerCase()].map(ch => (ch in TRANSLIT ? TRANSLIT[ch] : ch)).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/, '');
  return slug || 'master';
}

// Пароль на сервер не уходит: телефон «растягивает» его (PBKDF2-SHA-256, PASSWORD_ROUNDS шагов,
// соль — номер телефона), сервер хранит только хэш результата. Подбирать пароль по украденной
// базе долго, а серверу не нужно тратить на это время.
export const PASSWORD_ROUNDS = 200000;

export async function passwordSecret(phone, password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('nailapp:' + phoneDigits(phone)), iterations: PASSWORD_ROUNDS }, key, 256);
  return bytesToB64u(new Uint8Array(bits));
}

// ---------- Телефоны ----------

// Цифры номера в международном виде: «8 (701) 123-45-67» → «77011234567».
export function phoneDigits(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  else if (d.length === 10 && (d[0] === '7' || d[0] === '9')) d = '7' + d;
  return d;
}

// Контакт из телефонной книги (2.9.5): первый номер +7 («8 701…», «+7 (701)…», «701…») — в виде поля
// «+7 701 123 45 67»; других номеров поле с «+7» не примет — тогда ''.
export function contactPhone(tels) {
  for (const raw of Array.isArray(tels) ? tels : []) {
    const d = phoneDigits(raw);
    if (d.length === 11 && d[0] === '7') return phoneFieldValue('+' + d);
  }
  return '';
}

export function contactName(names) {
  return (Array.isArray(names) ? names : []).map(s => String(s || '').replace(/\s+/g, ' ').trim()).find(Boolean)?.slice(0, 60) || '';
}

// «+7 701 123 45 67» для номеров +7, остальные — как ввели.
export function formatPhone(phone) {
  const d = phoneDigits(phone);
  if (d.length === 11 && d[0] === '7') return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
  return String(phone || '').trim();
}

export function canDial(phone) {
  return phoneDigits(phone).length >= 10;
}

// Поле ввода телефона: «+7» в начале не меняется, дальше до 10 цифр
// группами «705 102 70 37». Вставленный номер «8 705…», «+7 (705)…», «7705…» приводится к тому же виду.
export const PHONE_PREFIX = '+7 ';

export function phoneFieldDigits(value) {
  const s = String(value || '').trim();
  let d;
  if (s.startsWith('+7')) d = s.slice(2).replace(/\D/g, '');
  else if (/^7\s/.test(s)) d = s.slice(1).replace(/\D/g, ''); // стёрли «+» у «+7»
  else {
    d = s.replace(/\D/g, '');
    if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
  }
  return d.slice(0, 10);
}

export function phoneFieldValue(value) {
  const d = phoneFieldDigits(value);
  return PHONE_PREFIX + [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(' ');
}

// Что показать в поле: пустое — «+7 », номер +7 — по группам, другой номер — как был.
export function phoneFieldStart(phone) {
  if (!String(phone || '').trim()) return PHONE_PREFIX;
  const d = phoneDigits(phone);
  return d.length === 11 && d[0] === '7' ? phoneFieldValue('+' + d) : String(phone).trim();
}

// Что сохранить из поля: одно «+7» — номера нет.
export function phoneFromField(value) {
  return phoneFieldDigits(value) ? phoneFieldValue(value) : '';
}

// ---------- Сохранённые клиенты ----------
// Список клиентов собирается из записей. Отдельно хранятся клиенты, которых мастер
// добавила вручную, и данные карточки (Instagram, день рождения, откуда пришёл):
// data.clients — {id, name, phone, created, instagram?, birthday?, source?}.

const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').trim();

const newestFirst = (a, b) => (b.date + b.time).localeCompare(a.date + a.time);

// Один клиент — один номер (без номера — одно имя). Имя и номер берутся
// из самой свежей записи. visits — записи без отменённых, last — дата последней.
// saved — клиенты, добавленные вручную: у кого записей нет, visits = 0 и last = '';
// id — номер такого клиента в data.clients (по нему его можно удалить).
export function pastClients(appointments, saved = []) {
  const byKey = new Map();
  for (const a of [...appointments].sort(newestFirst)) {
    const key = phoneDigits(a.phone) || norm(a.name);
    if (!key) continue;
    let c = byKey.get(key);
    if (!c) byKey.set(key, c = { key, name: a.name, phone: a.phone, visits: 0, last: a.date });
    if (a.status !== 'cancelled') c.visits++;
  }
  for (const s of saved) {
    const key = phoneDigits(s.phone) || norm(s.name);
    if (!key) continue;
    let c = byKey.get(key);
    if (!c) byKey.set(key, c = { key, name: s.name, phone: s.phone, visits: 0, last: '' });
    c.id = s.id;
    for (const f of PROFILE_FIELDS) if (s[f]) c[f] = s[f];
  }
  // Записи без номера с тем же именем, что у клиента с номером, — это он же.
  const byName = new Map();
  for (const c of byKey.values()) if (phoneDigits(c.phone)) byName.set(norm(c.name), c);
  const out = [];
  for (const c of byKey.values()) {
    const owner = !phoneDigits(c.phone) && byName.get(norm(c.name));
    if (!owner) {
      out.push(c);
      continue;
    }
    owner.visits += c.visits;
    if (c.last > owner.last) owner.last = c.last;
    if (c.id && !owner.id) owner.id = c.id;
    for (const f of PROFILE_FIELDS) if (c[f] && !owner[f]) owner[f] = c[f];
  }
  return out;
}

// ---------- Статистика мастера для администратора ----------
// За месяц: принятые записи (кроме отменённых), из них пришедшие заявкой по ссылке, остальные мастер
// внёс сам; клиентов в этом месяце. Имён и телефонов на сервер не уходит — только числа.
export function monthStats(appointments, ym) {
  const list = appointments.filter(a => a.date && a.date.startsWith(ym) && a.status !== 'cancelled');
  const link = list.filter(a => a.source === 'link').length;
  const clients = new Set(list.map(a => phoneDigits(a.phone) || norm(a.name)).filter(Boolean)).size;
  return { total: list.length, link, manual: list.length - link, clients };
}

// Что приложение отправляет на сервер: последние 12 месяцев и сколько всего клиентов в базе.
export function statsPayload(data, today) {
  const months = {};
  for (let i = 0; i < 12; i++) {
    const ym = addMonths(monthOf(today), -i);
    const st = monthStats(data.appointments || [], ym);
    if (st.total || i === 0) months[ym] = st;
  }
  return { months, clients: pastClients(data.appointments || [], data.clients || []).length };
}

// ---------- Карточка клиента: Instagram, день рождения, откуда пришёл ----------

// Подсказки для «Откуда пришёл клиент» (можно вписать и своё).
export const CLIENT_SOURCES = ['Instagram', 'TikTok', '2ГИС', 'По рекомендации', 'Вывеска'];
const PROFILE_FIELDS = ['instagram', 'birthday', 'source'];

// «@aigul.nails», «https://www.instagram.com/aigul.nails/?igsh=…» → «aigul.nails».
// Если не похоже на ник Instagram — ''.
export function instagramName(value) {
  let name = String(value || '').trim();
  const link = name.match(/instagram\.com\/([^/?#\s]+)/i);
  if (link) name = link[1];
  name = name.replace(/^@+/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(name) ? name.toLowerCase() : '';
}

// Сколько лет исполнилось к дате today (даты — 'YYYY-MM-DD').
export function ageOn(birthday, today) {
  if (!DATE_RE.test(birthday || '')) return null;
  let age = Number(today.slice(0, 4)) - Number(birthday.slice(0, 4));
  if (today.slice(5) < birthday.slice(5)) age--;
  return age >= 0 && age < 120 ? age : null;
}

// Через сколько дней ближайший день рождения (0 — сегодня). 29 февраля в обычный год — 1 марта.
export function daysToBirthday(birthday, today) {
  if (!DATE_RE.test(birthday || '')) return null;
  const [, bm, bd] = birthday.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const now = Date.UTC(ty, tm - 1, td);
  let next = Date.UTC(ty, bm - 1, bd);
  if (next < now) next = Date.UTC(ty + 1, bm - 1, bd);
  return Math.round((next - now) / 864e5);
}

// Поля карточки клиента из копии или формы: только правильные и непустые.
export function clientProfile(src) {
  const out = {};
  const instagram = instagramName(src && src.instagram);
  if (instagram) out.instagram = instagram;
  if (src && DATE_RE.test(src.birthday)) out.birthday = src.birthday;
  const source = String((src && src.source) || '').trim().slice(0, 60);
  if (source) out.source = source;
  return out;
}

// Такой клиент уже есть? По номеру, а если номера нет — по имени.
export function findTwin(clients, name, phone) {
  const pd = phoneDigits(phone);
  return pd ? clients.find(c => phoneDigits(c.phone) === pd) : clients.find(c => norm(c.name) === norm(name));
}

// Все записи клиента, свежие первыми (по тем же правилам, что pastClients).
export function clientVisits(appointments, client) {
  const pd = phoneDigits(client.phone), name = norm(client.name);
  return appointments.filter(a => {
    const d = phoneDigits(a.phone);
    return d ? d === pd : norm(a.name) === name;
  }).sort(newestFirst);
}

export function sortByName(clients) {
  const label = c => c.name || c.phone;
  return [...clients].sort((a, b) => label(a).localeCompare(label(b), 'ru'));
}

// Поиск по имени (ё = е) или по цифрам номера (от 3 цифр, можно с 8 в начале).
export function findClients(clients, query) {
  const q = norm(query);
  if (!q) return clients;
  const qd = q.replace(/\D/g, '');
  return clients.filter(c => {
    if (norm(c.name).includes(q)) return true;
    if (qd.length < 3) return false;
    const pd = phoneDigits(c.phone);
    return pd.includes(qd) || (qd[0] === '8' && pd.includes('7' + qd.slice(1)));
  });
}

// ---------- Резервная копия ----------

export const BACKUP_APP = 'kae-zapis';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function makeBackup(data, now = new Date()) {
  return {
    app: BACKUP_APP,
    format: 1,
    exportedAt: now.toISOString(),
    appointments: data.appointments,
    expenses: data.expenses,
    prices: data.prices,
    rent: data.rent,
    settings: data.settings,
    blocks: data.blocks,
    clients: data.clients || [],
    rentPaid: data.rentPaid || {},
  };
}

// Разбирает файл копии и приводит поля к нужным типам.
// Бросает Error с понятным текстом, если это не наша копия.
export function readBackup(text) {
  let obj = null;
  try { obj = JSON.parse(text); } catch (e) { /* не JSON */ }
  if (!obj || obj.app !== BACKUP_APP || !Array.isArray(obj.appointments)) {
    throw new Error('Это не архив Beautybook');
  }
  const str = v => (v == null ? '' : String(v));
  const list = v => (Array.isArray(v) ? v : []);
  const appointments = obj.appointments.filter(a => a && DATE_RE.test(a.date)).map((a, i) => ({
    id: str(a.id) || 'r' + i,
    date: a.date,
    time: str(a.time),
    name: str(a.name),
    phone: str(a.phone),
    services: (Array.isArray(a.services) ? a.services : a.service ? [a.service] : []).map(x => str(x).trim()).filter(Boolean),
    total: toMoney(a.total),
    prepaid: toMoney(a.prepaid),
    status: STATUSES.includes(a.status) ? a.status : 'booked',
    note: str(a.note),
    photos: list(a.photos).filter(id => typeof id === 'string' && /^[\w-]+$/.test(id)),
    created: a.created || null,
    updated: a.updated || null,
    // Личная ссылка клиента на запись и «пришла по ссылке» — до 2.4.0 при восстановлении терялись.
    ...(typeof a.token === 'string' && /^[\w-]{16,64}$/.test(a.token) ? { token: a.token } : {}),
    ...(a.source === 'link' ? { source: 'link' } : {}),
  }));
  const expenses = list(obj.expenses).filter(e => e && DATE_RE.test(e.date)).map((e, i) => ({
    id: str(e.id) || 'e' + i, date: e.date, amount: toMoney(e.amount), note: str(e.note),
  }));
  const prices = list(obj.prices).filter(p => p && p.name).map((p, i) => ({
    id: str(p.id) || 'p' + i, name: str(p.name), price: toMoney(p.price), duration: toDuration(p.duration),
  }));
  const rentPaid = {};
  for (const [month, date] of Object.entries(obj.rentPaid && typeof obj.rentPaid === 'object' ? obj.rentPaid : {})) {
    if (/^\d{4}-\d{2}$/.test(month) && DATE_RE.test(date)) rentPaid[month] = date;
  }
  const rent = list(obj.rent).filter(r => r && /^\d{4}-\d{2}$/.test(r.from)).map(r => ({
    from: r.from, amount: toMoney(r.amount),
  }));
  // Закрытое время (start и end) с неверным временем не берём: целый день оно закрыть не должно.
  const blocks = list(obj.blocks).filter(b => b && DATE_RE.test(b.from) && DATE_RE.test(b.to)
    && (!(b.start || b.end) || isTimeWindow(b.start, b.end))).map((b, i) => ({
    id: str(b.id) || 'b' + i,
    from: b.from < b.to ? b.from : b.to,
    to: b.from < b.to ? b.to : b.from,
    note: str(b.note),
    ...(b.start ? { start: b.start, end: b.end } : {}),
  }));
  const clients = list(obj.clients).filter(c => c && (str(c.name).trim() || phoneDigits(c.phone))).map((c, i) => ({
    id: str(c.id) || 'c' + i, name: str(c.name).trim(), phone: str(c.phone), created: c.created || null, ...clientProfile(c),
  }));
  return {
    appointments,
    expenses,
    prices,
    rent: rent.length ? rent : [{ from: '2000-01', amount: DEFAULT_RENT }],
    settings: readSettings(obj.settings),
    blocks,
    clients,
    rentPaid,
    exportedAt: obj.exportedAt || null,
  };
}

const TIME_RE = /^\d{2}:\d{2}$/;

// Длительность услуги в минутах: 5–600, иначе 0 — «не указана».
export function toDuration(value) {
  const m = Math.round(Number(value));
  return m >= 5 && m <= 600 ? m : 0;
}

function readSettings(src) {
  const s = src && typeof src === 'object' ? src : {};
  const out = { ...DEFAULT_SETTINGS };
  if (TIME_RE.test(s.dayStart)) out.dayStart = s.dayStart;
  if (TIME_RE.test(s.lastStart)) out.lastStart = s.lastStart;
  const duration = Math.round(Number(s.duration));
  if (duration >= 15 && duration <= 600) out.duration = duration;
  if (typeof s.clientName === 'string') out.clientName = s.clientName;
  if (typeof s.whatsapp === 'string') out.whatsapp = s.whatsapp;
  if (typeof s.address === 'string') out.address = addressText(s.address);
  if (typeof s.gis === 'string') out.gis = gisLink(s.gis);
  if (typeof s.instagram === 'string') out.instagram = instagramName(s.instagram);
  if (typeof s.specialty === 'string') out.specialty = specialtyText(s.specialty);
  if (typeof s.kaspi === 'string') out.kaspi = s.kaspi;
  if (typeof s.theme === 'string' && Object.keys(THEMES).includes(s.theme)) out.theme = s.theme;
  if (s.themeV === THEME_V) out.themeV = THEME_V;
  upgradeTheme(out); // копия до 2.9.1: прежняя исходная пурпурная → розово-чёрная
  if (REMIND_DAYS.includes(s.remindDays)) out.remindDays = s.remindDays;
  if (REMIND_HOURS.includes(s.remindHours)) out.remindHours = s.remindHours;
  return out;
}
