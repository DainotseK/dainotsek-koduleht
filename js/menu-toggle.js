// js/menu-toggle.js
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('mobile-menu-toggle');
  const nav = document.querySelector('.nav-container');
  if (btn && nav) {
    btn.addEventListener('click', () => {
      nav.classList.toggle('open');
    });
  }
});
