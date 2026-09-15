# Analytics event privacy boundary

Analytics uses one anonymous UUID per browser tab. The identifier is held only
in `sessionStorage`; it is not a cookie, account identifier, fingerprint, or
cross-session profile.

The v1 contract accepts only discovery events with bounded derived properties:
query length, selected administrative filters, zero-result counts, a pharmacy
identifier, and controlled failure codes. It rejects raw search text, exact
coordinates, route traces, free-form errors, and unknown keys.

The API records its receipt time in UTC and keeps events for 30 days. Cleanup is
a separately callable, idempotent service so public requests never perform
retention deletion. Pharmacy correlation is stored only in the indexed
`AnalyticsEvent.pharmacyId` column, never duplicated in JSON properties.

Browser delivery is best-effort: Beacon is preferred and a keepalive fetch is
used when Beacon is unavailable, rejects the payload, or throws. Delivery
failures never delay public discovery, call, route, or arrival actions.
