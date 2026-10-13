// Two measures for the Build-mode concepts, with their real datasets (from the local database, 2026-10-13).
// GDP: the growth rate is published only adjusted for inflation, so "Dollars of the day" exists only for
// the amount. Unemployment: the broad rate (U-6) exists only as a rate, for everyone; groups only as U-3.
// Sex and race are one "Who" row here to keep the mock small; the app keeps them apart.

export const EXAMPLES = {
  gdp: {
    measure: 'GDP',
    // Dimensions that tell datasets apart, in order: the main one first.
    dims: [
      { key: 'form', label: 'Measured as', phrase: 'as', values: { amount: 'An amount', growth: 'A growth rate' } },
      { key: 'dollars', label: 'Dollars', values: { nominal: 'Dollars of the day', real: 'Adjusted for inflation' } },
    ],
    // What every dataset of the measure shares, in the closing order: then years, then source.
    shared: [['How often', 'Quarterly'], ['Seasonal adjustment', 'Seasonally adjusted, at annual rates']],
    source: 'BEA',
    datasets: [
      { slug: 'gdp', name: 'GDP (Annualized)', form: 'amount', dollars: 'nominal', years: '1947–2026' },
      { slug: 'gdp-real', name: 'Real GDP', form: 'amount', dollars: 'real', years: '1947–2026' },
      { slug: 'gdp-growth', name: 'Real GDP Growth', form: 'growth', dollars: 'real', years: '1947–2026' },
    ],
  },
  unemployment: {
    measure: 'Unemployment',
    dims: [
      { key: 'form', label: 'Measured as', phrase: 'as', values: { rate: 'A rate', number: 'A number of people' } },
      { key: 'definition', label: 'Definition', values: { u3: 'Official (U-3)', u6: 'Broad (U-6)' } },
      { key: 'who', label: 'Who', values: { everyone: 'Everyone', men: 'Men', women: 'Women', black: 'Black', white: 'White' } },
    ],
    shared: [['How often', 'Monthly'], ['Seasonal adjustment', 'Seasonally adjusted']],
    source: 'BLS',
    datasets: [
      { slug: 'unemployment-rate', name: 'Unemployment Rate', form: 'rate', definition: 'u3', who: 'everyone', years: '1948–2026' },
      { slug: 'unemployment-rate--men', name: 'Unemployment Rate for Men', form: 'rate', definition: 'u3', who: 'men', years: '1948–2026' },
      { slug: 'unemployment-rate--women', name: 'Unemployment Rate for Women', form: 'rate', definition: 'u3', who: 'women', years: '1948–2026' },
      { slug: 'unemployment-rate--black', name: 'Unemployment Rate for Black Workers', form: 'rate', definition: 'u3', who: 'black', years: '1972–2026' },
      { slug: 'unemployment-rate--white', name: 'Unemployment Rate for White Workers', form: 'rate', definition: 'u3', who: 'white', years: '1954–2026' },
      { slug: 'unemployment-u6', name: 'U-6 Unemployment Rate', form: 'rate', definition: 'u6', who: 'everyone', years: '1994–2026' },
      { slug: 'unemployed-persons', name: 'Number of Unemployed People', form: 'number', definition: 'u3', who: 'everyone', years: '1948–2026' },
      { slug: 'unemployed-persons--men', name: 'Number of Unemployed Men', form: 'number', definition: 'u3', who: 'men', years: '1948–2026' },
      { slug: 'unemployed-persons--women', name: 'Number of Unemployed Women', form: 'number', definition: 'u3', who: 'women', years: '1948–2026' },
      { slug: 'unemployed-persons--black', name: 'Number of Unemployed Black Workers', form: 'number', definition: 'u3', who: 'black', years: '1972–2026' },
      { slug: 'unemployed-persons--white', name: 'Number of Unemployed White Workers', form: 'number', definition: 'u3', who: 'white', years: '1954–2026' },
    ],
  },
};

const MEASURES = [
  ['Crude oil price', 2], ['Oil demand', 8], ['Unemployment', 89, 'unemployment'], ['Consumer prices', 4],
  ['Consumer spending', 2], ['GDP', 3, 'gdp'], ['Federal debt', 2], ['Federal revenue', 86], ['Tax rates', 12],
];

/** The page frame shared by the three concepts: the catalogue's Build mode with a measure list and an example switcher. */
export function frame(root, { concept, title, note, render }) {
  let example = new URLSearchParams(location.search).get('m') === 'unemployment' ? 'unemployment' : 'gdp';
  root.innerHTML = `
    <div class="topbar"><span class="brand">Gov<b>Graph</b></span><span class="variant-tag"><a href="../index.html">design/timeline-data</a> · Build mode, concept ${concept}</span></div>
    <main class="page">
      <h1>${concept}. ${title}</h1>
      <p class="lede">${note}</p>
      <div class="catalog">
        <div class="catalog-top"><span class="modes"><button>Browse</button><button class="on">Build</button></span><span class="muted" data-count></span></div>
        <div class="catalog-body">
          <nav class="catalog-nav">${MEASURES.map(([label, n, key]) => `<button data-m="${key ?? ''}" ${key ? '' : 'disabled'}><i>${label}</i><span>${n}</span></button>`).join('')}</nav>
          <div class="builder" data-builder></div>
        </div>
      </div>
    </main>`;
  const draw = () => {
    root.querySelectorAll('.catalog-nav button').forEach(b => b.classList.toggle('on', b.dataset.m === example));
    render(root.querySelector('[data-builder]'), EXAMPLES[example]);
  };
  root.querySelectorAll('.catalog-nav button[data-m]:not([disabled])').forEach(b => b.addEventListener('click', () => {
    example = b.dataset.m;
    history.replaceState(null, '', `?m=${example}`);
    draw();
  }));
  draw();
}

/** The datasets put on the timeline, as the app shows them under the choices. */
export function onTimeline(datasets, waiting) {
  if (waiting) return `<p class="status">${waiting}</p>`;
  if (!datasets.length) return '<p class="status">Nothing chosen yet.</p>';
  return `<div class="status"><span>On the timeline</span>${datasets.map(d => `<span class="chosen">${d.name}</span>`).join('')}</div>`;
}

/** The closing rows every concept keeps in this order: what all datasets share, then years, then source. */
export function closing(ex, chosen) {
  const spans = [...new Set((chosen.length ? chosen : ex.datasets).map(d => d.years))];
  return `
    <div class="closing">
      ${ex.shared.map(([label, value]) => `<div class="row"><span class="label">${label}</span><span class="fact">${value}</span></div>`).join('')}
      <div class="row"><span class="label">Years</span><span class="fact">${spans.join(', ')}</span></div>
      <div class="row"><span class="label">Source</span><span class="fact">${ex.source}</span></div>
    </div>`;
}
