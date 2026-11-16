import React from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import KnobBase from '../knobs/KnobBase';
import { useArpeggiator, updateArpeggiator } from '../../stores/patchStore';
import {
  ARP_CLOCKS, ARP_DIRECTIONS, ARP_PATTERNS, ARP_DIVISIONS, ARP_DURATIONS, ARP_LATCH,
  ARP_STEP_MODES, getArpFactoryPatternData, createDefaultArpUserPattern,
} from '../../types/patch';
import type {
  ArpClock, ArpDirection, ArpPattern, ArpDivision, ArpDuration, ArpLatch,
  ArpStepMode, ArpUserPatternKey,
} from '../../types/patch';
import { useThemeStore } from '../../theme/themeStore';
import { StyledSelect } from '../StyledSelect';
import { ControlGroup, ControlLabel, SyncBpmControls } from './SyncBpmControls';
import { StepGridEditor, type StepModeVisualStyle } from './StepGridEditor';
import {
  sendArpeggiatorClock,
  sendArpeggiatorBpm,
  sendArpeggiatorDirection,
  sendArpeggiatorOctave,
  sendArpeggiatorPattern,
  sendArpeggiatorDivision,
  sendArpeggiatorDuration,
  sendArpeggiatorLatch,
  sendArpeggiatorEuclideanSeed,
  sendArpeggiatorUserPatternLength,
  sendArpeggiatorUserStepState,
  sendArpeggiatorUserStepAction,
} from '../../midi/midiService';
import { arpStepValueToState } from '../../midi/preenFmConstants';

const ArpContainer = styled.div`
  background: ${props => props.theme.colors.panel};
  border-radius: 8px;
  padding: 16px;
  border: 1px solid ${props => props.theme.colors.border};
`;

const ArpHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
`;

const ArpTitle = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 1rem;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const ArpControls = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  align-items: start;
`;

const PatternSection = styled.div`
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid ${props => props.theme.colors.border};
`;

const PatternHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const PatternBadge = styled.span<{ $editable: boolean }>`
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  color: ${props => props.$editable ? props.theme.colors.primary : props.theme.colors.textMuted};
  background: ${props => props.$editable ? `${props.theme.colors.primary}20` : props.theme.colors.button};
  border: 1px solid ${props => props.$editable ? props.theme.colors.primary : props.theme.colors.border};
`;

const getArpStepModeStyle = (mode: ArpStepMode): StepModeVisualStyle => {
  if (mode === 'Norm') return { badgeLabel: '-' };
  if (mode === 'Off') {
    return {
      borderColor: '#e53e3e80',
      fillBackground: 'rgba(160, 174, 192, 0.25)',
      badgeBorderColor: '#fc8181',
      badgeBackground: '#e53e3e28',
      badgeTextColor: '#fc8181',
      optionTextColor: '#fc8181',
    };
  }
  if (mode === 'Tie') {
    return {
      borderColor: '#805ad5',
      fillBackground: 'linear-gradient(to top, #6b46c1 0%, #9f7aea 100%)',
      badgeBorderColor: '#b794f4',
      badgeBackground: '#805ad528',
      badgeTextColor: '#d6bcfa',
      optionTextColor: '#d6bcfa',
    };
  }
  if (mode === 'Oct+') {
    return {
      borderColor: '#38b2ac',
      fillBackground: 'linear-gradient(to top, #2c7a7b 0%, #4fd1c5 100%)',
      badgeBorderColor: '#4fd1c5',
      badgeBackground: '#38b2ac28',
      badgeTextColor: '#81e6d9',
      optionTextColor: '#81e6d9',
    };
  }
  if (mode === 'Rt*2') {
    return {
      borderColor: '#4299e1',
      fillBackground: 'linear-gradient(to top, #2b6cb0 0%, #63b3ed 100%)',
      badgeBorderColor: '#63b3ed',
      badgeBackground: '#4299e128',
      badgeTextColor: '#90cdf4',
      optionTextColor: '#90cdf4',
    };
  }
  // Chrd / Slap
  return {
    borderColor: '#ecc94b',
    fillBackground: 'linear-gradient(to top, #d69e2e 0%, #ecc94b 100%)',
    badgeBorderColor: '#ecc94b',
    badgeBackground: '#d69e2e28',
    badgeTextColor: '#ecc94b',
    optionTextColor: '#ecc94b',
  };
};

/**
 * Composant ArpeggiatorEditor
 * Gère l'arpégiateur du PreenFM3
 * Paramètres : Clock (BPM), Direction, Octave, Pattern, Division, Duration, Latch
 */
export const ArpeggiatorEditor: React.FC = () => {
  const { t } = useTranslation();
  const arp = useArpeggiator();
  const { theme } = useThemeStore();

  const clockSources = ARP_CLOCKS;
  const directions = ARP_DIRECTIONS;
  const patterns = ARP_PATTERNS;
  const divisions = ARP_DIVISIONS;
  const durations = ARP_DURATIONS;
  const latchModes = ARP_LATCH;

  const isUserPattern = arp.pattern.startsWith('Usr');
  const euclideanSeed = arp.euclideanSeed ?? 0;
  const factoryIndex = ARP_PATTERNS.indexOf(arp.pattern);
  const patternData = isUserPattern
    ? (arp.userPatterns?.[arp.pattern as ArpUserPatternKey] ?? createDefaultArpUserPattern())
    : getArpFactoryPatternData(factoryIndex >= 0 ? factoryIndex : 0, euclideanSeed);

  const userPatternIndex = (['Usr1', 'Usr2', 'Usr3', 'Usr4'].indexOf(arp.pattern)) as 0 | 1 | 2 | 3;

  const handleUserStepsChange = (steps: number[]) => {
    if (!isUserPattern || userPatternIndex < 0) return;
    const key = arp.pattern as ArpUserPatternKey;
    updateArpeggiator({
      userPatterns: {
        ...arp.userPatterns,
        [key]: { ...patternData, steps },
      },
    });
    for (let s = 0; s < 16; s++) {
      const mode = patternData.modes[s] ?? 'Norm';
      const prevState = arpStepValueToState(patternData.steps[s] ?? 0, mode);
      const nextState = arpStepValueToState(steps[s] ?? 0, mode);
      if (prevState !== nextState) {
        sendArpeggiatorUserStepState(userPatternIndex, s, nextState);
      }
    }
  };

  const handleUserModeChange = (stepIndex: number, mode: ArpStepMode) => {
    if (!isUserPattern || userPatternIndex < 0) return;
    const key = arp.pattern as ArpUserPatternKey;
    const prevMode = patternData.modes[stepIndex] ?? 'Norm';
    const modes = [...patternData.modes];
    modes[stepIndex] = mode;

    if (mode === 'Off') {
      sendArpeggiatorUserStepState(userPatternIndex, stepIndex, 0);
    } else {
      if (prevMode === 'Off') {
        const state = arpStepValueToState(patternData.steps[stepIndex] ?? 75, mode);
        sendArpeggiatorUserStepState(userPatternIndex, stepIndex, state);
      }
      sendArpeggiatorUserStepAction(userPatternIndex, stepIndex, mode);
    }

    updateArpeggiator({
      userPatterns: {
        ...arp.userPatterns,
        [key]: { ...patternData, modes },
      },
    });
  };

  const handleUserLengthChange = (length: number) => {
    if (!isUserPattern || userPatternIndex < 0) return;
    const clamped = Math.max(1, Math.min(16, Math.round(length)));
    const key = arp.pattern as ArpUserPatternKey;
    updateArpeggiator({
      userPatterns: {
        ...arp.userPatterns,
        [key]: { ...patternData, length: clamped },
      },
    });
    sendArpeggiatorUserPatternLength(userPatternIndex, clamped);
  };

  return (
    <ArpContainer>
      <ArpHeader>
        <ArpTitle>{t('modulation.arpeggiator')}</ArpTitle>
      </ArpHeader>

      <ArpControls>
        {/* Clock Source (Off/Int/Ext) + BPM (visible when Int) */}
        <SyncBpmControls
          syncLabel={t('modulation.clockSource')}
          syncValue={arp.clockSource}
          syncOptions={clockSources.map((src) => ({ value: src, label: src }))}
          onSyncChange={(e) => {
            const clockSource = e.target.value as ArpClock;
            updateArpeggiator({ clockSource });
            sendArpeggiatorClock(clockSource);
          }}
          selectWidth="120px"
          showBpm={arp.clockSource === 'Int'}
          bpm={arp.clock}
          onBpmChange={(clock) => {
            updateArpeggiator({ clock });
            sendArpeggiatorBpm(clock);
          }}
          bpmColor={theme.colors.knobArp}
          bpmKnobSize={60}
        />

        {/* Direction */}
        <ControlGroup>
          <ControlLabel>{t('modulation.direction')}</ControlLabel>
          <StyledSelect 
            $width="120px"
            value={arp.direction}
            onChange={(e) => {
              const direction = e.target.value as ArpDirection;
              updateArpeggiator({ direction });
              sendArpeggiatorDirection(direction);
            }}
          >
            {directions.map((dir) => (
              <option key={dir} value={dir}>
                {dir}
              </option>
            ))}
          </StyledSelect>
        </ControlGroup>

        {/* Octave */}
        <ControlGroup>
          <KnobBase
            size={60}
            knobRadius={16}
            min={1}
            max={3}
            step={1}
            value={arp.octave}
            onChange={(octave) => {
              updateArpeggiator({ octave });
              sendArpeggiatorOctave(octave);
            }}
            color={theme.colors.knobVolume}
            backgroundColor={theme.colors.knobBackground}
            strokeColor={theme.colors.knobStroke}
            renderLabel={(v) => Math.round(v)}
            label={t('modulation.octaves')}
          />
        </ControlGroup>

        {/* Pattern */}
        <ControlGroup>
          <ControlLabel>{t('modulation.pattern')}</ControlLabel>
          <StyledSelect 
            $width="120px"
            value={arp.pattern}
            onChange={(e) => {
              const pattern = e.target.value as ArpPattern;
              updateArpeggiator({ pattern });
              sendArpeggiatorPattern(pattern);
            }}
          >
            {patterns.map((pattern) => (
              <option key={pattern} value={pattern}>
                {pattern}
              </option>
            ))}
          </StyledSelect>
        </ControlGroup>

        {/* Division */}
        <ControlGroup>
          <ControlLabel>{t('modulation.division')}</ControlLabel>
          <StyledSelect 
            $width="120px"
            value={arp.division}
            onChange={(e) => {
              const division = e.target.value as ArpDivision;
              updateArpeggiator({ division });
              sendArpeggiatorDivision(division);
            }}
          >
            {divisions.map((div) => (
              <option key={div} value={div}>
                {div}
              </option>
            ))}
          </StyledSelect>
        </ControlGroup>

        {/* Duration */}
        <ControlGroup>
          <ControlLabel>{t('modulation.duration')}</ControlLabel>
          <StyledSelect 
            $width="120px"
            value={arp.duration}
            onChange={(e) => {
              const duration = e.target.value as ArpDuration;
              updateArpeggiator({ duration });
              sendArpeggiatorDuration(duration);
            }}
          >
            {durations.map((dur) => (
              <option key={dur} value={dur}>
                {dur}
              </option>
            ))}
          </StyledSelect>
        </ControlGroup>

        {/* Latch */}
        <ControlGroup>
          <ControlLabel>{t('modulation.latch')}</ControlLabel>
          <StyledSelect 
            $width="120px"
            value={arp.latch}
            onChange={(e) => {
              const latch = e.target.value as ArpLatch;
              updateArpeggiator({ latch });
              sendArpeggiatorLatch(latch);
            }}
          >
            {latchModes.map((latch) => (
              <option key={latch} value={latch}>
                {latch}
              </option>
            ))}
          </StyledSelect>
        </ControlGroup>

        {/* Euclidean Seed (0..15) for factory patterns 1..22, or Loop Length (1..16) for Usr1..Usr4 */}
        {!isUserPattern ? (
          <ControlGroup>
            <KnobBase
              size={60}
              knobRadius={16}
              min={0}
              max={15}
              step={1}
              value={euclideanSeed}
              onChange={(seed) => {
                const rounded = Math.round(seed);
                updateArpeggiator({ euclideanSeed: rounded });
                sendArpeggiatorEuclideanSeed(rounded);
              }}
              color={theme.colors.accent}
              backgroundColor={theme.colors.knobBackground}
              strokeColor={theme.colors.knobStroke}
              renderLabel={(v) => Math.round(v)}
              label={t('modulation.euclideanSeed')}
            />
          </ControlGroup>
        ) : (
          <ControlGroup>
            <KnobBase
              size={60}
              knobRadius={16}
              min={1}
              max={16}
              step={1}
              value={patternData.length ?? 16}
              onChange={handleUserLengthChange}
              color={theme.colors.accent}
              backgroundColor={theme.colors.knobBackground}
              strokeColor={theme.colors.knobStroke}
              renderLabel={(v) => Math.round(v)}
              label={t('modulation.loopLength')}
            />
          </ControlGroup>
        )}
      </ArpControls>

      <PatternSection>
        <PatternHeader>
          <ControlLabel>
            {t('modulation.pattern')} : {arp.pattern}
            {` (${patternData.length ?? 16} steps)`}
          </ControlLabel>
          <PatternBadge $editable={isUserPattern}>
            {isUserPattern ? t('modulation.arpPatternEditable') : t('modulation.arpPatternReadOnly')}
          </PatternBadge>
        </PatternHeader>

        <StepGridEditor
          steps={patternData.steps}
          modes={patternData.modes}
          availableModes={ARP_STEP_MODES}
          getModeLabel={(mode) => t(`modulation.arpStepModes.${mode}`)}
          getModeStyle={getArpStepModeStyle}
          isStepEditable={(mode) => mode !== 'Off'}
          readOnly={!isUserPattern}
          activeLength={patternData.length ?? 16}
          resetKey={`${arp.pattern}-${euclideanSeed}`}
          quantizeValue={(v) => (v >= 88 ? 100 : v >= 38 ? 75 : 0)}
          onStepsChange={handleUserStepsChange}
          onModeChange={handleUserModeChange}
        />
      </PatternSection>
    </ArpContainer>
  );
};
