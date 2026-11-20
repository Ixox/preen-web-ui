import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CAPABILITIES,
  capabilityNrpnExclude,
  mergeCapabilities,
  parseCapabilityNRPN,
  sanitizeUnsupportedDestinations,
  supportedLfoTypes,
  supportsFeature,
  visibleMatrixDestNames,
} from '../capabilities';
import {
  CAPABILITY_BITS,
  CAPABILITY_NRPNS,
  FULL_CAPABILITIES,
  LFO_TYPES,
  MATRIX_DEST_ORDER,
} from '../preenFmConstants';
import type { Patch } from '../../types/patch';

const CURRENT_FIRMWARE = { featureBits: 0, lfoShapeMax: 7, protocolVersion: 1 };

function nrpn(paramMSB: number, paramLSB: number, value: number) {
  return {
    paramMSB,
    paramLSB,
    valueMSB: (value >> 7) & 0x7f,
    valueLSB: value & 0x7f,
  };
}

describe('capability parsing', () => {
  it('defaults to full pvig support', () => {
    expect(DEFAULT_CAPABILITIES).toEqual(FULL_CAPABILITIES);
  });

  it('parses the three capability NRPNs', () => {
    expect(parseCapabilityNRPN(nrpn(127, CAPABILITY_NRPNS.FEATURES, 0))).toEqual({ featureBits: 0 });
    expect(parseCapabilityNRPN(nrpn(127, CAPABILITY_NRPNS.LFO_SHAPE_MAX, 7))).toEqual({ lfoShapeMax: 7 });
    expect(parseCapabilityNRPN(nrpn(127, CAPABILITY_NRPNS.PROTOCOL_VERSION, 1))).toEqual({ protocolVersion: 1 });
  });

  it('clamps the reported LFO shape max', () => {
    expect(parseCapabilityNRPN(nrpn(127, CAPABILITY_NRPNS.LFO_SHAPE_MAX, 200))).toEqual({ lfoShapeMax: 26 });
  });

  it('ignores non-capability NRPNs', () => {
    expect(parseCapabilityNRPN(nrpn(0, 0, 1))).toBeNull();
    expect(parseCapabilityNRPN(nrpn(127, 100, 1))).toBeNull();
  });

  it('merges partial capabilities', () => {
    expect(mergeCapabilities(CURRENT_FIRMWARE, { lfoShapeMax: 26 })).toEqual({
      featureBits: 0,
      lfoShapeMax: 26,
      protocolVersion: 1,
    });
  });

  it('reports feature bits', () => {
    expect(supportsFeature(CURRENT_FIRMWARE, CAPABILITY_BITS.OPERATOR_PHASE)).toBe(false);
    expect(supportsFeature(FULL_CAPABILITIES, CAPABILITY_BITS.OPERATOR_PHASE)).toBe(true);
    expect(supportsFeature(FULL_CAPABILITIES, CAPABILITY_BITS.LFO_MIDI_CLOCK)).toBe(true);
  });
});

describe('LFO shape list', () => {
  it('limits shapes to the reported max', () => {
    expect(supportedLfoTypes(CURRENT_FIRMWARE)).toHaveLength(8);
    expect(supportedLfoTypes(CURRENT_FIRMWARE)).toEqual(LFO_TYPES.slice(0, 8));
    expect(supportedLfoTypes(FULL_CAPABILITIES)).toHaveLength(27);
  });
});

describe('matrix destinations', () => {
  it('hides pvig-only destinations on current firmware', () => {
    const names = visibleMatrixDestNames(CURRENT_FIRMWARE);
    expect(names).toHaveLength(54);
    expect(names).not.toContain('Note+');
    expect(names).not.toContain('o1 Ph');
    expect(names).not.toContain('Arp+');
  });

  it('keeps every destination when all features are supported', () => {
    const names = visibleMatrixDestNames(FULL_CAPABILITIES);
    expect(names).toHaveLength(MATRIX_DEST_ORDER.length);
    expect(names).toContain('Note+');
    expect(names).toContain('stp1L');
    expect(names).toContain('ArpRt');
  });

  it('gates destination groups per feature', () => {
    const phaseOnly = { ...CURRENT_FIRMWARE, featureBits: 1 << CAPABILITY_BITS.OPERATOR_PHASE };
    const names = visibleMatrixDestNames(phaseOnly);
    expect(names).toContain('o1 Ph');
    expect(names).toContain('o6 Wp');
    expect(names).not.toContain('Note+');
    expect(names).not.toContain('stp1L');
    expect(names).not.toContain('Arp+');
  });
});

describe('unsupported destination sanitization', () => {
  it('replaces unsupported destinations with None', () => {
    const patch = {
      modulationMatrix: [
        { source: 'LFO 1', destination1: 'Note+', destination2: 'o1 Ph', amount: 1 },
        { source: 'LFO 2', destination1: 'IM1', destination2: 'Mix1', amount: -1 },
      ],
    } as unknown as Patch;

    const sanitized = sanitizeUnsupportedDestinations(patch, CURRENT_FIRMWARE);
    expect(sanitized.modulationMatrix[0].destination1).toBe('None');
    expect(sanitized.modulationMatrix[0].destination2).toBe('None');
    expect(sanitized.modulationMatrix[1]).toEqual(patch.modulationMatrix[1]);
  });

  it('returns the same patch when nothing needs changing', () => {
    const patch = {
      modulationMatrix: [
        { source: 'LFO 1', destination1: 'IM1', destination2: 'Mix1', amount: 1 },
      ],
    } as unknown as Patch;
    expect(sanitizeUnsupportedDestinations(patch, CURRENT_FIRMWARE)).toBe(patch);
  });
});

describe('NRPN push exclusion', () => {
  it('excludes nothing when all features are supported', () => {
    expect(capabilityNrpnExclude(FULL_CAPABILITIES).size).toBe(0);
  });

  it('excludes phase/warp lanes without touching step sequencer steps', () => {
    const exclude = capabilityNrpnExclude({
      ...CURRENT_FIRMWARE,
      featureBits: FULL_CAPABILITIES.featureBits & ~(1 << CAPABILITY_BITS.OPERATOR_PHASE),
    });

    for (let lsb = 120; lsb <= 127; lsb++) expect(exclude.has(`1:${lsb}`)).toBe(true);
    for (const lsb of [0, 1, 4, 5, 8, 9, 12, 13]) expect(exclude.has(`2:${lsb}`)).toBe(true);
    for (const lsb of [2, 3, 6, 7, 10, 11, 14, 15]) expect(exclude.has(`2:${lsb}`)).toBe(false);
  });

  it('excludes the other feature NRPN ranges', () => {
    const exclude = capabilityNrpnExclude({
      ...CURRENT_FIRMWARE,
      featureBits: FULL_CAPABILITIES.featureBits &
        ~(
          (1 << CAPABILITY_BITS.VOICE_PRIORITY) |
          (1 << CAPABILITY_BITS.STEP_SEQ_MODES) |
          (1 << CAPABILITY_BITS.EXTENDED_ARP) |
          (1 << CAPABILITY_BITS.LFO_ENV_CURVES)
        ),
    });

    expect(exclude.has('2:20')).toBe(true);
    for (let lsb = 0; lsb <= 16; lsb++) {
      expect(exclude.has(`5:${lsb}`)).toBe(true);
      expect(exclude.has(`6:${lsb}`)).toBe(true);
    }
    for (let lsb = 4; lsb <= 8; lsb++) expect(exclude.has(`4:${lsb}`)).toBe(true);
    for (let msb = 7; msb <= 10; msb++) {
      for (let lsb = 0; lsb < 32; lsb++) expect(exclude.has(`${msb}:${lsb}`)).toBe(true);
    }
    for (let lsb = 24; lsb <= 27; lsb++) expect(exclude.has(`2:${lsb}`)).toBe(true);
  });
});