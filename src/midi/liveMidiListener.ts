import { useEffect } from 'react';
import type { Input } from 'webmidi';
import {
  PREENFM3_CC,
  ARP_CLOCKS,
  ARP_DIRECTIONS,
  ARP_PATTERNS,
  ARP_DIVISIONS,
  ARP_DURATIONS,
  ARP_LATCH,
  FILTER1_TYPE_LIST,
  FILTER2_TYPE_LIST,
  MATRIX_SOURCE_NAMES,
  MATRIX_DEST_NAMES,
  STEP_SEQ_STEP_MODES,
  nrpnToCurveType,
  nrpnToStepSeqSync,
  arpStepStateToValue,
  nrpnToArpStepAction,
  type NRPNMessage,
} from './preenFmConstants';
import {
  DEFAULT_ALGORITHMS,
  DEFAULT_LFO,
  DEFAULT_LFO_ENVELOPE,
  DEFAULT_STEP_SEQUENCER,
  DEFAULT_ARPEGGIATOR,
  NoteCurveUtils,
  createDefaultArpUserPattern,
  type Patch,
  type ArpUserPatternKey,
} from '../types/patch';
import { WAVEFORMS } from '../types/waveform';
import { parseLfoShape, nrpnToLfoFrequency, parseLfoBias, parseLfoKeysync } from '../types/lfo';
import { ALGO_DIAGRAMS } from '../algo/algorithms.static';
import { onNRPNScoped, onControlChangeScoped, runWithoutMidiOutput } from './midiService';
import { parseCapabilityNRPN } from './capabilities';
import { usePatchStore } from '../stores/patchStore';
import { useSynthStore } from '../stores/synthStore';

function ensureLfos(patch: Patch) {
  if (!patch.lfos) {
    patch.lfos = [{ ...DEFAULT_LFO }, { ...DEFAULT_LFO }, { ...DEFAULT_LFO }];
  }
}

function ensureLfoEnvelopes(patch: Patch) {
  if (!patch.lfoEnvelopes) {
    patch.lfoEnvelopes = [
      { ...DEFAULT_LFO_ENVELOPE, adsr: { ...DEFAULT_LFO_ENVELOPE.adsr } },
      { ...DEFAULT_LFO_ENVELOPE, adsr: { ...DEFAULT_LFO_ENVELOPE.adsr } },
    ];
  }
}

function ensureStepSequencers(patch: Patch) {
  if (!patch.stepSequencers) {
    patch.stepSequencers = [
      { ...DEFAULT_STEP_SEQUENCER, steps: [...DEFAULT_STEP_SEQUENCER.steps], stepModes: [...(DEFAULT_STEP_SEQUENCER.stepModes ?? Array(16).fill('Norm'))] },
      { ...DEFAULT_STEP_SEQUENCER, steps: [...DEFAULT_STEP_SEQUENCER.steps], stepModes: [...(DEFAULT_STEP_SEQUENCER.stepModes ?? Array(16).fill('Norm'))] },
    ];
  }
}

function ensureUserPattern(patch: Patch, key: ArpUserPatternKey) {
  if (!patch.arpeggiator) {
    patch.arpeggiator = { ...DEFAULT_ARPEGGIATOR };
  }
  if (!patch.arpeggiator.userPatterns) {
    patch.arpeggiator.userPatterns = {};
  }
  if (!patch.arpeggiator.userPatterns[key]) {
    patch.arpeggiator.userPatterns[key] = createDefaultArpUserPattern();
  }
  return patch.arpeggiator.userPatterns[key]!;
}

function applyIMUpdate(patch: Patch, imIndex: number, isFeedback: boolean, isVelo: boolean, value: number): boolean {
  const diagram = ALGO_DIAGRAMS.find((d) => d.id === patch.algorithm.id);
  if (!diagram) return false;
  let currentIm = 0;
  for (const edge of diagram.edges) {
    const src = parseInt(edge.from.replace(/\D/g, ''), 10);
    const tgt = parseInt(edge.to.replace(/\D/g, ''), 10);
    const edgeFb = src === tgt;
    if ((isFeedback && edgeFb) || (!isFeedback && !edgeFb && currentIm === imIndex)) {
      const srcOp = patch.operators.find((o) => o.id === src);
      if (!srcOp) return false;
      if (isFeedback) {
        if (!isVelo) srcOp.feedbackAmount = value;
      } else {
        const link = srcOp.target.find((t) => t.id === tgt);
        if (!link) return false;
        if (isVelo) link.modulationIndexVelo = value;
        else link.im = value;
      }
      return true;
    }
    if (!edgeFb) currentIm++;
  }
  return false;
}

function findOperatorForMixPan(patch: Patch, slotIndex: number) {
  const carriers = patch.algorithm.ops.filter((op) => op.type === 'CARRIER');
  if (slotIndex < carriers.length) {
    return patch.operators.find((o) => o.id === carriers[slotIndex].id);
  }
  return patch.operators.find((o) => o.id === slotIndex + 1 && o.type !== 'CARRIER');
}

/**
 * Apply a single incoming NRPN message to `patch` (in-place inside Immer draft).
 * Returns true if the NRPN mapped to a known parameter.
 */
export function applyIncomingNRPN(patch: Patch, nrpn: NRPNMessage): boolean {
  const { paramMSB: msb, paramLSB: lsb } = nrpn;
  const raw = (nrpn.valueMSB << 7) | nrpn.valueLSB;

  // Step Sequencers 1 & 2 step values: MSB 2/3, LSB 0..15
  if ((msb === 2 || msb === 3) && lsb >= 0 && lsb < 16) {
    ensureStepSequencers(patch);
    patch.stepSequencers![msb - 2].steps[lsb] = Math.round((Math.max(0, Math.min(15, raw)) * 100) / 15);
    return true;
  }

  // Step Sequencers 1 & 2 modes & loopLength: MSB 5/6, LSB 0..16
  if ((msb === 5 || msb === 6) && lsb >= 0 && lsb <= 16) {
    ensureStepSequencers(patch);
    const seq = patch.stepSequencers![msb - 5];
    if (lsb < 16) {
      if (!seq.stepModes || seq.stepModes.length !== 16) {
        seq.stepModes = Array(16).fill('Norm');
      }
      seq.stepModes[lsb] = STEP_SEQ_STEP_MODES[raw] ?? 'Norm';
    } else {
      seq.loopLength = raw === 0 ? 16 : Math.max(1, Math.min(16, raw));
    }
    return true;
  }

  // Arp User Patterns Usr1..Usr4 steps: MSB 7..10, LSB 0..31
  if (msb >= 7 && msb <= 10 && lsb >= 0 && lsb < 32) {
    const keys: ArpUserPatternKey[] = ['Usr1', 'Usr2', 'Usr3', 'Usr4'];
    const pat = ensureUserPattern(patch, keys[msb - 7]);
    if (lsb < 16) {
      if (raw <= 0) {
        pat.modes[lsb] = 'Off';
        pat.steps[lsb] = 0;
      } else {
        if (pat.modes[lsb] === 'Off') pat.modes[lsb] = 'Norm';
        pat.steps[lsb] = arpStepStateToValue(raw);
      }
    } else {
      pat.modes[lsb - 16] = nrpnToArpStepAction(raw);
    }
    return true;
  }

  // Timbre, Master FX & Arp Seed/Len: MSB 4, LSB 0..8
  if (msb === 4) {
    switch (lsb) {
      case 0:
        patch.global.reverbDryWet = Math.max(0, Math.min(1, raw / 100));
        return true;
      case 1:
        patch.global.dynamics = Math.max(0, Math.min(6, raw));
        return true;
      case 2:
        patch.global.mfxReturn = Math.max(0, Math.min(1, raw / 100));
        return true;
      case 3:
        patch.global.mfxPreset = Math.max(0, Math.min(18, raw));
        return true;
      case 4:
        patch.arpeggiator.euclideanSeed = Math.max(0, Math.min(15, raw));
        return true;
      case 5:
      case 6:
      case 7:
      case 8: {
        const keys: ArpUserPatternKey[] = ['Usr1', 'Usr2', 'Usr3', 'Usr4'];
        const pat = ensureUserPattern(patch, keys[lsb - 5]);
        pat.length = Math.max(1, Math.min(16, raw));
        return true;
      }
      default:
        return false;
    }
  }

  // MSB 2 extra parameters (Phase/Warp OP3..6, Voice Priority, Env Curves)
  if (msb === 2) {
    if (lsb >= 0 && lsb <= 15) {
      // OP3..OP6 phase (even) & warp (odd)
      const opIndex = 2 + Math.floor(lsb / 4); // OP3=idx2..OP6=idx5
      const op = patch.operators[opIndex];
      if (!op) return false;
      const offset = lsb % 4;
      if (offset === 0) {
        op.phase = raw / 360;
        return true;
      }
      if (offset === 1) {
        op.warp = (raw - 400) / 100;
        return true;
      }
      return false;
    }
    if (lsb === 20) {
      patch.global.voicePriority = Math.max(0, Math.min(4, raw));
      return true;
    }
    if (lsb >= 24 && lsb <= 27) {
      ensureLfoEnvelopes(patch);
      const envIdx = lsb < 26 ? 0 : 1;
      const isAtk = lsb % 2 === 0;
      const curve = nrpnToCurveType(raw, 'linear');
      if (isAtk) patch.lfoEnvelopes![envIdx].attackCurve = curve;
      else patch.lfoEnvelopes![envIdx].releaseCurve = curve;
      return true;
    }
    if (lsb >= 44 && lsb <= 67) {
      const idx = lsb - 44;
      const op = patch.operators[Math.floor(idx / 4)];
      if (!op) return false;
      const seg = idx % 4;
      if (!op.adsr.curves) {
        op.adsr.curves = { attack: 'linear', decay: 'exponential', sustain: 'linear', release: 'exponential' };
      }
      const curve = nrpnToCurveType(raw, seg === 1 || seg === 3 ? 'exponential' : 'linear');
      if (seg === 0) op.adsr.curves.attack = curve;
      else if (seg === 1) op.adsr.curves.decay = curve;
      else if (seg === 2) op.adsr.curves.sustain = curve;
      else op.adsr.curves.release = curve;
      return true;
    }
    return false;
  }

  // MSB 0 & MSB 1 standard OneSynthParams
  if (msb === 0) {
    if (lsb === 0) {
      const algo = DEFAULT_ALGORITHMS[raw];
      if (algo) patch.algorithm = algo;
      return true;
    }
    if (lsb === 1) { patch.global.velocitySensitivity = raw; return true; }
    if (lsb === 2) { patch.global.playMode = Math.max(0, Math.min(2, raw)); return true; }
    if (lsb === 3) { patch.global.glideTime = raw; return true; }

    // IM1..IM6 (4..15)
    if (lsb >= 4 && lsb <= 15) {
      const imIdx = Math.floor((lsb - 4) / 2);
      const isVelo = (lsb - 4) % 2 === 1;
      const isFb = imIdx === 5;
      return applyIMUpdate(patch, imIdx, isFb, isVelo, raw / 100);
    }

    // Mix & Pan (16..27)
    if (lsb >= 16 && lsb <= 27) {
      const slot = Math.floor((lsb - 16) / 2);
      const isPan = (lsb - 16) % 2 === 1;
      const op = findOperatorForMixPan(patch, slot);
      if (!op) return false;
      if (isPan) op.pan = (raw - 100) / 100;
      else op.amplitude = Math.max(0, Math.min(1, raw / 100));
      return true;
    }

    // Arpeggiator (28..35)
    if (lsb >= 28 && lsb <= 35) {
      const arp = patch.arpeggiator;
      switch (lsb) {
        case 28: arp.clockSource = ARP_CLOCKS[raw] ?? arp.clockSource; return true;
        case 29: arp.clock = Math.max(10, Math.min(240, raw)); return true;
        case 30: arp.direction = ARP_DIRECTIONS[raw] ?? arp.direction; return true;
        case 31: arp.octave = Math.max(1, Math.min(3, raw)); return true;
        case 32: arp.pattern = ARP_PATTERNS[raw] ?? arp.pattern; return true;
        case 33: arp.division = ARP_DIVISIONS[raw] ?? arp.division; return true;
        case 34: arp.duration = ARP_DURATIONS[raw] ?? arp.duration; return true;
        case 35: arp.latch = ARP_LATCH[raw] ?? arp.latch; return true;
      }
    }

    // Filter 1 (40..43) — Filter 2 is on MSB=1, LSB=116..119
    if (lsb >= 40 && lsb <= 43) {
      const col = lsb - 40;
      const filter = patch.filters[0];
      if (!filter) return false;
      if (col === 0) {
        filter.type = FILTER1_TYPE_LIST[raw] ?? filter.type;
      } else if (col === 1) filter.param1 = raw / 100;
      else if (col === 2) filter.param2 = raw / 100;
      else filter.gain = raw / 100;
      return true;
    }

    // Osc1..6 (44..67: 44 + opIdx * 4 + col)
    if (lsb >= 44 && lsb <= 67) {
      const opIndex = Math.floor((lsb - 44) / 4);
      const op = patch.operators.find((o) => o.id === opIndex + 1) ?? patch.operators[opIndex];
      if (!op) return false;
      const col = (lsb - 44) % 4;
      if (col === 0) {
        op.waveform = WAVEFORMS.find((w) => w.id === raw)?.name ?? op.waveform;
      } else if (col === 1) {
        // Firmware: 0=Keyboard, 1=Fixed, 2=Finetune -> UI: 1=Keyboard, 0=Fixed, 2=Finetune
        op.keyboardTracking = raw === 0 ? 1 : raw === 1 ? 0 : 2;
        op.frequencyType = raw === 1 ? 'FIXED' : 'KEYBOARD';
      } else if (col === 2) {
        op.frequency = raw / 100;
      } else {
        op.detune = (raw - 900) / 100;
      }
      return true;
    }

    // Env1..6 (68..115: 68 + opIdx * 8 + col)
    if (lsb >= 68 && lsb <= 115) {
      const rel = lsb - 68;
      const envIdx = Math.floor(rel / 8);
      const col = rel % 8;
      const op = patch.operators.find((o) => o.id === envIdx + 1) ?? patch.operators[envIdx];
      if (!op) return false;
      const val = raw / 100;
      const atkRel = op.adsr.attack.time;
      const decRel = Math.max(0, op.adsr.decay.time - op.adsr.attack.time);
      const susRel = Math.max(0, op.adsr.sustain.time - op.adsr.decay.time);
      const relRel = Math.max(0, op.adsr.release.time - op.adsr.sustain.time);
      switch (col) {
        case 0:
          op.adsr.attack.time = val;
          op.adsr.decay.time = val + decRel;
          op.adsr.sustain.time = val + decRel + susRel;
          op.adsr.release.time = val + decRel + susRel + relRel;
          return true;
        case 1: op.adsr.attack.level = raw; return true;
        case 2:
          op.adsr.decay.time = atkRel + val;
          op.adsr.sustain.time = atkRel + val + susRel;
          op.adsr.release.time = atkRel + val + susRel + relRel;
          return true;
        case 3: op.adsr.decay.level = raw; return true;
        case 4:
          op.adsr.sustain.time = atkRel + decRel + val;
          op.adsr.release.time = atkRel + decRel + val + relRel;
          return true;
        case 5: op.adsr.sustain.level = raw; return true;
        case 6:
          op.adsr.release.time = atkRel + decRel + susRel + val;
          return true;
        case 7: op.adsr.release.level = raw; return true;
      }
    }

    // Matrix rows 0..2 (116..127)
    if (lsb >= 116 && lsb <= 127) {
      const row = Math.floor((lsb - 116) / 4);
      const col = (lsb - 116) % 4;
      const entry = patch.modulationMatrix[row];
      if (!entry) return false;
      if (col === 0) entry.source = MATRIX_SOURCE_NAMES[raw] ?? entry.source;
      else if (col === 1) entry.amount = (raw - 1000) / 100;
      else if (col === 2) entry.destination1 = MATRIX_DEST_NAMES[raw] ?? entry.destination1;
      else entry.destination2 = MATRIX_DEST_NAMES[raw] ?? entry.destination2;
      return true;
    }
    return false;
  }

  if (msb === 1) {
    // Matrix rows 3..11 (0..35)
    if (lsb >= 0 && lsb <= 35) {
      const row = 3 + Math.floor(lsb / 4);
      const col = lsb % 4;
      const entry = patch.modulationMatrix[row];
      if (!entry) return false;
      if (col === 0) entry.source = MATRIX_SOURCE_NAMES[raw] ?? entry.source;
      else if (col === 1) entry.amount = (raw - 1000) / 100;
      else if (col === 2) entry.destination1 = MATRIX_DEST_NAMES[raw] ?? entry.destination1;
      else entry.destination2 = MATRIX_DEST_NAMES[raw] ?? entry.destination2;
      return true;
    }

    // LFO 1..3 (40..51)
    if (lsb >= 40 && lsb <= 51) {
      ensureLfos(patch);
      const lfoIdx = Math.floor((lsb - 40) / 4);
      const col = (lsb - 40) % 4;
      const lfo = patch.lfos![lfoIdx];
      if (!lfo) return false;
      if (col === 0) lfo.shape = parseLfoShape(raw);
      else if (col === 1) {
        const decoded = nrpnToLfoFrequency(raw);
        if (typeof decoded === 'number') {
          lfo.syncMode = 'Int';
          lfo.frequency = decoded;
        } else {
          lfo.syncMode = 'Ext';
          lfo.midiClockMode = decoded;
        }
      } else if (col === 2) lfo.bias = parseLfoBias(raw);
      else lfo.keysync = parseLfoKeysync(raw);
      return true;
    }

    // LFO Env1 (52..55) & Env2 (56..59)
    if (lsb >= 52 && lsb <= 55) {
      ensureLfoEnvelopes(patch);
      const env1 = patch.lfoEnvelopes![0];
      const val = raw / 100;
      if (lsb === 52) env1.adsr.attack.time = val;
      else if (lsb === 53) env1.adsr.decay.time = val;
      else if (lsb === 54) env1.adsr.sustain.time = val;
      else env1.adsr.release.time = val;
      return true;
    }
    if (lsb >= 56 && lsb <= 59) {
      ensureLfoEnvelopes(patch);
      const env2 = patch.lfoEnvelopes![1];
      if (lsb === 56) env2.silence = raw / 100;
      else if (lsb === 57) env2.adsr.attack.time = raw / 100;
      else if (lsb === 58) env2.adsr.decay.time = raw / 100;
      else env2.loopMode = (['Off', 'Silence', 'Attack'] as const)[raw] ?? 'Off';
      return true;
    }

    // StepSeq 1 & 2 BPM / Gate (60..64)
    if (lsb === 60 || lsb === 61 || lsb === 62 || lsb === 64) {
      ensureStepSequencers(patch);
      const seqIdx = lsb <= 61 ? 0 : 1;
      const seq = patch.stepSequencers![seqIdx];
      if (lsb === 61 || lsb === 62) {
        seq.gate = raw / 100;
      } else {
        const sync = nrpnToStepSeqSync(raw);
        seq.syncMode = sync.syncMode;
        seq.bpm = sync.bpm;
        seq.midiClockMode = sync.midiClockMode;
      }
      return true;
    }

    // LFO Phases (68..70)
    if (lsb >= 68 && lsb <= 70) {
      ensureLfos(patch);
      patch.lfos![lsb - 68].phase = raw / 100;
      return true;
    }

    // Note Curves (72..79)
    if (lsb >= 72 && lsb <= 79) {
      const curveIdx = lsb < 76 ? 0 : 1;
      const col = (lsb - 72) % 4;
      const curve = patch.noteCurves[curveIdx];
      if (!curve) return false;
      if (col === 0) curve.before = NoteCurveUtils.fromNrpnIndex(raw);
      else if (col === 1) curve.breakNote = raw;
      else if (col === 2) curve.after = NoteCurveUtils.fromNrpnIndex(raw);
      return true;
    }

    // Filter 2 (MSB=1, LSB=116..119)
    if (lsb >= 116 && lsb <= 119) {
      const col = lsb - 116;
      const filter2 = patch.filters[1];
      if (!filter2) return false;
      if (col === 0) filter2.type = FILTER2_TYPE_LIST[raw] ?? filter2.type;
      else if (col === 1) filter2.param1 = raw / 100;
      else if (col === 2) filter2.param2 = raw / 100;
      else filter2.gain = raw / 100;
      return true;
    }

    // OP1..OP2 phase/warp (120..127)
    if (lsb >= 120 && lsb <= 127) {
      const opIdx = Math.floor((lsb - 120) / 4);
      const op = patch.operators[opIdx];
      if (!op) return false;
      const offset = (lsb - 120) % 4;
      if (offset === 0) { op.phase = raw / 360; return true; }
      if (offset === 1) { op.warp = (raw - 400) / 100; return true; }
      return false;
    }
  }

  return false;
}

/**
 * Apply a single incoming standard CC message (raw 0-127) to `patch`.
 * Ignores NRPN/RPN transport CCs (6, 38, 96, 97, 98, 99).
 */
export function applyIncomingCC(patch: Patch, controller: number, raw: number): boolean {
  // Never treat NRPN transport CCs as standalone parameters
  if (controller === 6 || controller === 38 || controller === 98 || controller === 99) {
    return false;
  }

  // IM1..IM5 (CC 17..21, 0..100 -> 0.0..10.0) & Feedback (CC 30, 0..127 -> 0..1.0)
  if (controller >= PREENFM3_CC.IM1 && controller <= PREENFM3_CC.IM5) {
    return applyIMUpdate(patch, controller - PREENFM3_CC.IM1, false, false, raw * 0.1);
  }
  if (controller === PREENFM3_CC.IM_FEEDBACK) {
    return applyIMUpdate(patch, 5, true, false, raw / 127);
  }

  // Mix OP1..OP6
  const mixCCs: readonly number[] = [
    PREENFM3_CC.MIX1, PREENFM3_CC.MIX2, PREENFM3_CC.MIX3,
    PREENFM3_CC.MIX4, PREENFM3_CC.MIX5, PREENFM3_CC.MIX6,
  ];
  const mixIdx = mixCCs.indexOf(controller);
  if (mixIdx >= 0) {
    const op = findOperatorForMixPan(patch, mixIdx);
    if (!op) return false;
    op.amplitude = Math.max(0, Math.min(1, raw / 127));
    return true;
  }

  // Pan OP1..OP6
  const panCCs: readonly number[] = [
    PREENFM3_CC.PAN1, PREENFM3_CC.PAN2, PREENFM3_CC.PAN3,
    PREENFM3_CC.PAN4, PREENFM3_CC.PAN5, PREENFM3_CC.PAN6,
  ];
  const panIdx = panCCs.indexOf(controller);
  if (panIdx >= 0) {
    const op = findOperatorForMixPan(patch, panIdx);
    if (!op) return false;
    op.pan = Math.max(-1, Math.min(1, (raw - 64) / 63));
    return true;
  }

  // Warp OP1..OP6
  const warpCCs: readonly number[] = [
    PREENFM3_CC.OSC1_WARP, PREENFM3_CC.OSC2_WARP, PREENFM3_CC.OSC3_WARP,
    PREENFM3_CC.OSC4_WARP, PREENFM3_CC.OSC5_WARP, PREENFM3_CC.OSC6_WARP,
  ];
  const warpIdx = warpCCs.indexOf(controller);
  if (warpIdx >= 0) {
    const op = patch.operators[warpIdx];
    if (!op) return false;
    op.warp = Math.max(-4, Math.min(4, (raw - 64) / 16));
    return true;
  }

  // Global / Mixer / FX
  switch (controller) {
    case PREENFM3_CC.MIXER_VOLUME:
      patch.global.volume = Math.max(0, Math.min(1, raw / 127));
      return true;
    case PREENFM3_CC.MIXER_PAN:
      patch.global.pan = Math.max(-1, Math.min(1, (raw - 64) / 63));
      return true;
    case PREENFM3_CC.TIMBRE_DRYWET:
      patch.global.reverbDryWet = Math.max(0, Math.min(1, raw / 127));
      return true;
    case PREENFM3_CC.TIMBRE_DYNAMICS:
      patch.global.dynamics = raw < 7 ? raw : Math.round((raw / 127) * 6);
      return true;
    case PREENFM3_CC.ENGINE_DECIMATION:
      patch.global.decimation = Math.max(0, Math.min(20, raw));
      return true;
    case PREENFM3_CC.PLAY_MODE:
      patch.global.playMode = raw <= 2 ? raw : Math.min(2, Math.floor((raw * 3) / 128));
      return true;
    case PREENFM3_CC.MFX_RETURN:
      patch.global.mfxReturn = Math.max(0, Math.min(1, raw / 127));
      return true;
    case PREENFM3_CC.MFX_PRESET:
      patch.global.mfxPreset = Math.max(0, Math.min(18, raw));
      return true;
    case PREENFM3_CC.ARP_CLOCK:
      patch.arpeggiator.clockSource = ARP_CLOCKS[raw] ?? patch.arpeggiator.clockSource;
      return true;
    case PREENFM3_CC.ARP_DIRECTION:
      patch.arpeggiator.direction = ARP_DIRECTIONS[raw] ?? patch.arpeggiator.direction;
      return true;
    case PREENFM3_CC.ARP_OCTAVE:
      patch.arpeggiator.octave = Math.max(1, Math.min(3, raw));
      return true;
    case PREENFM3_CC.ARP_PATTERN:
      patch.arpeggiator.pattern = ARP_PATTERNS[raw] ?? patch.arpeggiator.pattern;
      return true;
    case PREENFM3_CC.ARP_DIVISION:
      patch.arpeggiator.division = ARP_DIVISIONS[raw] ?? patch.arpeggiator.division;
      return true;
    case PREENFM3_CC.ARP_DURATION:
      patch.arpeggiator.duration = ARP_DURATIONS[raw] ?? patch.arpeggiator.duration;
      return true;
    default:
      return false;
  }
}

/**
 * Permanent background MIDI input listener that updates `usePatchStore` in real time
 * when knobs/buttons are manipulated on the PreenFM3, without ever re-emitting MIDI.
 */
export function useLiveMidiListener(selectedInput: Input | null, activeChannel: number) {
  useEffect(() => {
    if (!selectedInput) return;

    console.log(`🎹 Live MIDI listener active on "${selectedInput.name}" (ch ${activeChannel})`);

    const unsubNRPN = onNRPNScoped((nrpn, channel) => {
      if (channel !== activeChannel) return;

      const capability = parseCapabilityNRPN(nrpn);
      if (capability) {
        useSynthStore.getState().mergeCapabilities(capability);
        return;
      }

      const { isPulling, isPushing } = usePatchStore.getState();
      if (isPulling || isPushing) return;

      const raw = (nrpn.valueMSB << 7) | nrpn.valueLSB;
      let applied = false;
      runWithoutMidiOutput(() => {
        usePatchStore.getState().applyIncomingPatchUpdate((patch) => {
          applied = applyIncomingNRPN(patch, nrpn);
        });
      });
      console.log(`🎛️ Live NRPN [${nrpn.paramMSB},${nrpn.paramLSB}] = ${raw} (ch ${channel}) → ${applied ? 'applied' : 'unmapped'}`);
    }, selectedInput);

    const unsubCC = onControlChangeScoped((controller, rawValue, channel) => {
      if (channel !== activeChannel) return;
      const { isPulling, isPushing } = usePatchStore.getState();
      if (isPulling || isPushing) return;

      // Skip NRPN transport CCs without noisy logs
      if (controller === 6 || controller === 38 || controller === 98 || controller === 99) {
        return;
      }

      let applied = false;
      runWithoutMidiOutput(() => {
        usePatchStore.getState().applyIncomingPatchUpdate((patch) => {
          applied = applyIncomingCC(patch, controller, rawValue);
        });
      });
      console.log(`🎛️ Live CC #${controller} = ${rawValue} (ch ${channel}) → ${applied ? 'applied' : 'unmapped'}`);
    }, selectedInput);

    return () => {
      unsubNRPN?.();
      unsubCC?.();
    };
  }, [selectedInput, activeChannel]);
}
