import { create } from 'zustand';
import {
  DEFAULT_CAPABILITIES,
  mergeCapabilities,
  type Capabilities,
} from '../midi/capabilities';

interface SynthState {
  pfm3Version: number | null;
  midiConnectionType: 'none' | 'usb' | 'din' | 'webmidi' | 'unknown';
  capabilities: Capabilities;
  setPfm3Version: (version: number | null) => void;
  setMidiConnectionType: (type: SynthState['midiConnectionType']) => void;
  setCapabilities: (capabilities: Capabilities) => void;
  mergeCapabilities: (partial: Partial<Capabilities>) => void;
  resetCapabilities: () => void;
}

export const useSynthStore = create<SynthState>((set) => ({
  pfm3Version: null,
  midiConnectionType: 'none',
  capabilities: { ...DEFAULT_CAPABILITIES },
  setPfm3Version: (version) => set({ pfm3Version: version }),
  setMidiConnectionType: (type) => set({ midiConnectionType: type }),
  setCapabilities: (capabilities) => set({ capabilities }),
  mergeCapabilities: (partial) =>
    set((state) => ({ capabilities: mergeCapabilities(state.capabilities, partial) })),
  resetCapabilities: () => set({ capabilities: { ...DEFAULT_CAPABILITIES } }),
}));