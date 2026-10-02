# Daily Story Benchmark Ground Truth

Frozen before the first formal AI run on 2026-10-02. This file describes only
the dedicated synthetic or existing anonymous test fixtures listed below. It
must not be changed in response to AI output.

## Expected events

- **A — beige cardigan presentation:** several direct visual views of one beige
  button cardigan, including a box, hanger, detail and static display.
- **B — neutral indoor clothing display:** garments, rails, shelves, mirror and
  plant in a neutral indoor display area. The visual evidence does not identify
  a shop, brand, location, person or commercial activity.
- **C — neutral garment and paper-material work surfaces:** static views of a
  folded garment, plain paper, a box, tape, string, unmarked parcels and a
  tabletop. The evidence does not establish delivery, sales, packing activity,
  ownership or a before/after event.

## Assets

| Asset ID | Media type | Frozen observable facts | Expected event | Noise | Content value |
| --- | --- | --- | --- | --- | --- |
| A-01 | Image | A folded beige button cardigan is in an open plain kraft box with white tissue paper. | A | No | Yes |
| A-02 | Image | A beige button cardigan hangs from a wooden hanger against a light neutral background. | A | No | Yes |
| A-03 | Image | A beige button cardigan is shown flat against a light neutral background. | A | No | Yes |
| A-04 | Image | Close visual detail of beige knit fabric and plain buttons. | A | No | Yes |
| A-05 | Image | A folded beige button cardigan rests on a pale surface. | A | No | Yes |
| A-06 | Video | An anonymous short clip shows a beige cardigan being lifted and opened; no person is identifiable. | A | No | Yes |
| B-01 | Image | White, gray and dark garments hang on plain hangers and a rail in an indoor area. | B | No | Yes |
| B-02 | Image | Close view of neutral garments on hangers and a metal rail. | B | No | Yes |
| B-03 | Image | Folded white, gray and dark garments sit on neutral shelves. | B | No | Yes |
| B-04 | Image | An empty reflective surface and garments are visible in an indoor area; no person is reflected. | B | No | Yes |
| B-05 | Image | A green plant stands beside neutral garments on a rail. | B | No | Yes |
| C-01 | Image | A folded beige cardigan and plain white tissue paper sit on a pale tabletop. | C | No | Yes |
| C-02 | Image | A folded neutral garment sits in an open unmarked kraft box with white tissue paper. | C | No | Yes |
| C-03 | Image | Plain white and kraft paper rolls and unmarked tape are on a table. | C | No | Yes |
| C-04 | Image | Plain string, tissue paper and kraft paper sit in a wooden tray. | C | No | Yes |
| C-05 | Image | Several unmarked kraft paper parcels are on a wooden shelf. | C | No | Yes |
| N-01 | Image | Low-information, unrelated noise image from the isolated Step 10B fixture set. | — | Yes | No |
| N-02 | Image | Plain forced-failure fixture image with no meaningful visual subject. | — | Yes | No |
| N-03 | Video | Low-information abstract blue clip with no meaningful subject or action. | — | Yes | No |
| N-04 | Video | Low-information abstract green clip with no meaningful subject or action. | — | Yes | No |

## Privacy and interpretation constraints

- All 20 inputs are dedicated, no-privacy benchmark assets.
- No real user, customer, address, account, label, QR code, voice, face, or
  identifying metadata is part of the test set.
- Events are evaluated by material relationship, not title wording.
- A visual state must not be expanded into unsupported source, purpose, causal,
  location, identity, sales, arrival, or customer claims.
