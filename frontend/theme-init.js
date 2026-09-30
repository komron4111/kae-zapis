// Тема и светлый/тёмный режим — до первой отрисовки, чтобы экран не мигал (см. app.js).
// Отдельным файлом, а не внутри index.html: политика безопасности страницы (CSP)
// запускает только скрипты из файлов сайта.
document.documentElement.dataset.mode = 'light'; // исходно — светлый режим
try {
  const theme = localStorage.getItem('kae:theme'), mode = localStorage.getItem('kae:mode');
  if (theme) document.documentElement.dataset.theme = theme;
  if (mode) document.documentElement.dataset.mode = mode;
} catch (e) { /* приватный режим — цвета по умолчанию */ }
