/**
 * GpsResultSummary — shows how many photos were auto-placed by GPS vs. how many
 * had no usable location after a global upload.
 *
 * UI-SPEC §5: one row per placed country (accent dot) + optional no-GPS row
 * (muted dot). Error state uses text-destructive with role="alert".
 *
 * Copywriting contract (UI-SPEC):
 *   auto-placed singular: "1 photo auto-placed in [Country]"
 *   auto-placed plural:   "N photos auto-placed in [Country]"
 *   no-GPS:               "N photo(s) added to a country (no GPS) — open a country to add them there"
 *
 * @param {{ result: object }} props
 */
export default function GpsResultSummary({ result }) {
  if (!result) return null;

  if (result.error) {
    return (
      <p className="mt-2 text-label text-destructive" role="alert">
        {result.error}
      </p>
    );
  }

  return (
    <div role="status" className="mt-2 flex flex-col gap-1">
      {(result.placed ?? []).map(({ countryCode, countryName, count }) => (
        <div key={countryCode} className="flex items-center gap-2 text-label text-text">
          {/* accent dot — UI-SPEC: 8px circle, fill #3b82f6 */}
          <span
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }}
            aria-hidden="true"
          />
          {count} photo{count !== 1 ? 's' : ''} auto-placed in {countryName}
        </div>
      ))}
      {result.noGps > 0 && (
        <div className="flex items-center gap-2 text-label text-text-muted">
          {/* muted dot — UI-SPEC: 8px circle, fill #6b7280 */}
          <span
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#6b7280', flexShrink: 0 }}
            aria-hidden="true"
          />
          {result.noGps} photo{result.noGps !== 1 ? 's' : ''} added to a country (no GPS) — open a country to add them there
        </div>
      )}
    </div>
  );
}
