/**
 * Intersection-observer based scroll reveal. Any element with
 * `data-reveal` (and optionally `data-reveal-delay="120"`) fades + lifts in
 * once it intersects the viewport.
 */
(function () {
  'use strict';

  const els = document.querySelectorAll('[data-reveal]');
  if (els.length === 0 || !('IntersectionObserver' in window)) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        const delay = Number(el.getAttribute('data-reveal-delay') ?? 0);
        setTimeout(() => el.classList.add('is-revealed'), delay);
        io.unobserve(el);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );
  els.forEach((el) => io.observe(el));
})();
