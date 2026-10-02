# Event Benchmark V2 Report

Run date: 2026-10-02. The benchmark was frozen in
[`event-benchmark-v2-ground-truth.md`](./event-benchmark-v2-ground-truth.md)
before the first model call. It sent only 15 anonymous structured
`MaterialAnalysis` records to KIE for text clustering. No image, video, or
other media was uploaded.

## Result

| Measure | Result |
| --- | --- |
| ContentThread grouping | 3/3 exact groups; 12/12 subject assets (100%) |
| Determinable StoryEvent grouping | 2/2 exact groups; 11/11 determinable assets (100%) |
| Ambiguous relations | 1 group / 4 assets (C) |
| Ambiguity discipline | PASS: C was a ContentThread only, with no StoryEvent |
| Noise discipline | PASS: N-01 to N-03 were all unassigned |
| Severe event hallucinations | 0 |
| KIE text clustering duration | 6,680 ms |

Event A used reliable 10:00–10:05 metadata plus the observable sequence of a
cardigan moving from a table into a box, tissue being added, and the box being
closed. Event B used reliable 15:00–15:05 metadata plus an observable garment
movement on the same rail. C had the same cardigan subject but no reliable
time or process boundary, so it remained only a ContentThread.

## Content discovery compatibility

The existing anonymous two-asset control batch was reprocessed through the
real application path with KIE text clustering and discovery. It finished
`ANALYZED`, created zero confirmed `StoryEvent` records, and created one
`ContentOpportunity` whose `storyEventId` is null. This verifies that content
discovery can consume a ContentThread without manufacturing an event.

## Review note

The B event summary used the word “查看” (viewing), which is not established by
the frozen facts. It does not alter any grouping, chronology, or event
boundary, so it is recorded as a non-severe wording issue rather than a severe
event hallucination. The R3 instruction freezes the prompt, so no prompt
change was made for it.

## Old benchmark interpretation

The older Daily Story Benchmark A/C relationship is **AMBIGUOUS**. Shared
cardigan, box, and tissue-paper attributes without a reliable timeline or
direct process boundary are valid ContentThread evidence but not StoryEvent
evidence.
