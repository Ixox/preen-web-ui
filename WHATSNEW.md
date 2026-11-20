# What's new

## Capability-gated editor for the current PFM3 firmware

The web editor now asks the connected firmware which optional features it
supports and hides the controls it cannot use. PFM3 firmware without the
pvig feature set still works; unsupported values are no longer pushed.

### Capability query

The firmware answers this NRPN block (and sends it at the start of every patch
dump):

| NRPN | Meaning |
|---|---|
| `[127,126]` | feature bitfield (bit set = supported) |
| `[127,125]` | maximum supported LFO shape index |
| `[127,124]` | capability protocol version |

The editor requests it when the MIDI output/channel changes and again after a
patch pull. If no answer arrives, it assumes full pvig support, so older or
non-answering firmware keeps the full UI.

### Feature gates

| Bit | Feature | Editor behaviour when unsupported |
|---|---|---|
| 0 | Operator phase/warp | Phase and Warp sliders hidden |
| 2 | Engine decimation | Decimation selector hidden |
| 3 | Voice priority | Priority selector hidden (Play Mode stays) |
| 4 | Step modes + loop length | Step-mode badges and loop-length knob hidden |
| 5 | Extended arpeggiator | Euclidean seed, user patterns, step grid and pattern loop length hidden |
| 6 | LFO retrigger | No retrigger UI in this editor yet |
| 7 | Extended matrix destinations | `Note+` hidden |
| 8 | LFO envelope curves | Attack/release curve selectors hidden |
| 9 | LFO MIDI clock | Advertised by the current firmware, so Ext sync and clock modes stay visible; hidden only on firmware that lacks it |

The LFO shape list is limited to the reported `[127,125]` value.

Matrix destinations are gated per feature: `oN Ph`/`oN Wp` need bit 0,
`Note+` needs bit 7, `stp1L`/`stp2L` need bit 4, and `Arp+` … `ArpRt` need
bit 5. Unsupported destinations are mapped to `None` before a patch is pushed.

### Patch push filtering

`patchToNRPNMessages()` now accepts `lfoMidiClockSupported` and the push paths
merge a capability-derived exclusion set:

- Phase/warp addresses `1:120`–`1:127` and `2:0,1,4,5,8,9,12,13`.
  Only those eight MSB 2 lanes are excluded: they overlap the step-sequencer
  steps (`2:0`–`2:15`), which remain supported.
- Voice priority `2:20`.
- Step modes/loop length `5:0`–`5:16` and `6:0`–`6:16`.
- Arp seed/lengths `4:4`–`4:8` and user patterns `7:0`–`10:31`.
- LFO envelope curves `2:24`–`2:27`.
- LFOs in Ext mode are pushed with their internal frequency when MIDI clock
  sync is unsupported.

Decimation is CC-only, so there is nothing to exclude from the dump.

### Files

- New: `src/midi/capabilities.ts`, `src/midi/useSynthCapabilities.ts`,
  `src/midi/__tests__/capabilities.test.ts`,
  `src/midi/__tests__/patchSerializerCapabilities.test.ts`,
  `src/stores/__tests__/synthStore.test.ts`.
- Updated: `src/midi/preenFmConstants.ts`, `src/midi/preenFM3Parser.ts`,
  `src/midi/useMidiActions.ts`, `src/midi/liveMidiListener.ts`,
  `src/midi/patchSerializer.ts`, `src/stores/synthStore.ts`,
  `src/components/BreederEditor.tsx`, `src/App.tsx`, and the operator,
  carrier, sequencer, arpeggiator, LFO, LFO-envelope and matrix editors.

### Verification

- `npm test`: 346 passed, 9 skipped.
- `npm run build`: passing.
- `npm run lint`: no new errors in the touched files (the repository already
  had pre-existing lint errors elsewhere).