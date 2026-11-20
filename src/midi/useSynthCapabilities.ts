import { useEffect, useMemo } from 'react';
import type { Output } from 'webmidi';
import { useSynthStore } from '../stores/synthStore';
import { CAPABILITY_NRPNS, type CapabilityBit } from './preenFmConstants';
import {
  supportsFeature as supportsFeatureFor,
  visibleMatrixDestNames,
  type Capabilities,
} from './capabilities';
import { sendNRPN } from './midiService';

/** Request the firmware capability block over NRPN. */
export function requestCapabilities(channel: number): void {
  sendNRPN(
    {
      paramMSB: 127,
      paramLSB: CAPABILITY_NRPNS.FEATURES,
      valueMSB: 0,
      valueLSB: 0,
    },
    channel,
  );
}

/**
 * Reset capabilities to the "assume full pvig support" fallback and query the
 * device whenever the selected MIDI output or channel changes.
 */
export function useCapabilityQuery(selectedOutput: Output | null, channel: number): void {
  useEffect(() => {
    useSynthStore.getState().resetCapabilities();
    if (!selectedOutput) return;
    requestCapabilities(channel);
  }, [selectedOutput, channel]);
}

export function useCapabilities(): Capabilities {
  return useSynthStore((state) => state.capabilities);
}

export function useSupportsFeature(bit: CapabilityBit): boolean {
  return useSynthStore((state) => supportsFeatureFor(state.capabilities, bit));
}

export function useLfoShapeMax(): number {
  return useSynthStore((state) => state.capabilities.lfoShapeMax);
}

export function useVisibleMatrixDestinations(): string[] {
  const capabilities = useCapabilities();
  return useMemo(() => visibleMatrixDestNames(capabilities), [capabilities]);
}