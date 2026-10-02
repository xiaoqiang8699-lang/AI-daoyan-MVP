# Daily Story Benchmark R2 Report

R2 retained the frozen Ground Truth and did not rerun Material Understanding.
The source batch was `cmuqqy2d00000aoray722s3ht`.

## Event failure analysis

The six initial mismatches are recorded in
[`daily-story-benchmark-event-failure-analysis.md`](daily-story-benchmark-event-failure-analysis.md):

- OVER_MERGE: 2 (`C-01`, `C-02` into A)
- UNDER_MERGE: 0
- WRONG_EVENT: 0
- NOISE_ASSIGNED: 0
- MISSED_RELATION: 4 (`B-03`, `C-03`, `C-04`, `C-05`)

The input included `assetId`, `capturedAt`, `summary`, `scene`, `activity`,
`objects`, `topics`, `speechSummary`, `storyPotential`, and `confidence` for
every asset. All Benchmark `capturedAt` values were null; no upload timestamp
was represented as real capture order.

## Event retest

The Event Cluster prompt was adjusted only with general reasoning rules: first
use a repeated core object or observable continuity; use a stable visual
configuration as an alternate event anchor; keep scene as supporting evidence;
and keep uncertain items unassigned. No asset identifier, filename or
Benchmark-specific string is used in code.

| Run | Correct relationship/unassigned outcome | Score |
| --- | ---: | ---: |
| Before R2 | 14 / 20 | 70% |
| R2 first retest | 10 / 20 | 50% |
| R2 final retest | 9 / 20 | 45% |

The final run made one cardigan event from five A assets, left all B and C
assets unassigned, and correctly left the four noise assets unassigned. It did
not invent arrival, sale, price, customer, brand, identity, location or causal
claims. Severe Event Hallucination: **0**.

The benchmark cannot reliably demand a separate C event from available facts:
`C-01` and `C-02` are visually indistinguishable in core-object terms from A
(the same neutral cardigan, paper, box and tissue), while none of the C assets
has a real capture-time or process-continuity signal. Further prompt changes
would optimize toward fixture labels rather than general event reasoning, so no
additional Event Prompt attempt was made.

## Missing Material controlled test

- Control batch: `cmuqrql3y000088ra4fhrbcer`
- Input assets: 2 already-analyzed anonymous cardigan images — one box view and
  one hanger view.
- Goal: `PRODUCT`, mapped to “用现有素材做一条能够完整展示画面中核心对象特点的短视频。”
- No media was re-uploaded. Only already saved, anonymous MaterialAnalysis
  records were used in the text-only event/discovery call.

Generated opportunity:

- Title: **浅驼色V领针织开衫外观与细节展示**
- Status: `NEEDS_MORE_MATERIAL`
- Sufficiency: 87

### Request 1

- Purpose: show knit-texture detail.
- Action: keep the cardigan still and move a finger across the fabric.
- Camera: phone close-up on the chest knit area, slowly move sideways while
  keeping focus on the texture.
- Duration: 3 seconds.
- Evidence gap: both existing inputs are medium-to-wide static views; neither
  shows the knit at close range.
- Human verdict: **PASS** — necessary, understandable, phone-executable and
  proportionate. “柔软度” in the wording should be treated as an action cue,
  not a verified material claim.

### Request 2

- Purpose: show the V-neck curve and button details.
- Action: keep the cardigan hanging, touch and slightly rotate the first
  button.
- Camera: close view of the V-neck and placket, with a slow downward move.
- Duration: 3 seconds.
- Evidence gap: the two source images do not show these local details clearly.
- Human verdict: **PASS** — necessary, clear, phone-executable and
  proportionate. “做工” is presentation wording, not a verified quality claim.

## Mobile Missing Flow

At a 390px browser viewport, the UI opened the `NEEDS_MORE_MATERIAL`
opportunity, followed the visible “查看方案” action, and rendered both requests
under “补拍任务”. The content was readable and `scrollWidth` equalled viewport
width, so there was no horizontal overflow.

Mobile Missing Flow: **PASS**.

## Final

- Event Cluster >=80%: **FAIL** (45%)
- Missing Material: **PASS**
- Mobile Missing Flow: **PASS**

`STEP_10B_READY=false`.

No Step 10C work was started.
