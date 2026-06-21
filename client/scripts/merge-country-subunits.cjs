/**
 * merge-country-subunits.cjs — one-off data fix for public/countries.geojson.
 *
 * The Natural Earth 10m map_subunits dataset splits several sovereign states
 * across CONTIGUOUS LAND into administrative subunits with distinct SU_A3 codes
 * (e.g. Russia → RUA "Asian" + RUE "European"). Because the app keys countries
 * by SU_A3, those countries render and behave as two+ separate units with a
 * spurious internal border line.
 *
 * This script dissolves the subunits of a curated set of countries back into a
 * single feature per country (geometry unioned so the internal border vanishes),
 * keyed by ADM0_A3. Island / overseas territories (Hawaii, Sicily, Canary Is.,
 * French Guiana, …) are deliberately LEFT split — they should stay distinct.
 *
 * Run: node scripts/merge-country-subunits.cjs
 * Re-runnable: skips countries already merged to a single feature.
 */

const fs = require('node:fs');
const path = require('node:path');
const { union, featureCollection } = require('@turf/turf');

const GEOJSON = path.join(__dirname, '..', 'public', 'countries.geojson');

// ADM0_A3 → display name. These are single sovereign states that map_subunits
// splits across contiguous land (NOT separate islands). Each becomes one country.
const MERGE = {
  RUS: 'Russia',
  BEL: 'Belgium',
  GBR: 'United Kingdom',
  BIH: 'Bosnia and Herzegovina',
  SRB: 'Serbia',
  GEO: 'Georgia',
  IRQ: 'Iraq',
  SOM: 'Somalia',
  SYR: 'Syria',
  KOR: 'South Korea',
  PRK: 'North Korea',
};

const gj = JSON.parse(fs.readFileSync(GEOJSON, 'utf8'));

const merged = [];
const groups = new Map(); // ADM0_A3 -> features[]

for (const f of gj.features) {
  const adm = f.properties.ADM0_A3;
  if (MERGE[adm]) {
    if (!groups.has(adm)) groups.set(adm, []);
    groups.get(adm).push(f);
  } else {
    merged.push(f); // untouched (islands/territories stay split)
  }
}

for (const [adm, feats] of groups) {
  let geometry;
  if (feats.length === 1) {
    geometry = feats[0].geometry;
  } else {
    // Union all subunit polygons → dissolves shared internal borders.
    let acc = feats[0];
    for (let i = 1; i < feats.length; i++) {
      acc = union(featureCollection([acc, feats[i]]));
    }
    geometry = acc.geometry;
  }
  merged.push({
    type: 'Feature',
    properties: { NAME: MERGE[adm], SU_A3: adm, GU_A3: adm, ADM0_A3: adm },
    geometry,
  });
  console.log(`Merged ${adm} (${MERGE[adm]}): ${feats.length} subunit(s) → 1 feature`);
}

gj.features = merged;
fs.writeFileSync(GEOJSON, JSON.stringify(gj));
console.log(`\nWrote ${merged.length} features to ${path.relative(process.cwd(), GEOJSON)}`);
