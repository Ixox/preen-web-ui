import type { NRPNMessage } from './preenFM3MidiMap';
import {
  CAPABILITY_BITS,
  CAPABILITY_NRPNS,
  FULL_CAPABILITIES,
  LFO_SHAPE_MAX,
  LFO_TYPES,
  MATRIX_DEST_NAMES,
  MATRIX_DEST_ORDER,
  type CapabilityBit,
  type FirmwareCapabilities,
  type LfoType,
} from './preenFmConstants';
import type { Patch } from '../types/patch';

export type Capabilities = FirmwareCapabilities;

export const DEFAULT_CAPABILITIES: Capabilities = { ...FULL_CAPABILITIES };

export function supportsFeature(caps: Capabilities, bit: CapabilityBit): boolean {
  return (caps.featureBits & (1 << bit)) !== 0;
}

export function parseCapabilityNRPN(nrpn: NRPNMessage): Partial<Capabilities> | null {
  if (nrpn.paramMSB !== 127) return null;
  const value = (nrpn.valueMSB << 7) | nrpn.valueLSB;
  switch (nrpn.paramLSB) {
    case CAPABILITY_NRPNS.FEATURES:
      return { featureBits: value };
    case CAPABILITY_NRPNS.LFO_SHAPE_MAX:
      return { lfoShapeMax: Math.max(0, Math.min(LFO_SHAPE_MAX, value)) };
    case CAPABILITY_NRPNS.PROTOCOL_VERSION:
      return { protocolVersion: value };
    default:
      return null;
  }
}

export function mergeCapabilities(
  current: Capabilities,
  partial: Partial<Capabilities>,
): Capabilities {
  return { ...current, ...partial };
}

export function supportedLfoTypes(caps: Capabilities): LfoType[] {
  const max = Math.max(0, Math.min(LFO_SHAPE_MAX, caps.lfoShapeMax));
  return LFO_TYPES.slice(0, max + 1);
}

/** Feature bit required by a matrix destination, or null when always supported. */
export function matrixDestinationFeatureBit(destId: number): CapabilityBit | null {
  if (destId >= 54 && destId <= 65) return CAPABILITY_BITS.OPERATOR_PHASE;
  if (destId === 66) return CAPABILITY_BITS.EXTENDED_MATRIX_DESTS;
  if (destId === 67 || destId === 68) return CAPABILITY_BITS.STEP_SEQ_MODES;
  if (destId >= 69 && destId <= 73) return CAPABILITY_BITS.EXTENDED_ARP;
  return null;
}

export function isMatrixDestinationSupported(caps: Capabilities, destId: number): boolean {
  const bit = matrixDestinationFeatureBit(destId);
  return bit === null ? true : supportsFeature(caps, bit);
}

export function isMatrixDestNameSupported(caps: Capabilities, name: string): boolean {
  const destId = MATRIX_DEST_NAMES.indexOf(name as typeof MATRIX_DEST_NAMES[number]);
  if (destId < 0) return true;
  return isMatrixDestinationSupported(caps, destId);
}

export function visibleMatrixDestNames(caps: Capabilities): string[] {
  return MATRIX_DEST_ORDER
    .filter((destId) => isMatrixDestinationSupported(caps, destId))
    .map((destId) => MATRIX_DEST_NAMES[destId] as string);
}

export function sanitizeUnsupportedDestinations(patch: Patch, caps: Capabilities): Patch {
  const matrix = patch.modulationMatrix;
  if (!matrix) return patch;

  let changed = false;
  const sanitized = matrix.map((row) => {
    const destination1 = isMatrixDestNameSupported(caps, row.destination1) ? row.destination1 : 'None';
    const destination2 = isMatrixDestNameSupported(caps, row.destination2) ? row.destination2 : 'None';
    if (destination1 === row.destination1 && destination2 === row.destination2) return row;
    changed = true;
    return { ...row, destination1, destination2 };
  });

  return changed ? { ...patch, modulationMatrix: sanitized } : patch;
}

export function capabilityNrpnExclude(caps: Capabilities): Set<string> {
  const exclude = new Set<string>();

  if (!supportsFeature(caps, CAPABILITY_BITS.OPERATOR_PHASE)) {
    for (let lsb = 120; lsb <= 127; lsb++) exclude.add(`1:${lsb}`);
    // OP3-6 phase/warp share MSB=2 with StepSeq1 steps (LSB 0-15).
    // Only exclude the phase/warp lanes, never the step lanes.
    for (const lsb of [0, 1, 4, 5, 8, 9, 12, 13]) exclude.add(`2:${lsb}`);
  }

  if (!supportsFeature(caps, CAPABILITY_BITS.VOICE_PRIORITY)) {
    exclude.add('2:20');
  }

  if (!supportsFeature(caps, CAPABILITY_BITS.STEP_SEQ_MODES)) {
    for (let lsb = 0; lsb <= 16; lsb++) {
      exclude.add(`5:${lsb}`);
      exclude.add(`6:${lsb}`);
    }
  }

  if (!supportsFeature(caps, CAPABILITY_BITS.EXTENDED_ARP)) {
    for (let lsb = 4; lsb <= 8; lsb++) exclude.add(`4:${lsb}`);
    for (let msb = 7; msb <= 10; msb++) {
      for (let lsb = 0; lsb < 32; lsb++) exclude.add(`${msb}:${lsb}`);
    }
  }

  if (!supportsFeature(caps, CAPABILITY_BITS.LFO_ENV_CURVES)) {
    for (let lsb = 24; lsb <= 27; lsb++) exclude.add(`2:${lsb}`);
  }

  return exclude;
}