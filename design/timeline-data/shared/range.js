// The years shown: a start and an end year, set by dragging two handles on a track lined up with the
// chart below (the app's RangeSlider), by typing either year, or by a preset. Calls onChange(start, end)
// on release; the chart's dates run from January 1 of the start year to the end of the end year (or today).
//
//   GG.yearRange(el, { min, max, start, end, presets: [[label, start, end]], inset: [left, right], onChange })

(function () {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  window.GG.yearRange = function (root, opts) {
    const { min, max, presets = [], inset = [58, 58], onChange } = opts;
    let start = opts.start, end = opts.end;
    root.classList.add('yr');
    root.innerHTML = `
      <div class="yr-top">
        <span class="yr-label">Years</span>
        <input class="yr-in" data-w="start" inputmode="numeric" maxlength="4" aria-label="From year">
        <span class="yr-dash">–</span>
        <input class="yr-in" data-w="end" inputmode="numeric" maxlength="4" aria-label="To year">
        <span class="yr-presets">${presets.map(([l, a, b]) => `<button data-a="${a}" data-b="${b}">${l}</button>`).join('')}</span>
      </div>
      <div class="yr-track" style="margin:0 ${inset[1]}px 0 ${inset[0]}px">
        <div class="yr-rail"></div><div class="yr-fill"></div>
        <button class="yr-thumb" data-w="start" aria-label="From year"></button>
        <button class="yr-thumb" data-w="end" aria-label="To year"></button>
        <div class="yr-ticks"></div>
      </div>`;
    const track = root.querySelector('.yr-track'), fill = root.querySelector('.yr-fill');
    const thumbs = { start: root.querySelector('.yr-thumb[data-w=start]'), end: root.querySelector('.yr-thumb[data-w=end]') };
    const inputs = { start: root.querySelector('.yr-in[data-w=start]'), end: root.querySelector('.yr-in[data-w=end]') };
    const pct = y => ((y - min) / (max - min)) * 100;
    const ticks = root.querySelector('.yr-ticks');
    for (let y = Math.ceil(min / 10) * 10; y <= max; y += 10) ticks.insertAdjacentHTML('beforeend', `<span style="left:${pct(y)}%">${y}</span>`);

    function paint() {
      thumbs.start.style.left = `${pct(start)}%`; thumbs.end.style.left = `${pct(end)}%`;
      fill.style.left = `${pct(start)}%`; fill.style.width = `${pct(end) - pct(start)}%`;
      if (document.activeElement !== inputs.start) inputs.start.value = start;
      if (document.activeElement !== inputs.end) inputs.end.value = end;
      root.querySelectorAll('.yr-presets button').forEach(b => b.classList.toggle('on', +b.dataset.a === start && +b.dataset.b === end));
    }
    function set(a, b, fire = true) {
      start = clamp(a, min, max - 1); end = clamp(b, start + 1, max);
      paint(); if (fire) onChange(start, end);
    }
    for (const w of ['start', 'end']) {
      const th = thumbs[w];
      th.addEventListener('pointerdown', e => {
        e.preventDefault(); th.setPointerCapture(e.pointerId);
        const rect = track.getBoundingClientRect();
        const move = ev => {
          const y = Math.round(min + ((ev.clientX - rect.left) / rect.width) * (max - min));
          if (w === 'start') start = clamp(y, min, end - 1); else end = clamp(y, start + 1, max);
          paint();
        };
        const up = () => { th.removeEventListener('pointermove', move); th.removeEventListener('pointerup', up); onChange(start, end); };
        th.addEventListener('pointermove', move); th.addEventListener('pointerup', up);
      });
      th.addEventListener('keydown', e => {
        const by = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[e.key];
        if (!by) return; e.preventDefault();
        w === 'start' ? set(start + by, end) : set(start, end + by);
      });
      inputs[w].addEventListener('change', () => {
        const y = parseInt(inputs[w].value, 10);
        if (!Number.isFinite(y)) { paint(); return; }
        w === 'start' ? set(y, end) : set(start, y);
      });
      inputs[w].addEventListener('keydown', e => e.key === 'Enter' && inputs[w].blur());
    }
    root.querySelector('.yr-presets').addEventListener('click', e => { const b = e.target.closest('button'); if (b) set(+b.dataset.a, +b.dataset.b); });
    paint();
    return { get: () => [start, end], set };
  };
})();
