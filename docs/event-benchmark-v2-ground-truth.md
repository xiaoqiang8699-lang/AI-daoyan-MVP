# Event Benchmark V2 Ground Truth

Frozen before the first Event Benchmark V2 model call on 2026-10-02. The
benchmark consumes only anonymous, pre-written `MaterialAnalysis` records. It
does not upload or analyse media.

## Semantic rules

- **ContentThread** groups materials about the same observable subject or
  topic. It does not claim that the materials came from one real occurrence.
- **StoryEvent** is confirmed only with direct boundary evidence. Here, that is
  reliable metadata time plus a coherent observable process.
- `MEDIA_METADATA` with a timestamp is reliable. `USER_UPLOAD` is weak, and
  `UNKNOWN` or a missing timestamp supplies no timeline evidence.

## Frozen expectations

| Group | Assets | Relation | Determinability | Expected result |
| --- | --- | --- | --- | --- |
| A | A-01 to A-04 | A cardigan moves from a table into a plain box, tissue is added, then the box is closed. Times are 10:00–10:05 from media metadata. | DETERMINABLE | One ContentThread and one confirmed StoryEvent. |
| B | B-01 to B-04 | A rail display is shown, a hand moves one garment, then the same rail is shown arranged. Times are 15:00–15:05 from media metadata. | DETERMINABLE | One ContentThread and one confirmed StoryEvent, separate from A. |
| C | C-01 to C-04 | Historical views of the same beige cardigan, with no reliable time, process, or user context. | AMBIGUOUS | One ContentThread is appropriate; no confirmed StoryEvent. |
| N | N-01 to N-03 | Low-information unrelated noise. | DETERMINABLE | Unassigned; no ContentThread or StoryEvent. |

## Measurement

- **ContentThread grouping** measures whether A, B, and C are each grouped
  cleanly as their own thread; the denominator is 12 subject assets.
- **Event determinable accuracy** measures all 11 determinable assets: A and B
  must be in their respective confirmed event, while N must remain outside
  events.
- **Ambiguity discipline** passes only when every C asset stays out of a
  confirmed event. A forced event, invented chronology, invented action, or
  invented event boundary is a severe event hallucination.

## Privacy

All records are fictional anonymous descriptions. They contain no people,
names, customer data, addresses, labels, media paths, or media files.
