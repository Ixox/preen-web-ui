import { describe, it, expect } from 'vitest';
import {
  flashSynthParamsToPatch,
  patchToNRPNMessages,
} from '../patchSerializer';
import { capabilityNrpnExclude, sanitizeUnsupportedDestinations } from '../capabilities';
import { FULL_CAPABILITIES, MIDI_CLOCK_NRPN } from '../preenFmConstants';
import type { Patch } from '../../types/patch';

const CURRENT_FIRMWARE = { featureBits: 0, lfoShapeMax: 7, protocolVersion: 1 };

function makePatch(): Patch {
  return flashSynthParamsToPatch(new Uint8Array(1024));
}

function hasAddress(messages: ReturnType<typeof patchToNRPNMessages>, msb: number, lsb: number): boolean {
  return messages.some((msg) => msg.paramMSB === msb && msg.paramLSB === lsb);
}

function valueAt(messages: ReturnType<typeof patchToNRPNMessages>, msb: number, lsb: number): number | undefined {
  const msg = messages.find((m) => m.paramMSB === msb && m.paramLSB === lsb);
  return msg ? (msg.valueMSB << 7) | msg.valueLSB : undefined;
}

describe('capability-aware patch push', () => {
  it('omits phase/warp lanes but keeps step sequencer steps', () => {
    const messages = patchToNRPNMessages(makePatch(), {
      exclude: capabilityNrpnExclude(CURRENT_FIRMWARE),
    });

    for (let lsb = 120; lsb <= 127; lsb++) {
      expect(hasAddress(messages, 1, lsb)).toBe(false);
    }
    for (const lsb of [0, 1, 4, 5, 8, 9, 12, 13]) {
      expect(hasAddress(messages, 2, lsb)).toBe(false);
    }
    for (const lsb of [2, 3, 6, 7, 10, 11, 14, 15]) {
      expect(hasAddress(messages, 2, lsb)).toBe(true);
    }
  });

  it('omits unsupported feature NRPNs', () => {
    const messages = patchToNRPNMessages(makePatch(), {
      exclude: capabilityNrpnExclude(CURRENT_FIRMWARE),
    });

    expect(hasAddress(messages, 2, 20)).toBe(false);
    expect(messages.some((m) => m.paramMSB === 5 || m.paramMSB === 6)).toBe(false);
    expect(messages.some((m) => m.paramMSB >= 7 && m.paramMSB <= 10)).toBe(false);
    expect([4, 5, 6, 7, 8].some((lsb) => hasAddress(messages, 4, lsb))).toBe(false);
    expect([24, 25, 26, 27].some((lsb) => hasAddress(messages, 2, lsb))).toBe(false);
    expect(hasAddress(messages, 4, 0)).toBe(true);
    expect(hasAddress(messages, 4, 3)).toBe(true);
  });

  it('sends every feature NRPN when all features are supported', () => {
    const messages = patchToNRPNMessages(makePatch(), {
      exclude: capabilityNrpnExclude(FULL_CAPABILITIES),
      lfoMidiClockSupported: true,
    });

    expect(hasAddress(messages, 1, 120)).toBe(true);
    expect(hasAddress(messages, 2, 20)).toBe(true);
    expect(hasAddress(messages, 5, 0)).toBe(true);
    expect(hasAddress(messages, 6, 16)).toBe(true);
    expect(hasAddress(messages, 4, 4)).toBe(true);
    expect(hasAddress(messages, 2, 24)).toBe(true);
  });

  it('falls back to internal LFO frequency when MIDI clock is unsupported', () => {
    const patch = makePatch();
    const lfos = patch.lfos;
    if (!lfos) throw new Error('patch has no LFOs');
    lfos[0] = {
      ...lfos[0],
      syncMode: 'Ext',
      midiClockMode: 'MC',
      frequency: 5,
    };

    const withClock = patchToNRPNMessages(patch, { lfoMidiClockSupported: true });
    const withoutClock = patchToNRPNMessages(patch, { lfoMidiClockSupported: false });

    expect(valueAt(withClock, 1, 41)).toBe(MIDI_CLOCK_NRPN.MC);
    expect(valueAt(withoutClock, 1, 41)).toBe(500);
  });

  it('pushes sanitized matrix destinations instead of unsupported IDs', () => {
    const patch = makePatch();
    patch.modulationMatrix = patch.modulationMatrix.map((row, index) =>
      index === 0 ? { ...row, destination1: 'Note+', destination2: 'o1 Ph' } : row,
    );

    const sanitized = sanitizeUnsupportedDestinations(patch, CURRENT_FIRMWARE);
    const messages = patchToNRPNMessages(sanitized);

    expect(valueAt(messages, 0, 118)).toBe(0);
    expect(valueAt(messages, 0, 119)).toBe(0);
  });
});