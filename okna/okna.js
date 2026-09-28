// Страница для клиентов: свободное время мастера. Данные — okna.json из репозитория
// kae-zapis-okna, его выкладывает приложение мастера. Имён и телефонов там нет.

import * as L from '../logic.js';

const REPO = 'komron4111/kae-zapis-okna';
// API GitHub отдаёт свежий файл; если лимит запросов исчерпан — берём копию с raw.
const SOURCES = [
  [`https://api.github.com/repos/${REPO}/contents/okna.json`, { headers: { Accept: 'application/vnd.github.raw+json' } }],
  [`https://raw.githubusercontent.com/${REPO}/main/okna.json`, {}],
];

const view = document.getElementById('view');
const appbar = document.getElementById('appbar');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chevron = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

async function load() {
  for (const [url, options] of SOURCES) {
    try {
      const res = await fetch(url, { ...options, cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch (e) { /* пробуем следующий источник */ }
  }
  return null;
}

function bookingLink(schedule, date, time) {
  const text = `Здравствуйте! Хочу записаться ${L.shortDate(date)} в ${L.shortTime(time)}.`;
  return `https://wa.me/${schedule.whatsapp}?text=${encodeURIComponent(text)}`;
}

function render(schedule) {
  const name = schedule.name || 'Мастер';
  document.title = `Свободное время — ${name}`;
  appbar.innerHTML = `<h1>${esc(name)} · запись</h1>`;

  const clock = L.masterClock(schedule.tzOffset || 0);
  const days = (schedule.days || []).filter(d => d.date >= clock.date).map(d => ({
    ...d,
    times: d.off ? [] : (d.times || []).filter(t => d.date > clock.date || L.toMinutes(t) > clock.minutes),
  })).filter(d => d.date > clock.date || d.off || d.times.length); // сегодня без времени — не показываем
  if (!days.length) {
    view.innerHTML = '<div class="empty"><p>Свободное время скоро появится. Загляните позже.</p></div>';
    return;
  }

  const canBook = Boolean(schedule.whatsapp);
  const updated = new Date(schedule.updated);
  const stale = Date.now() - updated > 3 * 864e5;
  let opened = false;
  const rows = days.map(d => {
    const summary = d.off ? 'нет записи' : d.times.length ? L.formatRanges(L.toRanges(d.times)) : 'всё занято';
    if (!d.times.length) {
      return `
        <section class="card okna-day none">
          <div class="okna-head"><span><b>${L.dayTitle(d.date)}</b><small>${summary}</small></span></div>
        </section>`;
    }
    const open = !opened;
    opened = true;
    const chips = d.times.map(t => canBook
      ? `<a class="chip" href="${bookingLink(schedule, d.date, t)}" target="_blank" rel="noopener">${L.shortTime(t)}</a>`
      : `<span class="chip">${L.shortTime(t)}</span>`).join('');
    return `
      <section class="card okna-day${open ? ' open' : ''}">
        <button class="okna-head" aria-expanded="${open}">
          <span><b>${L.dayTitle(d.date)}</b><small>свободно: ${summary}</small></span>${chevron}
        </button>
        <div class="chips okna-times"${open ? '' : ' hidden'}>${chips}</div>
      </section>`;
  }).join('');

  view.innerHTML = `
    <p class="okna-intro">${canBook
      ? 'Выберите день и время начала — откроется WhatsApp, чтобы записаться.'
      : 'Чтобы записаться, напишите мастеру.'}
      Одна запись занимает до ${L.formatDuration(schedule.duration || 150)}.</p>
    ${stale ? '<div class="banner warn"><div class="grow">Расписание давно не обновлялось — уточните время у мастера.</div></div>' : ''}
    ${rows}
    <p class="okna-foot">Обновлено ${updated.getDate()} ${L.MONTHS_GEN[updated.getMonth()]} в ${updated.getHours()}:${String(updated.getMinutes()).padStart(2, '0')}</p>`;
}

view.addEventListener('click', e => {
  const head = e.target.closest('button.okna-head');
  if (!head) return;
  const day = head.closest('.okna-day');
  const open = !day.classList.contains('open');
  day.classList.toggle('open', open);
  head.setAttribute('aria-expanded', String(open));
  day.querySelector('.okna-times').hidden = !open;
});

async function start() {
  const schedule = await load();
  if (!schedule || schedule.kind !== 'okna') {
    view.innerHTML = `
      <div class="empty">
        <p>Не удалось загрузить свободное время. Проверьте интернет.</p>
        <button class="btn secondary small" onclick="location.reload()">Обновить</button>
      </div>`;
    return;
  }
  render(schedule);
}

start();
