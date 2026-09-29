// Маска для всех полей <input type="tel"> — в приложении и на странице клиентов.
// «+7 » в начале стоит всегда и не стирается, цифры номера сами разбиваются
// пробелами: «+7 701 123 45 67». Правила разбора номера — в logic.js.

import { PHONE_PREFIX, phoneFieldDigits, phoneFieldValue } from './logic.js';

const isPhone = el => el instanceof HTMLInputElement && el.type === 'tel';
const START = PHONE_PREFIX.length;

// Переформатирует поле и ставит курсор после той же цифры номера, что и до правки.
function format(input) {
  const { value } = input;
  const caret = input.selectionEnd ?? value.length;
  const next = phoneFieldValue(value);
  if (next === value) return;
  input.value = next;
  if (document.activeElement !== input) return;
  let pos = next.length;
  if (caret < value.length) {
    const digitsBefore = phoneFieldDigits(value.slice(0, caret)).length;
    pos = START;
    for (let seen = 0; pos < next.length && seen < digitsBefore; pos++) if (/\d/.test(next[pos])) seen++;
  }
  input.setSelectionRange(pos, pos);
}

export function phoneMask() {
  // Раньше обработчиков приложения: они видят уже отформатированный номер.
  document.addEventListener('input', e => { if (isPhone(e.target)) format(e.target); }, true);

  document.addEventListener('beforeinput', e => {
    const input = e.target;
    if (!isPhone(input) || e.inputType !== 'deleteContentBackward') return;
    const { selectionStart: from, selectionEnd: to, value } = input;
    if (from !== to) return; // выделенное стирается как обычно
    if (from <= START) {
      e.preventDefault(); // «+7 » не стирается
      return;
    }
    if (value[from - 1] === ' ') {
      // Перед курсором пробел между группами — стираем цифру перед ним.
      e.preventDefault();
      input.value = value.slice(0, from - 2) + value.slice(from);
      input.setSelectionRange(from - 2, from - 2);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, true);

  // Курсор не встаёт внутрь «+7 ».
  document.addEventListener('selectionchange', () => {
    const input = document.activeElement;
    if (!isPhone(input) || !input.value.startsWith(PHONE_PREFIX)) return;
    if (input.selectionStart === input.selectionEnd && input.selectionStart < START) input.setSelectionRange(START, START);
  });

  document.addEventListener('focusin', e => {
    if (isPhone(e.target) && !e.target.value) e.target.value = PHONE_PREFIX;
  });
}
