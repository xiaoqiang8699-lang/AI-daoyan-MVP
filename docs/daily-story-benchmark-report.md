# Daily Story Benchmark Report

Run date: 2026-10-02. Ground truth was frozen before the first AI request in
[`daily-story-benchmark-ground-truth.md`](daily-story-benchmark-ground-truth.md).

## Isolation and privacy

- Batch: `cmuqqy2d00000aoray722s3ht`
- Redis: `127.0.0.1:6382`, dedicated local-only instance
- Queue: `material-analysis-benchmark`
- BullMQ prefix: `ai-director-benchmark`
- Worker: `material-smoke-28460`; consumer count was 1 and the isolation probe
  passed before the batch was created.
- Real User Media Uploaded Externally: **NO**
- Benchmark Media Uploaded Externally: **YES** — only the 20 dedicated,
  anonymous assets in the frozen fixture set were sent to KIE.

## End-to-end result

The Web UI created the new batch, uploaded all 20 fixtures, and started AI
organizing. The dedicated worker completed 20 analyses with no asset failure,
then created two events and two content opportunities. Batch status was
`ANALYZED`.

Progress observed from the real page: `2/20`, `4/20`, `6/20`, `9/20`,
`12/20`, `14/20`, `16/20`, `19/20`, and `20/20`; all intermediate states had
one active worker job or fewer and zero failures.

## Material understanding

All 20 analyses were compared with the frozen observable facts.

| Outcome | Count |
| --- | ---: |
| PASS | 20 |
| PARTIAL | 0 |
| FAIL | 0 |
| Severe material errors | 0 |

Material Understanding: **100%**. The four noise fixtures were described as
noise, a blank image, or blank-color video and were not assigned to an event.
No result claimed a new arrival, sale, price, customer, identity, brand or
other unsupported commercial fact.

## Event clustering

Expected A and B relationships were largely recovered. The actual cardigan
event included all six A assets, but also merged C-01 and C-02. The actual
indoor-display event included B-01, B-02, B-04 and B-05, leaving B-03
unassigned. C-03, C-04 and C-05 did not form the expected third static
work-surface event. All four noise assets stayed unassigned.

Using the frozen per-asset relationship expectation, 14 of 20 assets were
correctly placed or correctly left unassigned: **70%**. This is below the 80%
acceptance threshold. The mismatch is a grouping-quality result, not a material
understanding failure.

## Content opportunities

The system generated two, rather than three, opportunities.

1. **浅驼色针织开衫多形态展示与装盒** — evidence: the dynamic cardigan clip,
   hanger, flat lay, detail, folded-cardigan and open-box material views. It is
   fact-supported and specific; the deterministic sufficiency score is 100 and
   the status is `READY`. Human verdict: **useful**.
2. **室内衣物陈列与空间陈设巡礼** — evidence: rail, hanger, mirror and plant
   views from the indoor display group. It is fact-supported and specific; the
   deterministic sufficiency score is 100 and the status is `READY`. Human
   verdict: **useful**.
3. **Not generated.**

No severe hallucination was found in the material, event or opportunity layers:
**0**. The two titles use visual descriptions and do not assert sales, arrival,
customer activity, brand identity or a named location.

Top 3 Useful: **2 / 3**.

## Missing material

Neither generated opportunity had a `MissingMaterialRequest`, so there was no
real request to evaluate for necessity, phone-executability or instruction
quality. This requirement is **FAIL** for this run; no request was invented to
fill the gap.

## Usage

| Operation | Calls | Success | Failed | Average latency |
| --- | ---: | ---: | ---: | ---: |
| MATERIAL_ANALYSIS | 20 | 20 | 0 | 10,177 ms |
| EVENT_CLUSTERING | 1 | 1 | 0 | 24,479 ms |
| CONTENT_DISCOVERY | 1 | 1 | 0 | 12,325 ms |

Combined P50: **9,664 ms**. Combined P95: **17,190 ms**. KIE did not return
reliable credits or currency cost fields, so both are recorded as `null` rather
than estimated.

## UI verification

- Desktop 1440px: the content-opportunity page and an opportunity-detail page
  rendered without horizontal overflow. The same UI execution completed
  upload, organize, event generation, opportunity display and detail opening.
  **PASS**.
- Mobile 390px: material and opportunity pages rendered without horizontal
  overflow. The generated opportunities were readable and detail entry was
  available. The requested Missing Material portion could not be completed
  because the system produced no request. **FAIL** for the full requested
  mobile flow.

## Decision

`STEP_10B_READY=false`.

The real worker end-to-end run and material understanding passed, but event
clustering (70% < 80%) and Missing Material validation failed. No Step 10C work
was started.
