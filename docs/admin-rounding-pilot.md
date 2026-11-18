# Rounding information for part-time contracts

The information panel is available alongside the calendar for every supported
part-time profile. Its original private pilot is retained in Git history and the
restore branches. It no longer sits inside the SAP administrator component.
The SAP bridge, private corrections, SAP snapshots and account authorization
remain unchanged. The panel has no network or storage operations of its own.

## Supported inputs

- T8: 75%, 78.14%, 78.91%, 85% and 85.81%, including T8.1 through T8.5 at 75%.
- Estiu 75%: AT86 and AT87 from the existing monthly assignments.
- Years with annual hours and working days defined in Còmput: 2020–2027.
- Full-time profiles, Estiu 100%, unknown percentages and years without bases do
  not receive a fabricated part-time result.

All descriptions, examples, annual references and company bases use the selected
profile. The 85.81% pilot's label and 6.71-hour base are not reused globally.
The 75% T8.4/T8.5 examples distinguish ordinary Sundays from shorter weekdays.

## Method

For annual T8, reference hours are full-time annual hours times the contractual
percentage, preserving every intermediate decimal, divided by the year's working
days. The daily effect is the existing daily balance minus recognized minutes
divided by 60 minus that exact average. Tables use the existing configured T8
pattern. They are a reference calculation, not a claim that every historical SAP
record or individual closing adjustment has been independently verified.

For Estiu 75%, Còmput records recognized hours rather than the annual T8 net daily
balance. The effect therefore compares those rounded recognized hours directly
with their minutes, without deducting an annual daily average. The calendar's
missing months remain explicitly incomplete/outside the known contract period;
no contract duration is inferred and no missing time is treated as zero.

For night remuneration, the effect compares the existing daily payable hours
with payable minutes divided by 60. Physical overlap is not substituted for a
full shift when the existing remuneration rule pays the full shift.

Accumulate unrounded differences, rounding only displayed seconds. Positive adds
time for the worker; negative subtracts it. Unknown dates and exceptional
allocations have explicit coverage counts. Existing calendar and payroll
calculations are never modified by this presentation adapter.

## Result organization

1. Contract explanation is collapsed and uses this profile's own examples.
2. Accumulation is visible and follows the Europe/Madrid day, including today's
   scheduled shift. Unconfirmed months are labeled provisional.
3. A custom period is collapsed, with both dates initially blank. No interval
   result is rendered before the user selects both dates. Its values and daily
   detail cover exactly the chosen interval, including forecast dates if chosen.
4. Annual projection is independent and recalculates with calendar changes.

Changing or invalidating the custom period cannot change or hide the accumulated
or annual results. The accepted company pattern is compared with exact reference
values; this panel does not duplicate the separate SAP comparison interface.
An employee who changed contracts must analyze each segment with its proper
profile; this feature does not invent a contract history.

## Validation and privacy

The rounding tests cover independently specified ordinary durations, balances and
night minutes for every T8 variant and both summer assignments, all configured
annual bases, missing assignments, duplicate/invalid dates, daily rollover,
future dates, read-only behavior and the actual rendered result grouping.
Existing payroll and SAP regression checks and the production build also run.
No personal identity, calendar, SAP snapshot or individual corrections are
committed as fixtures. Earlier Git history and artifact privacy cleanup remains
an independent open issue; this release does not resolve it.
