(function () {
  var stored = localStorage.getItem('pinball-theme');
  var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = stored || (sysDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);

  document.addEventListener('DOMContentLoaded', function () {
    var nav = document.querySelector('nav');
    if (!nav) return;
    var btn = document.createElement('button');
    btn.className = 'theme-toggle-btn';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
    btn.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('pinball-theme', next);
      btn.textContent = next === 'dark' ? '☀ Light' : '☾ Dark';
    });
    nav.appendChild(btn);
  });
})();
