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

import {
  setMidiOutput,
  setMidiForwardInput,
  getMidiForwardInput,
} from '../midiService';
import { isPreenFM3Device } from '../midiDevices';

type MessageHandler = (event: { message: { data: Uint8Array } }) => void;

let handler: MessageHandler | null = null;

const mockOutput = { send: mockSend };

const mockInput = {
  addListener: vi.fn((event: string, cb: MessageHandler) => {
    if (event === 'midimessage') handler = cb;
  }),
  removeListener: vi.fn(),
};

function send(bytes: number[]) {
  handler?.({ message: { data: new Uint8Array(bytes) } });
}

beforeEach(() => {
  vi.clearAllMocks();
  handler = null;
  setMidiOutput(mockOutput as never);
});

afterEach(() => {
  setMidiForwardInput(null);
  setMidiOutput(null);
});

describe('MIDI forwarding', () => {
  it('forwards notes, CC and clock to the PreenFM3 output', () => {
    setMidiForwardInput(mockInput as never);

    send([0x90, 60, 100]); // note on
    send([0x80, 60, 0]);   // note off
    send([0xb0, 7, 42]);   // CC
    send([0xf8]);          // clock

    expect(mockSend).toHaveBeenCalledTimes(4);
    expect(mockSend.mock.calls[0][0]).toEqual(new Uint8Array([0x90, 60, 100]));
    expect(mockSend.mock.calls[3][0]).toEqual(new Uint8Array([0xf8]));
  });

  it('does not forward pitch bend, aftertouch or SysEx', () => {
    setMidiForwardInput(mockInput as never);

    send([0xe0, 0, 64]);       // pitch bend
    send([0xd0, 80]);          // channel pressure
    send([0xf0, 0x7d, 0xf7]);  // SysEx

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('stops forwarding when the input is cleared', () => {
    setMidiForwardInput(mockInput as never);
    send([0x90, 60, 100]);
    expect(mockSend).toHaveBeenCalledTimes(1);

    setMidiForwardInput(null);
    expect(mockInput.removeListener).toHaveBeenCalledWith('midimessage', expect.any(Function));
    expect(getMidiForwardInput()).toBeNull();

    send([0x90, 62, 100]);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

describe('isPreenFM3Device', () => {
  it('matches the PreenFM3 device name variants', () => {
    expect(isPreenFM3Device('PreenFM3')).toBe(true);
    expect(isPreenFM3Device('PreenFM3 MIDI 1')).toBe(true);
    expect(isPreenFM3Device('PreenFM3: PreenFM3 MIDI 1')).toBe(true);
    expect(isPreenFM3Device('PreenFM3-1')).toBe(true);
    expect(isPreenFM3Device('preenfm3')).toBe(true);
  });

  it('rejects other devices and the web editor virtual port', () => {
    expect(isPreenFM3Device('Launchkey Mini')).toBe(false);
    expect(isPreenFM3Device('PreenFM3 Web Editor')).toBe(false);
    expect(isPreenFM3Device(null)).toBe(false);
  });
});
