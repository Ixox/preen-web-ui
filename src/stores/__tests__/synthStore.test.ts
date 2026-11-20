import { describe, it, expect, beforeEach } from 'vitest';
import { useSynthStore } from '../synthStore';
import { FULL_CAPABILITIES } from '../../midi/preenFmConstants';

describe('synthStore capabilities', () => {
  beforeEach(() => {
    useSynthStore.getState().resetCapabilities();
  });

  it('starts with full pvig support', () => {
    expect(useSynthStore.getState().capabilities).toEqual(FULL_CAPABILITIES);
  });

  it('merges partial capability updates', () => {
    useSynthStore.getState().mergeCapabilities({ featureBits: 0 });
    expect(useSynthStore.getState().capabilities).toEqual({
      ...FULL_CAPABILITIES,
      featureBits: 0,
    });

    useSynthStore.getState().mergeCapabilities({ lfoShapeMax: 7 });
    expect(useSynthStore.getState().capabilities.featureBits).toBe(0);
    expect(useSynthStore.getState().capabilities.lfoShapeMax).toBe(7);
  });

  it('replaces capabilities with setCapabilities', () => {
    useSynthStore.getState().setCapabilities({ featureBits: 1, lfoShapeMax: 3, protocolVersion: 1 });
    expect(useSynthStore.getState().capabilities).toEqual({
      featureBits: 1,
      lfoShapeMax: 3,
      protocolVersion: 1,
    });
  });

  it('reset restores the full-support fallback', () => {
    useSynthStore.getState().setCapabilities({ featureBits: 0, lfoShapeMax: 7, protocolVersion: 1 });
    useSynthStore.getState().resetCapabilities();
    expect(useSynthStore.getState().capabilities).toEqual(FULL_CAPABILITIES);
  });
});