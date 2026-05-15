/**
 * Synapse Vault — interactive pricing calculator
 *
 * Inputs:
 *   AUM            : USD ($500K – $250M)
 *   mgmt fee       : basis points / year (0 – 250)
 *   perf fee       : basis points of alpha (0 – 200)
 *   expected return: % per year
 *   benchmark      : % per year
 *
 * Outputs:
 *   total annual revenue       = mgmt fee + perf fee
 *   mgmt fee                   = AUM * (mgmt_bps / 10000)
 *   perf fee                   = AUM * max(0, ret - bench) * (perf_bps / 10000)
 *   five-vault portfolio       = total * 5
 */

(function () {
  'use strict';

  const inputs = {
    aum: document.getElementById('aum'),
    mgmt: document.getElementById('mgmt'),
    perf: document.getElementById('perf'),
    ret: document.getElementById('ret'),
    bench: document.getElementById('bench'),
  };

  const displays = {
    aum: document.getElementById('aum-display'),
    mgmt: document.getElementById('mgmt-display'),
    perf: document.getElementById('perf-display'),
    ret: document.getElementById('ret-display'),
    bench: document.getElementById('bench-display'),
    arr: document.getElementById('arr-display'),
    mgmtFee: document.getElementById('mgmt-fee-display'),
    mgmtFeeHint: document.getElementById('mgmt-fee-hint'),
    perfFee: document.getElementById('perf-fee-display'),
    perfFeeHint: document.getElementById('perf-fee-hint'),
    five: document.getElementById('five-display'),
    fiveLine: document.getElementById('five-line'),
  };

  const usd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  function fmtPct(n) {
    return `${n.toFixed(1)}%`;
  }

  function recompute() {
    const aum = Number(inputs.aum.value);
    const mgmtBps = Number(inputs.mgmt.value);
    const perfBps = Number(inputs.perf.value);
    const ret = Number(inputs.ret.value);
    const bench = Number(inputs.bench.value);

    const alpha = Math.max(0, ret - bench);
    const mgmtFee = aum * (mgmtBps / 10000);
    const perfFee = aum * (alpha / 100) * (perfBps / 10000);
    const total = mgmtFee + perfFee;
    const five = total * 5;

    displays.aum.textContent = usd.format(aum);
    displays.mgmt.textContent = `${mgmtBps} bps`;
    displays.perf.textContent = `${perfBps} bps`;
    displays.ret.textContent = fmtPct(ret);
    displays.bench.textContent = fmtPct(bench);

    displays.arr.textContent = usd.format(total);
    displays.mgmtFee.textContent = usd.format(mgmtFee);
    displays.mgmtFeeHint.textContent = `${(mgmtBps / 100).toFixed(2)}% of ${usd.format(aum)}`;
    displays.perfFee.textContent = usd.format(perfFee);
    displays.perfFeeHint.textContent = `${(perfBps / 100).toFixed(2)}% of ${alpha.toFixed(2)}% alpha`;
    displays.five.textContent = usd.format(five);
    displays.fiveLine.textContent = usd.format(five);
  }

  Object.values(inputs).forEach(function (el) {
    if (el) el.addEventListener('input', recompute);
  });

  recompute();
})();
