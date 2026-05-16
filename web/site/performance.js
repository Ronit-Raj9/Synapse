/**
 * Marketing-site performance section. Fetches the static backtest JSONs
 * (copied from web/dashboard/public/backtests during build), renders the
 * 90-day equity curve for each strategy as inline SVG, and populates the
 * stat cells inline. No framework, no chart library.
 */

(function () {
  'use strict';

  const STRATEGIES = [
    { slug: 'conservative-rebalancer', accent: '#5BD49C' },
    { slug: 'balanced-yield', accent: '#4A9BFF' },
    { slug: 'aggressive-momentum', accent: '#FF6B35' },
  ];

  const container = document.querySelector('[data-perf-grid]');
  if (!container) return;

  Promise.all(
    STRATEGIES.map((s) =>
      fetch(`./${s.slug}.json`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => ({ ...s, data })),
    ),
  ).then((results) => {
    container.innerHTML = '';
    for (const r of results) {
      if (!r.data) continue;
      container.appendChild(renderCard(r));
    }
  });

  function renderCard({ slug, accent, data }) {
    const card = document.createElement('article');
    card.className = 'perf-card';
    card.style.setProperty('--perf-accent', accent);

    const winning = data.totalReturnPct >= 0;

    card.innerHTML = `
      <header class="perf-card-head">
        <span class="perf-dot" style="background:${accent}"></span>
        <span class="mono-small">${data.strategyName.replace(/^Synapse /, '').toUpperCase()}</span>
      </header>
      <p class="perf-return" data-winning="${winning}">
        ${fmtPct(data.totalReturnPct, true)}
      </p>
      <p class="mono-mini perf-window">${data.startDate} → ${data.endDate} · ${data.series.length} days</p>
      <div class="perf-chart"></div>
      <dl class="perf-stats">
        <div><dt>α vs hold</dt><dd data-winning="${data.alphaPct >= 0}">${fmtPct(data.alphaPct, true)}</dd></div>
        <div><dt>Max DD</dt><dd>${fmtPct(-data.maxDrawdownPct, false)}</dd></div>
        <div><dt>Sharpe</dt><dd>${data.sharpeAnnualized.toFixed(2)}</dd></div>
        <div><dt>Trades</dt><dd>${data.tradesExecuted}</dd></div>
      </dl>
    `;

    card.querySelector('.perf-chart').appendChild(renderChart(data, accent));
    return card;
  }

  function renderChart(data, accent) {
    const w = 320,
      h = 110,
      pad = 6;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const series = data.series;
    const benchmark = series.map(
      (p) => series[0].suiUnits * p.priceUsd + series[0].usdcUnits,
    );

    const navs = series.map((p) => p.navUsd);
    const allVals = navs.concat(benchmark);
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const range = Math.max(1, max - min);

    function path(values) {
      const step = innerW / Math.max(1, values.length - 1);
      return values
        .map((v, i) => {
          const x = pad + i * step;
          const y = pad + innerH - ((v - min) / range) * innerH;
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    }

    const navPath = path(navs);
    const benchPath = path(benchmark);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('perf-svg');

    for (const f of [0.25, 0.5, 0.75]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', pad);
      line.setAttribute('x2', w - pad);
      line.setAttribute('y1', pad + innerH * f);
      line.setAttribute('y2', pad + innerH * f);
      line.setAttribute('stroke', 'rgba(3,15,28,0.08)');
      line.setAttribute('stroke-dasharray', '2 4');
      svg.appendChild(line);
    }

    const bench = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bench.setAttribute('d', benchPath);
    bench.setAttribute('fill', 'none');
    bench.setAttribute('stroke', 'rgba(3,15,28,0.45)');
    bench.setAttribute('stroke-width', '1.4');
    bench.setAttribute('stroke-dasharray', '3 3');
    svg.appendChild(bench);

    const nav = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    nav.setAttribute('d', navPath);
    nav.setAttribute('fill', 'none');
    nav.setAttribute('stroke', accent);
    nav.setAttribute('stroke-width', '2.2');
    svg.appendChild(nav);

    // Trade markers
    const step = innerW / Math.max(1, series.length - 1);
    series.forEach((p, i) => {
      if (p.decision !== 'rebalance') return;
      const cx = pad + i * step;
      const cy = pad + innerH - ((p.navUsd - min) / range) * innerH;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', cx);
      c.setAttribute('cy', cy);
      c.setAttribute('r', '2.6');
      c.setAttribute('fill', accent);
      c.setAttribute('stroke', '#030F1C');
      c.setAttribute('stroke-width', '1');
      svg.appendChild(c);
    });

    return svg;
  }

  function fmtPct(n, sign) {
    const s = n >= 0 && sign ? '+' : '';
    return `${s}${n.toFixed(2)}%`;
  }
})();
