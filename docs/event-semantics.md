# ContentThread and StoryEvent semantics

## ContentThread

A ContentThread is a logical grouping of materials around the same observable
subject, product, person, or content topic. It does not assert that the
materials happened in one real-world occurrence.

## StoryEvent

A StoryEvent is persisted only when there is direct evidence for one real
process: reliable metadata or user-provided chronology, visible action
continuity, an identifiable shared process, explicit user context, or another
direct boundary. Topic, scene, and objects alone are insufficient.

## Time reliability

| Stored source | Event reasoning reliability |
| --- | --- |
| `MEDIA_METADATA` with `capturedAt` | Reliable |
| `USER_UPLOAD` with `capturedAt` | Weak |
| `UNKNOWN`, or any missing `capturedAt` | None |

The current schema uses `USER_UPLOAD` for the legacy upload-time category; it
is deliberately not enough to construct a chronology. A future schema may add
`USER_PROVIDED` and `UPLOAD_TIME` as explicit values without changing these
rules.

## Current implementation boundary

The first implementation is a DTO-level split. `contentThreads` are produced
by clustering and drive content discovery, while only confirmed `events` are
stored in the existing `StoryEvent` table. This avoids a database migration
while keeping `ContentOpportunity.storyEventId` nullable for opportunities
that are valid from a ContentThread alone.

The prior A/C relation in the Daily Story Benchmark is therefore
**AMBIGUOUS**, not a valid target for event-prompt tuning: shared cardigan,
box, and tissue evidence without reliable chronology cannot establish a single
event.
