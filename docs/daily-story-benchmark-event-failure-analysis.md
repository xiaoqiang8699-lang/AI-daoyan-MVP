# Daily Story Benchmark — Event Failure Analysis

This analysis uses the frozen Ground Truth and the first formal run. The six
errors below are recorded before the Event Cluster prompt change.

| Asset ID | Ground Truth Event | AI Assigned Event | Error Type | Reason |
| --- | --- | --- | --- | --- |
| C-01 | C — neutral garment and paper-material work surfaces | A — beige cardigan presentation | OVER_MERGE | The folded cardigan and paper share objects with A, but this static tabletop composition belongs to the distinct C relationship. |
| C-02 | C — neutral garment and paper-material work surfaces | A — beige cardigan presentation | OVER_MERGE | The box and folded garment were treated as the same event as A rather than the separate work-surface grouping in the frozen set. |
| B-03 | B — neutral indoor clothing display | Unassigned | MISSED_RELATION | Folded neutral garments on the shelf visually relate to B's rails, mirror and plant environment. |
| C-03 | C — neutral garment and paper-material work surfaces | Unassigned | MISSED_RELATION | Plain paper rolls and tape are part of the frozen C tabletop-material group. |
| C-04 | C — neutral garment and paper-material work surfaces | Unassigned | MISSED_RELATION | The tray of string and paper belongs with the C work-surface materials. |
| C-05 | C — neutral garment and paper-material work surfaces | Unassigned | MISSED_RELATION | The unmarked paper parcels share the C material relationship and were omitted. |

## Failure count

- OVER_MERGE: 2
- UNDER_MERGE: 0
- WRONG_EVENT: 0
- NOISE_ASSIGNED: 0
- MISSED_RELATION: 4

The dominant failure is `MISSED_RELATION`. The retest therefore changes only
general Event Cluster reasoning: core subject identity first, observable
continuity second, real capture time only when present, then topic and scene;
it also retains conservative unassignment. No Benchmark asset ID or string is
used by the implementation.

## Input completeness

Every input item passed to `clusterEvents` includes `assetId`, `capturedAt`,
`summary`, `scene`, `activity`, `objects`, `topics`, `speechSummary`,
`storyPotential`, and `confidence`. For this Benchmark, `capturedAt` is null
for every upload, so no timestamp is presented as a true capture sequence.
