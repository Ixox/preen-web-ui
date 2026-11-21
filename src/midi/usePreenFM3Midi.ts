/**
 * React hook for PreenFM3 MIDI communication
 * Uses a Zustand store so MIDI state is shared across all components.
 */

import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { Input, Output } from 'webmidi';
import {
  initializeMidi,
  setMidiInput,
  setMidiOutput,
  setMidiForwardInput,
  setMidiChannel,
  sendAlgorithmChange,
  sendIMChange,
  sendCC,
  sendNRPN,
  onControlChange,
  onNRPNScoped,
  onSysEx,
  getMidiStatus,
  logMidiStatus,
  onDevicesChanged,
} from './midiService';
import { isPreenFM3Device } from './midiDevices';

import type { NRPNMessage } from './preenFM3MidiMap';

// LocalStorage keys for MIDI preferences
const STORAGE_KEYS = {
  INPUT_ID: 'preenFM3_midi_input_id',
  OUTPUT_ID: 'preenFM3_midi_output_id',
  FORWARD_INPUT_ID: 'preenFM3_midi_forward_input_id',
  CHANNEL: 'preenFM3_midi_channel',
} as const;

/**
 * Save MIDI preferences to localStorage
 */
function saveMidiPreferences(
  inputId: string | null,
  outputId: string | null,
  channel: number,
  forwardInputId: string | null,
) {
  try {
    console.log('💾 Sauvegarde préférences MIDI:', { inputId, outputId, channel, forwardInputId });
    
    // Sauvegarder ou supprimer l'input ID
    if (inputId) {
      localStorage.setItem(STORAGE_KEYS.INPUT_ID, inputId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.INPUT_ID);
    }
    
    // Sauvegarder ou supprimer l'output ID
    if (outputId) {
      localStorage.setItem(STORAGE_KEYS.OUTPUT_ID, outputId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.OUTPUT_ID);
    }

    if (forwardInputId) {
      localStorage.setItem(STORAGE_KEYS.FORWARD_INPUT_ID, forwardInputId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.FORWARD_INPUT_ID);
    }
    
    // Le canal est toujours sauvegardé
    localStorage.setItem(STORAGE_KEYS.CHANNEL, channel.toString());
  } catch (error) {
    console.warn('Failed to save MIDI preferences:', error);
  }
}

/**
 * Load MIDI preferences from localStorage
 */
function loadMidiPreferences(): {
  inputId: string | null;
  outputId: string | null;
  forwardInputId: string | null;
  channel: number;
} {
  try {
    return {
      inputId: localStorage.getItem(STORAGE_KEYS.INPUT_ID),
      outputId: localStorage.getItem(STORAGE_KEYS.OUTPUT_ID),
      forwardInputId: localStorage.getItem(STORAGE_KEYS.FORWARD_INPUT_ID),
      channel: parseInt(localStorage.getItem(STORAGE_KEYS.CHANNEL) || '1', 10),
    };
  } catch (error) {
    console.warn('Failed to load MIDI preferences:', error);
    return { inputId: null, outputId: null, forwardInputId: null, channel: 1 };
  }
}

export interface MidiDevices {
  inputs: Input[];
  outputs: Output[];
}

export interface MidiState {
  enabled: boolean;
  devices: MidiDevices | null;
  selectedInput: Input | null;
  selectedOutput: Output | null;
  forwardInput: Input | null;
  channel: number;
  isLoading: boolean;
  error: string | null;
}

interface MidiStoreActions {
  _setLoading: (isLoading: boolean) => void;
  _setInitialized: (devices: MidiDevices, selectedInput: Input | null, selectedOutput: Output | null, channel: number, forwardInput?: Input | null) => void;
  _setError: (error: string) => void;
  _updateDevices: (devices: MidiDevices, selectedInput: Input | null, selectedOutput: Output | null, forwardInput?: Input | null) => void;
  selectInput: (input: Input | null) => void;
  selectOutput: (output: Output | null) => void;
  selectForwardInput: (input: Input | null) => void;
  changeChannel: (channel: number) => void;
}

type MidiStore = MidiState & MidiStoreActions;

/**
 * Global Zustand store for MIDI state — shared across all components
 */
export const useMidiStore = create<MidiStore>((set, get) => ({
  // Initial state
  enabled: false,
  devices: null,
  selectedInput: null,
  selectedOutput: null,
  forwardInput: null,
  channel: 1,
  isLoading: false,
  error: null,

  // Internal actions (used by the init effect)
  _setLoading: (isLoading) => set({ isLoading }),
  _setInitialized: (devices, selectedInput, selectedOutput, channel, forwardInput) =>
    set({ enabled: true, devices, selectedInput, selectedOutput, forwardInput: forwardInput ?? null, channel, isLoading: false }),
  _setError: (error) => set({ enabled: false, isLoading: false, error }),
  _updateDevices: (devices, selectedInput, selectedOutput, forwardInput) =>
    set((state) => ({
      devices,
      selectedInput: selectedInput ?? state.selectedInput,
      selectedOutput: selectedOutput ?? state.selectedOutput,
      forwardInput: forwardInput ?? state.forwardInput,
    })),

  // Public actions

  selectInput: (input) => {
    console.log('🎹 Sélection MIDI Input:', input?.name || 'None', input?.id || null);
    setMidiInput(input);
    const { channel, devices } = get();
    let { selectedOutput, forwardInput } = get();
    if (forwardInput && (forwardInput.id === input?.id || forwardInput.name === input?.name)) {
      setMidiForwardInput(null);
      forwardInput = null;
    }
    // Si aucune sortie n'est sélectionnée, essayer d'en trouver une avec le même nom ou id
    if (!selectedOutput && input && devices) {
      const match = devices.outputs.find(
        o => o.id === input.id || o.name === input.name
      );
      if (match) {
        setMidiOutput(match);
        selectedOutput = match;
      }
    }
    saveMidiPreferences(input?.id || null, selectedOutput?.id || null, channel, forwardInput?.id || null);
    set({ selectedInput: input, selectedOutput, forwardInput });
  },

  selectOutput: (output) => {
    console.log('🎹 Sélection MIDI Output:', output?.name || 'None', output?.id || null);
    setMidiOutput(output);
    const { channel, devices, forwardInput } = get();
    let { selectedInput } = get();
    // Si aucune entrée n'est sélectionnée, essayer d'en trouver une avec le même nom ou id
    if (!selectedInput && output && devices) {
      const match = devices.inputs.find(
        i => i.id === output.id || i.name === output.name
      );
      if (match) {
        setMidiInput(match);
        selectedInput = match;
      }
    }
    saveMidiPreferences(selectedInput?.id || null, output?.id || null, channel, forwardInput?.id || null);
    set({ selectedOutput: output, selectedInput });
  },

  selectForwardInput: (input) => {
    const { selectedInput, selectedOutput, channel } = get();
    const next = input && (isPreenFM3Device(input.name) || input.id === selectedInput?.id)
      ? null
      : input;
    setMidiForwardInput(next);
    saveMidiPreferences(selectedInput?.id || null, selectedOutput?.id || null, channel, next?.id || null);
    set({ forwardInput: next });
  },

  changeChannel: (channel) => {
    setMidiChannel(channel);
    const { selectedInput, selectedOutput, forwardInput } = get();
    saveMidiPreferences(selectedInput?.id || null, selectedOutput?.id || null, channel, forwardInput?.id || null);
    set({ channel });
  },
}));

/** Flag to ensure the async init runs only once across all hook instances */
let _midiInitStarted = false;

/**
 * Hook to manage MIDI connection and communication with PreenFM3.
 * The underlying state lives in a Zustand store so every consumer sees the same values.
 */
export function usePreenFM3Midi() {
  const state = useMidiStore();

  // Initialize MIDI once (first mount of any consumer)
  useEffect(() => {
    if (_midiInitStarted) return;
    _midiInitStarted = true;

    const init = async () => {
      useMidiStore.getState()._setLoading(true);
      
      try {
        const devices = await initializeMidi();
        
        // Load saved preferences
        const prefs = loadMidiPreferences();
        console.log('🎹 Restauration des préférences MIDI:', prefs);
        
        // Try to restore previously selected devices
        const savedInput = prefs.inputId
          ? devices.inputs.find(input => input.id === prefs.inputId)
          : null;
        const savedOutput = prefs.outputId
          ? devices.outputs.find(output => output.id === prefs.outputId)
          : null;
        const savedForwardInput = prefs.forwardInputId
          ? devices.inputs.find(input => input.id === prefs.forwardInputId)
          : null;

        const defaultInput = devices.inputs.find(input => isPreenFM3Device(input.name)) ?? null;
        const defaultOutput = devices.outputs.find(output => isPreenFM3Device(output.name)) ?? null;

        // Prefer saved devices; otherwise default to the PreenFM3 by name.
        const selectedInput = savedInput || defaultInput;
        const selectedOutput = savedOutput || defaultOutput;
        const selectedChannel = prefs.channel || 1;
        const forwardInput =
          savedForwardInput &&
          !isPreenFM3Device(savedForwardInput.name) &&
          savedForwardInput.id !== selectedInput?.id
            ? savedForwardInput
            : null;

        // Nettoyer localStorage si les périphériques ne sont plus disponibles
        if (prefs.inputId && !savedInput) {
          localStorage.removeItem(STORAGE_KEYS.INPUT_ID);
        }
        if (prefs.outputId && !savedOutput) {
          localStorage.removeItem(STORAGE_KEYS.OUTPUT_ID);
        }
        if (prefs.forwardInputId && !forwardInput) {
          localStorage.removeItem(STORAGE_KEYS.FORWARD_INPUT_ID);
        }

        if (selectedInput) {
          console.log('🎹 Restauration MIDI Input:', selectedInput.name, selectedInput.id);
          setMidiInput(selectedInput);
        }
        if (selectedOutput) {
          console.log('🎹 Restauration MIDI Output:', selectedOutput.name, selectedOutput.id);
          setMidiOutput(selectedOutput);
        }
        if (forwardInput) {
          setMidiForwardInput(forwardInput);
        }
        setMidiChannel(selectedChannel);

        useMidiStore.getState()._setInitialized(devices, selectedInput, selectedOutput, selectedChannel, forwardInput);
        
        // Ne sauvegarder que si on a des périphériques sélectionnés
        // Évite de sauvegarder null de manière non intentionnelle
        if (selectedInput || selectedOutput || forwardInput) {
          saveMidiPreferences(
            selectedInput?.id || null,
            selectedOutput?.id || null,
            selectedChannel,
            forwardInput?.id || null,
          );
        }

        // Listen for device hotplug events and auto-reconnect saved devices
        onDevicesChanged((newDevices) => {
          const prefs = loadMidiPreferences();
          const store = useMidiStore.getState();

          // Try to find the previously selected (or saved) input/output by id
          const currentInputId = store.selectedInput?.id || prefs.inputId;
          const currentOutputId = store.selectedOutput?.id || prefs.outputId;
          const currentForwardId = store.forwardInput?.id || prefs.forwardInputId;

          const newInput = currentInputId
            ? newDevices.inputs.find(i => i.id === currentInputId) ?? null
            : store.selectedInput ?? newDevices.inputs.find(i => isPreenFM3Device(i.name)) ?? null;
          const newOutput = currentOutputId
            ? newDevices.outputs.find(o => o.id === currentOutputId) ?? null
            : store.selectedOutput ?? newDevices.outputs.find(o => isPreenFM3Device(o.name)) ?? null;
          const forwardCandidate = currentForwardId
            ? newDevices.inputs.find(i => i.id === currentForwardId) ?? null
            : store.forwardInput;
          const newForward = forwardCandidate &&
            !isPreenFM3Device(forwardCandidate.name) &&
            forwardCandidate.id !== newInput?.id
              ? forwardCandidate
              : null;

          if (newInput && newInput !== store.selectedInput) {
            console.log('🔌 Auto-reconnexion MIDI Input:', newInput.name);
            setMidiInput(newInput);
          } else if (!newInput && store.selectedInput) {
            // Device was disconnected
            setMidiInput(null);
          }

          if (newOutput && newOutput !== store.selectedOutput) {
            console.log('🔌 Auto-reconnexion MIDI Output:', newOutput.name);
            setMidiOutput(newOutput);
          } else if (!newOutput && store.selectedOutput) {
            setMidiOutput(null);
          }

          if (newForward !== store.forwardInput) {
            setMidiForwardInput(newForward);
          }

          saveMidiPreferences(
            newInput?.id || null,
            newOutput?.id || null,
            store.channel,
            newForward?.id || null,
          );

          useMidiStore.getState()._updateDevices(
            newDevices,
            newInput,
            newOutput,
            newForward,
          );
        });
        
      } catch (err) {
        useMidiStore.getState()._setError(
          err instanceof Error ? err.message : 'Failed to initialize MIDI'
        );
      }
    };

    init();
  }, []);

  // Listen to CC changes from PreenFM3
  const listenToCC = useCallback((callback: (controller: number, value: number, channel: number) => void) => {
    onControlChange(callback);
  }, []);


  // Listen to NRPN changes from PreenFM3
  const listenToNRPN = useCallback((callback: (nrpn: NRPNMessage, channel: number) => void) => {
    return onNRPNScoped(callback);
  }, []);

  // Listen to SysEx messages
  const listenToSysEx = useCallback((callback: (data: Uint8Array) => void) => {
    onSysEx(callback);
  }, []);

  return {
    // State
    ...state,

    // Send functions (use current channel from store)
    sendAlgorithmChange: useCallback((algoId: number | string) => 
      sendAlgorithmChange(algoId, useMidiStore.getState().channel), []),
    sendIMChange: useCallback((imNumber: number, value: number) => 
      sendIMChange(imNumber, value, useMidiStore.getState().channel), []),
    sendCC: useCallback((controller: number, value: number) => 
      sendCC(controller, value, useMidiStore.getState().channel), []),
    sendNRPN: useCallback((nrpn: NRPNMessage) => 
      sendNRPN(nrpn, useMidiStore.getState().channel), []),

    // Listen functions
    listenToCC,
    listenToNRPN,
    listenToSysEx,

    // Utility
    getStatus: getMidiStatus,
    logStatus: logMidiStatus,
  };
}

/**
 * Hook to sync patch parameter changes to PreenFM3 via MIDI
 */
export function usePatchMidiSync(enabled: boolean = false) {
  const midi = usePreenFM3Midi();

  // Sync algorithm changes
  const syncAlgorithm = useCallback((algoId: string | number) => {
    if (enabled && midi.enabled && midi.selectedOutput) {
      midi.sendAlgorithmChange(typeof algoId === 'string' ? parseInt(algoId.replace('alg', '')) - 1 : algoId);
    }
  }, [enabled, midi]);

  // Sync modulation index changes
  const syncModulationIndex = useCallback((sourceId: number, targetId: number, value: number) => {
    if (enabled && midi.enabled && midi.selectedOutput) {
      // Calculate IM number based on source and target
      // This is a simplified mapping - actual mapping depends on algorithm
      const imNumber = (sourceId - 1) * 4 + targetId; // Placeholder logic
      midi.sendIMChange(imNumber, value);
    }
  }, [enabled, midi]);

  return {
    midi,
    syncAlgorithm,
    syncModulationIndex,
  };
}
