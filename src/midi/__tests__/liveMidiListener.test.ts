import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSend = vi.hoisted(() => vi.fn());

vi.mock('webmidi', () => ({
  WebMidi: {
    enable: vi.fn().mockResolvedValue(undefined),
    inputs: [],
    outputs: [],
  },
  Input: class {},
  Output: class {},
}));

const mockOutput = {
  id: 'test-out',
  name: 'Test Output',
  manufacturer: 'Test',
  state: 'connected',
  connection: 'open',
  type: 'output',
  send: mockSend,
};

import { applyIncomingNRPN, applyIncomingCC } from '../liveMidiListener';
import { runWithoutMidiOutput, sendCC, sendNRPN, setMidiOutput, clearNRPNQueue } from '../midiService';
import { usePatchStore } from '../../stores/patchStore';
import type { Patch } from '../../types/patch';

function cloneDefaultPatch(): Patch {
  return structuredClone(usePatchStore.getState().currentPatch);
}

describe('liveMidiListener — applyIncomingNRPN & applyIncomingCC', () => {
  beforeEach(() => {
    mockSend.mockClear();
    clearNRPNQueue();
    setMidiOutput(mockOutput as unknown as Parameters<typeof setMidiOutput>[0]);
  });

  afterEach(() => {
    clearNRPNQueue();
    setMidiOutput(null);
  });

  it('applies incoming NRPNs across Engine, StepSeq, Arp, Matrix, and Global', () => {
    const patch = cloneDefaultPatch();

    // Global Voice Priority [2, 20] = 3 (BassP)
    expect(applyIncomingNRPN(patch, { paramMSB: 2, paramLSB: 20, valueMSB: 0, valueLSB: 3 })).toBe(true);
    expect(patch.global.voicePriority).toBe(3);

    // Osc1 frequency [0, 46] = 216 (2.16) & detune [0, 47] = 900 (0.00)
    expect(applyIncomingNRPN(patch, { paramMSB: 0, paramLSB: 46, valueMSB: 1, valueLSB: 88 })).toBe(true);
    expect(patch.operators[0].frequency).toBeCloseTo(2.16, 2);
    expect(applyIncomingNRPN(patch, { paramMSB: 0, paramLSB: 47, valueMSB: 7, valueLSB: 4 })).toBe(true);
    expect(patch.operators[0].detune).toBeCloseTo(0, 2);

    // StepSeq 2 step 4 = 15 (100%), mode = 12 (Alt2), loopLength = 9
    expect(applyIncomingNRPN(patch, { paramMSB: 3, paramLSB: 4, valueMSB: 0, valueLSB: 15 })).toBe(true);
    expect(applyIncomingNRPN(patch, { paramMSB: 6, paramLSB: 4, valueMSB: 0, valueLSB: 12 })).toBe(true);
    expect(applyIncomingNRPN(patch, { paramMSB: 6, paramLSB: 16, valueMSB: 0, valueLSB: 9 })).toBe(true);
    expect(patch.stepSequencers![1].steps[4]).toBe(100);
    expect(patch.stepSequencers![1].stepModes![4]).toBe('Alt2');
    expect(patch.stepSequencers![1].loopLength).toBe(9);

    // Arp Euclidean Seed [4, 4] = 11 & Usr2 step 3 Accent + Slap
    expect(applyIncomingNRPN(patch, { paramMSB: 4, paramLSB: 4, valueMSB: 0, valueLSB: 11 })).toBe(true);
    expect(applyIncomingNRPN(patch, { paramMSB: 8, paramLSB: 3, valueMSB: 0, valueLSB: 2 })).toBe(true);
    expect(applyIncomingNRPN(patch, { paramMSB: 8, paramLSB: 19, valueMSB: 0, valueLSB: 5 })).toBe(true);
    expect(patch.arpeggiator.euclideanSeed).toBe(11);
    expect(patch.arpeggiator.userPatterns?.Usr2?.steps[3]).toBe(100);
    expect(patch.arpeggiator.userPatterns?.Usr2?.modes[3]).toBe('Slap');

    // Matrix row 0 destination1 = 66 (Note+)
    expect(applyIncomingNRPN(patch, { paramMSB: 0, paramLSB: 118, valueMSB: 0, valueLSB: 66 })).toBe(true);
    expect(patch.modulationMatrix[0].destination1).toBe('Note+');

    // Zero MIDI re-emission
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('applies incoming CCs and ignores NRPN transport CCs (6, 38, 96..99)', () => {
    const patch = cloneDefaultPatch();

    expect(applyIncomingCC(patch, 99, 4)).toBe(false);
    expect(applyIncomingCC(patch, 98, 1)).toBe(false);
    expect(applyIncomingCC(patch, 6, 0)).toBe(false);
    expect(applyIncomingCC(patch, 38, 5)).toBe(false);

    expect(applyIncomingCC(patch, 42, 20)).toBe(true); // Engine Decimation HQx2
    expect(patch.global.decimation).toBe(20);

    expect(applyIncomingCC(patch, 101, 8)).toBe(true); // Arp Direction Rotate UD
    expect(patch.arpeggiator.direction).toBe('Rotate UD');
  });

  it('runWithoutMidiOutput suppresses sendCC and sendNRPN to prevent loops', () => {
    runWithoutMidiOutput(() => {
      sendCC(42, 10, 1);
      sendNRPN({ paramMSB: 2, paramLSB: 20, valueMSB: 0, valueLSB: 2 }, 1);
    });
    expect(mockSend).not.toHaveBeenCalled();
  });
});
