# Private rounding explanation pilot

The existing server-verified `computo_sap_admin` authorization gate controls the
new panel. No account identifiers or personal calculation overrides are embedded
in the feature. Only T8 at 85.81% in 2026 is supported for this first review.
Other contracts and years return no panel; extending the pilot needs a separate
decision and verification of each contract's company pattern.

The panel is an information view. The calendar, calcDay, contract tables, payroll
exports, balances and SAP storage remain unchanged. It performs no network or
storage operations of its own. Existing restore points are retained.

## Method

- Reference annual hours are full-time annual hours times the contractual
  percentage, without rounding the intermediate product. Divide by the annual
  working days for the comparison average. These are reference inputs from the
  current model, subject to verification against the individual contract.
- Balance effect is the existing daily balance minus recognized minutes divided
  by 60 minus the exact average. The observed ordinary 85.81% patterns are shown
  explicitly, without assuming that SAP rounds every concept identically.
- Night effect is daily payable hours minus payable minutes divided by 60. The
  existing night-entitlement logic supplies payable minutes. Physical night
  overlap is not substituted for remuneration of the full shift.
- Accumulate unrounded differences; round only the displayed seconds. Positive
  means additional time for the worker and negative means less time.

The period end follows today's Europe/Madrid date automatically, refreshing on
focus, visibility changes and once a minute while the page is open. A custom end
stays fixed until the user selects the automatic "Fins avui" action again.

The accumulated view uses calendar dates through today, inclusively, without
waiting for the current month to be confirmed. Today is explicitly described as
the scheduled shift, and dates from unconfirmed months are labeled provisional.
The separate annual projection always covers January 1 through December 31,
regardless of the custom accumulated interval, including future calendar shifts.
It updates when calendar input changes. Unknown dates and exceptional cases have
explicit counts; they are not treated as zero. A complete interval without work
has zero effect. Recoveries, separately paid extensions and other exceptional balance
allocations are excluded where a like-for-like reference has not been validated.

## Evidence limits

This information panel compares the accepted company rounding pattern with
unrounded reference values. It does not consume a SAP snapshot or duplicate the
general SAP contrast interface. Both concepts are calculated with the calendar;
their reference difference measures rounding, not a discrepancy with SAP or an
unpaid claim. Actual annual closing adjustments may differ from the accumulated
reference effect.

No personal calendar, identity, SAP snapshot or retrospective totals are committed
as fixtures. Security cleanup of earlier Git history and old artifacts remains
an independent open issue; this feature does not resolve it.

## Verification

`node --test tests/rounding-impact.test.mjs` verifies exact arithmetic, signs,
date coverage, exceptional cases, administrator gating, missing data, forecast
separation, daily rollover, annual projections and lack of mutations/network/storage operations.
Existing payroll and SAP regression tests accompany the pilot and the static
production build.
