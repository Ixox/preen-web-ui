/**
 * Types pour les sources de modulation du PreenFM3
 * - LFO Envelopes (2): Enveloppes ADSR qui modulent les LFOs
 * - Step Sequencers (2): Séquenceurs de pas pour modulation rythmique
 */

import { AdsrState } from './adsr';
import {
  type CurveType,
  type StepSeqMidiClockMode,
  STEP_SEQ_MIDI_CLOCK_MODES,
  type StepSeqSyncMode,
  STEP_SEQ_NOTE_SYNC_BPM,
  nrpnToStepSeqSync,
  stepSeqSyncToNrpnBpm,
  type StepSeqStepMode,
  STEP_SEQ_STEP_MODES,
  STEP_SEQ_STEP_MODE_LABELS,
  STEP_SEQ_MODE_TO_NRPN,
  nrpnToStepSeqMode,
  stepSeqModeToNrpn,
} from '../midi/preenFmConstants';
export {
  type StepSeqMidiClockMode,
  STEP_SEQ_MIDI_CLOCK_MODES,
  type StepSeqSyncMode,
  STEP_SEQ_NOTE_SYNC_BPM,
  nrpnToStepSeqSync,
  stepSeqSyncToNrpnBpm,
  type StepSeqStepMode,
  STEP_SEQ_STEP_MODES,
  STEP_SEQ_STEP_MODE_LABELS,
  STEP_SEQ_MODE_TO_NRPN,
  nrpnToStepSeqMode,
  stepSeqModeToNrpn,
};

/**
 * Mode de boucle pour LFO Envelope
 */
export type LfoEnvLoopMode = 'Off' | 'Silence' | 'Attack';

/**
 * LFO Envelope
 * Enveloppe ADSR qui peut moduler les LFOs et autres paramètres
 */
export interface LFOEnvelope {
  adsr: AdsrState;           // Enveloppe ADSR classique
  loopMode: LfoEnvLoopMode;  // Mode de boucle
  silence: number;           // Paramètre silence (pour Env2) (0-100)
  attackCurve?: CurveType;   // Courbe d'attaque (NRPN 280 / 282)
  releaseCurve?: CurveType;  // Courbe de release (NRPN 281 / 283)
}

/**
 * Mode de synchronisation pour Step Sequencer
 * - 'Int': BPM interne (10-240)
 * - 'Ext': MIDI Clock (241-245: Ck/4..Ck*4)
 * - 'Note': Avance d'un pas à chaque NoteOn (246)
 */

/**
 * Step Sequencer
 * Séquenceur de pas avec 16 étapes (PreenFM3 firmware structure)
 */
export interface StepSequencer {
  steps: number[];              // 16 valeurs (0-100)
  stepModes?: StepSeqStepMode[]; // 16 modes (Norm, Gld1-3, Mute, Pass, Rset) (NRPN MSB=5/6, LSB=0-15)
  loopLength?: number;          // 0-16 (NRPN MSB=5/6, LSB=16)
  gate: number;                 // Gate global (0-1, 0-100%)
  syncMode: StepSeqSyncMode;    // Synchronisation interne ou externe (MIDI Clock)
  bpm: number;                  // Tempo (10-240) - utilisé si syncMode = 'Int'
  midiClockMode: StepSeqMidiClockMode;  // Mode MIDI Clock - utilisé si syncMode = 'Ext'
}

/**
 * Valeurs par défaut pour LFO Envelope
 */
export const DEFAULT_LFO_ENVELOPE: LFOEnvelope = {
  adsr: {
    attack: { time: 0, level: 0 },
    decay: { time: 1, level: 100 },
    sustain: { time: 5, level: 30 },
    release: { time: 10, level: 0 }
  },
  loopMode: 'Off',
  silence: 0,
  attackCurve: 'linear',
  releaseCurve: 'linear',
};

/**
 * Valeurs par défaut pour Step Sequencer
 */
export const DEFAULT_STEP_SEQUENCER: StepSequencer = {
  steps: Array(16).fill(50),      // Toutes les valeurs à 50
  stepModes: Array(16).fill('Norm'), // Tous les modes à Norm
  loopLength: 16,                 // Longueur de boucle par défaut (16 pas)
  gate: 0.5,                      // Gate à 50%
  syncMode: 'Int',                // Synchronisation interne par défaut
  bpm: 120,                       // 120 BPM par défaut
  midiClockMode: 'Ck/4',          // MIDI Clock / 4 par défaut (noires)
};
