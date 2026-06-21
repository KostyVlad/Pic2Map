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
 * single feature per country (geometry unioned so the internal border vanishes).
 * Island / overseas territories (Hawaii, Sicily, Canary Is., French Guiana, …)
 * are deliberately LEFT split — they should stay distinct.
 *
 * Territory overrides (politically corrected vs. the raw dataset):
 *   - Crimea (SU_A3 RUC, which NE codes as ADM0_A3 RUS) is assigned to UKRAINE.
 *
 * Run: node scripts/merge-country-subunits.cjs   (run against the ORIGINAL dataset)
 */

const fs = require('node:fs');
const path = require('node:path');
const { union, featureCollection } = require('@turf/turf');

const GEOJSON = path.join(__dirname, '..', 'public', 'countries.geojson');

// targetKey → display name. Each becomes one dissolved country feature.
const NAMES = {
  RUS: 'Russia',
  UKR: 'Ukraine',
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

/**
 * Decide which merge group (if any) a feature belongs to.
 * Returns the target country key, or null to leave the feature untouched.
 */
function targetKey(f) {
  const su = f.properties.SU_A3;
  const adm = f.properties.ADM0_A3;
  if (su === 'RUC') return 'UKR';        // Crimea → Ukraine (not Russia)
  if (adm === 'RUS') return 'RUS';       // remaining Russia subunits → Russia
  if (adm === 'UKR') return 'UKR';       // mainland Ukraine → Ukraine (unions with Crimea)
  if (NAMES[adm]) return adm;            // other contiguous-mainland splits
  return null;
}

const gj = JSON.parse(fs.readFileSync(GEOJSON, 'utf8'));

const merged = [];
const groups = new Map(); // targetKey -> features[]

for (const f of gj.features) {
  const key = targetKey(f);
  if (key) {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  } else {
    merged.push(f); // untouched (islands/territories stay split)
  }
}

for (const [key, feats] of groups) {
  let geometry;
  if (feats.length === 1) {
    geometry = feats[0].geometry;
  } else {
    let acc = feats[0];
    for (let i = 1; i < feats.length; i++) {
      acc = union(featureCollection([acc, feats[i]]));
    }
    geometry = acc.geometry;
  }
  merged.push({
    type: 'Feature',
    properties: { NAME: NAMES[key], SU_A3: key, GU_A3: key, ADM0_A3: key },
    geometry,
  });
  console.log(`Merged ${key} (${NAMES[key]}): ${feats.length} subunit(s) → 1 feature`);
}

gj.features = merged;
fs.writeFileSync(GEOJSON, JSON.stringify(gj));
console.log(`\nWrote ${merged.length} features to ${path.relative(process.cwd(), GEOJSON)}`);
