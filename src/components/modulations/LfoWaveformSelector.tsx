// Générateur pseudo-aléatoire déterministe (LCG)
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return (state / 4294967296) * 2 - 1; // [-1, 1]
  };
}
import React from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { LfoType, LFO_TYPES } from '../../types/lfo';
import { useThemeStore } from '../../theme/themeStore';
import { StyledSelect } from '../StyledSelect';
import { useLfoShapeMax } from '../../midi/useSynthCapabilities';

const SelectorContainer = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
`;

const WaveformVisualization = styled.div`
  flex: 1;
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 6px;
  padding: 0;
  min-height: 60px;
  display: flex;
  align-items: center;
`;

const WaveformCanvas = styled.svg`
  width: 100%;
  height: 50px;
`;

interface LfoWaveformSelectorProps {
  value: LfoType;
  onChange: (type: LfoType) => void;
  frequency?: number; // Hz, optionnel pour compatibilité
  keysync?: number; // 0 (off) to 16 (max fadein)
  phase?: number; // 0..1
}

const EXP_MINUS_6 = Math.exp(-6);
const EXP_MINUS_7 = Math.exp(-7);
const LOG_32 = Math.log(32);

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

const decayExpK6 = (x: number): number =>
  (Math.exp(-6 * x) - EXP_MINUS_6) / (1 - EXP_MINUS_6);

const decayLogA31 = (x: number): number =>
  Math.log(1 + 31 * (1 - x)) / LOG_32;

const buchlaWave = (p: number, shapeHold: number): number => {
  const shapeAttack = 0.05;
  if (p < shapeAttack) {
    return -1 + 2 * smoothstep(p / shapeAttack);
  }
  if (p < shapeAttack + shapeHold) {
    return 1;
  }
  const d = (p - shapeAttack - shapeHold) / (1 - shapeAttack - shapeHold);
  const norm = (Math.exp(-7 * d) - EXP_MINUS_7) / (1 - EXP_MINUS_7);
  const bump = 0.1 * Math.exp(-18 * d) * Math.sin(d * 3 * Math.PI * 2);
  return Math.max(-1, Math.min(1, norm * 2 - 1 + bump));
};

const USER_HARMONIC_ORDER: Partial<Record<LfoType, number>> = {
  LFO_USER1: 2,
  LFO_USER2: 3,
  LFO_USER3: 4,
  LFO_USER4: 5,
  LFO_USER5: 6,
  LFO_USER6: 7,
};

/**
 * Génère les points pour visualiser une forme d'onde LFO
 * Basé sur le firmware PreenFM3 LfoOsc.cpp
 */
const generateWaveformPath = (type: LfoType, frequency: number = 1, width: number = 200, height: number = 50, keysync?: number, phaseOffset: number = 0): string => {
  const points: number[] = [];
  const numPoints = 200;
  const centerY = height / 2;
  const amplitude = height * 0.4;
  // On affiche N cycles pour N Hz (limite à 1000 pour test)
  const cycles = Math.max(1, Math.min(1000, Math.round(frequency)));
  // Fade-in envelope: keysync 0 = instant, 16 = max fade (full width)
  // We'll use a linear fade-in for visualization
  let fadeLength = 0;
  if (keysync && keysync > 0) {
    // keysync 1..16, fade from 10% to 100% of the width
    fadeLength = width * (0.01 + 0.99 * (keysync / 8));
  }
  for (let i = 0; i < numPoints; i++) {
    const t = i / numPoints;
    // phaseOffset is 0..1, shift phase by this amount (in cycles)
    const phase = (t * cycles + phaseOffset) % cycles; // phase = 0..cycles
    const p = phase - Math.floor(phase); // normalized 0..1 within current cycle
    const x = t * width;
    // Fade-in envelope multiplier
    let fade = 1;
    if (fadeLength > 0) {
      fade = Math.min(1, x / fadeLength);
    }
    let y: number;
    switch (type) {
      case 'LFO_SIN':
        y = centerY - Math.sin(phase * Math.PI * 2) * amplitude * fade;
        break;
      case 'LFO_SAW':
        y = centerY - (-1 + 2 * p) * amplitude * fade;
        break;
      case 'LFO_SAW_DOWN':
        y = centerY - (1 - 2 * p) * amplitude * fade;
        break;
      case 'LFO_DECAY_EXP':
        y = centerY - (decayExpK6(p) * 2 - 1) * amplitude * fade;
        break;
      case 'LFO_DECAY_LOG':
        y = centerY - (decayLogA31(p) * 2 - 1) * amplitude * fade;
        break;
      case 'LFO_RISE_EXP':
        y = centerY - ((1 - decayExpK6(p)) * 2 - 1) * amplitude * fade;
        break;
      case 'LFO_RISE_LOG':
        y = centerY - ((1 - decayLogA31(p)) * 2 - 1) * amplitude * fade;
        break;
      case 'LFO_ATTACK_DECAY': {
        const val = p < 0.5
          ? -1 + 2 * smoothstep(p * 2)
          : 1 - 2 * smoothstep((p - 0.5) * 2);
        y = centerY - val * amplitude * fade;
        break;
      }
      case 'LFO_ATTACK_HOLD_DECAY': {
        const val = p < 0.25
          ? -1 + 2 * smoothstep(p * 4)
          : p < 0.5
            ? 1
            : 1 - 2 * smoothstep((p - 0.5) * 2);
        y = centerY - val * amplitude * fade;
        break;
      }
      case 'LFO_DECAY_S':
        y = centerY - (1 - 2 * smoothstep(p)) * amplitude * fade;
        break;
      case 'LFO_BUCHLA_PLONG':
        y = centerY - buchlaWave(p, 0.06) * amplitude * fade;
        break;
      case 'LFO_BUCHLA_PLONG2':
        y = centerY - buchlaWave(p, 0.12) * amplitude * fade;
        break;
      case 'LFO_SIN_SQUARE': {
        const s = Math.sin(p * Math.PI * 2);
        y = centerY - (s * s * 2 - 1) * amplitude * fade;
        break;
      }
      case 'LFO_SIN_ZERO':
        y = centerY - (p < 0.5 ? Math.sin(p * Math.PI * 2) : 0) * amplitude * fade;
        break;
      case 'LFO_SIN_POS':
        y = centerY - Math.abs(Math.sin(p * Math.PI * 2)) * amplitude * fade;
        break;
      case 'LFO_TRIANGLE': {
        const trianglePhase = (phase * 2) % 2;
        y = centerY - (trianglePhase < 1 ? trianglePhase : 2 - trianglePhase) * 2 * amplitude * fade + amplitude * fade;
        break;
      }
      case 'LFO_SQUARE':
        y = centerY - (Math.sin(phase * Math.PI * 2) >= 0 ? 1 : -1) * amplitude * fade;
        break;
      case 'LFO_RANDOM': {
        // Sample & Hold dépendant de la fréquence : 1 step par cycle, déterministe
        const steps = Math.max(1, Math.round(cycles));
        // Génère la séquence de steps pseudo-aléatoires une fois pour toute la courbe
        const prng = lcg(456321);
        const stepVals: number[] = [];
        for (let s = 0; s < steps; s++) {
          stepVals.push(prng());
        }
        const stepIndex = Math.floor(phase) % steps;
        const rand = stepVals[stepIndex];
        y = centerY - rand * amplitude * fade;
        break;
      }
      case 'LFO_BROWNIAN': {
        // Brownian S&H dépendant de la fréquence : 1 step par cycle, amorti, déterministe
        const steps = Math.max(1, Math.round(cycles));
        // Génère la séquence de steps pseudo-aléatoires une fois pour toute la courbe
        const prng = lcg(67890);
        const stepVals: number[] = [];
        let prev = 0;
        for (let s = 0; s < steps; s++) {
          const rand = prng();
          const val = rand * 0.5 + prev * 0.5;
          stepVals.push(val);
          prev = val;
        }
        const stepIndex = Math.floor(phase) % steps;
        const val = stepVals[stepIndex];
        y = centerY - val * amplitude * 2 * fade;
        break;
      }
      case 'LFO_WANDERING': {
        // Version interpolée de LFO_RANDOM : interpolation linéaire entre les steps S&H
        const steps = Math.max(1, Math.round(cycles));
        // Génère la séquence de steps pseudo-aléatoires une fois pour toute la courbe
        const prng = lcg(12345);
        const stepVals: number[] = [];
        for (let s = 0; s < steps; s++) {
          stepVals.push(prng());
        }
        // Interpolation linéaire entre deux steps
        const f = phase;
        const idx = Math.floor(f) % steps;
        const frac = f - Math.floor(f);
        const v0 = stepVals[idx];
        const v1 = stepVals[(idx + 1) % steps];
        const interp = v0 + (v1 - v0) * frac;
        y = centerY - interp * amplitude * fade;
        break;
      }
      case 'LFO_FLOW': {
        // Version interpolée de LFO_BROWNIAN : interpolation linéaire entre les steps brownien amortis
        const steps = Math.max(1, Math.round(cycles));
        // Génère la séquence brownienne amortie une fois pour toute la courbe
        const prng = lcg(654);
        const stepVals: number[] = [];
        let prev = 0;
        for (let s = 0; s < steps; s++) {
          const rand = prng();
          const val = rand * 0.5 + prev * 0.5;
          stepVals.push(val);
          prev = val;
        }
        // Interpolation linéaire entre deux steps
        const f = phase;
        const idx = Math.floor(f) % steps;
        const frac = f - Math.floor(f);
        const v0 = stepVals[idx];
        const v1 = stepVals[(idx + 1) % steps];
        const interp = v0 + (v1 - v0) * frac;
        y = centerY - interp * amplitude * 2 * fade;
        break;
      }
      default: {
        const harmonic = USER_HARMONIC_ORDER[type];
        if (harmonic) {
          const val = Math.sin(p * Math.PI * 2) * 0.65 + Math.sin(p * Math.PI * 2 * harmonic) * 0.35;
          y = centerY - val * amplitude * fade;
        } else {
          y = centerY;
        }
      }
    }
    points.push(x, y);
  }
  let path = `M ${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 2) {
    path += ` L ${points[i]} ${points[i + 1]}`;
  }
  return path;
};

const LfoWaveformSelector: React.FC<LfoWaveformSelectorProps> = ({ value, onChange, frequency, keysync, phase }) => {
  const { theme } = useThemeStore();
  const { t } = useTranslation();
  const lfoShapeMax = useLfoShapeMax();
  const availableTypes = LFO_TYPES.slice(0, Math.max(0, lfoShapeMax) + 1);
  const selectedValue = availableTypes.includes(value) ? value : (availableTypes[availableTypes.length - 1] ?? value);
  const path = generateWaveformPath(value, frequency ?? 1, 200, 50, keysync, phase ?? 0);
  return (
    <SelectorContainer>
      <WaveformVisualization>
        <WaveformCanvas viewBox="0 0 200 50" preserveAspectRatio="none">
          <path
            d={path}
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </WaveformCanvas>
      </WaveformVisualization>
      <StyledSelect $minWidth="140px" value={selectedValue} onChange={(e) => onChange(e.target.value as LfoType)}>
        {availableTypes.map((type) => (
          <option key={type} value={type}>
            {t(`lfo.types.${type}`)}
          </option>
        ))}
      </StyledSelect>
    </SelectorContainer>
  );
};

export default LfoWaveformSelector;
