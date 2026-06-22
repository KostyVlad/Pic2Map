# Rebuilding `countries.geojson`

`client/public/countries.geojson` (and its server copy `server/src/data/countries.geojson`)
is the country-polygon dataset used for the map and for server-side point-in-polygon
country assignment. Both copies MUST stay identical.

It is built from the canonical **Natural Earth 10m map subunits** dataset with
[mapshaper](https://github.com/mbostock/mapshaper), simplified with Visvalingam (smooth,
not grid-snapped) and quantized to ~0.001° (~100 m). An earlier bundled version was
quantized to 0.1° (~11 km), which made borders look blocky/stair-stepped — do NOT
re-introduce coarse precision.

## Why these transforms

- **Country merges** (`-each` key assignment + `-dissolve`): Natural Earth splits some
  sovereign states across contiguous land into administrative subunits. We dissolve those
  back into one feature each: `RUS, BEL, GBR, BIH, SRB, GEO, IRQ, SOM, SYR, KOR, PRK`.
  Island / overseas territories (Hawaii, Sicily, Canary Is., French Guiana, …) are LEFT
  split (keyed by `SU_A3`) so they stay distinct on the map.
- **Crimea → Ukraine**: NE codes Crimea (`SU_A3=RUC`) as `ADM0_A3=RUS`. We reassign it to
  Ukraine so it highlights with Ukraine. Russia keeps RUA/RUE/Kaliningrad only.
- Output key is written to `SU_A3`/`GU_A3`/`ADM0_A3` so it matches `extractIso`
  (`client/src/utils/isoCode.js` ↔ `server/src/utils/isoCode.js`).

## Command

```bash
# 1. Download the high-res source (~14 MB, not committed)
curl -fsSL -o ne_subunits.geojson \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_subunits.geojson

# 2. Build (requires `npx mapshaper`)
npx -y mapshaper ne_subunits.geojson \
  -each 'key = (SU_A3==="RUC") ? "UKR" : (ADM0_A3==="RUS") ? "RUS" : (ADM0_A3==="UKR") ? "UKR" : (["BEL","GBR","BIH","SRB","GEO","IRQ","SOM","SYR","KOR","PRK"].indexOf(ADM0_A3)>-1 ? ADM0_A3 : SU_A3)' \
  -dissolve key copy-fields=NAME,SU_A3,GU_A3,ADM0_A3 \
  -each 'var n={RUS:"Russia",UKR:"Ukraine",BEL:"Belgium",GBR:"United Kingdom",BIH:"Bosnia and Herzegovina",SRB:"Serbia",GEO:"Georgia",IRQ:"Iraq",SOM:"Somalia",SYR:"Syria",KOR:"South Korea",PRK:"North Korea"}; if(n[key]){NAME=n[key];} SU_A3=key; GU_A3=key; ADM0_A3=key;' \
  -clean \
  -simplify 12% visvalingam keep-shapes \
  -o force precision=0.001 countries.geojson

# 3. Deploy to both locations (they must be identical)
cp countries.geojson ../public/countries.geojson          # client
cp countries.geojson ../../server/src/data/countries.geojson  # server
```

Adjust `-simplify 12%` for the size/detail tradeoff (lower % = smaller + blockier).
After rebuilding, re-run the server geo tests: `cd server && node -r dotenv/config --test test/geo.test.js`.
