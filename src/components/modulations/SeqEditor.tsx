import React, { useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import KnobBase from '../knobs/KnobBase';
import { useStepSequencer, updateStepSequencer } from '../../stores/patchStore';
import type { StepSeqSyncMode, StepSeqMidiClockMode, StepSeqStepMode } from '../../types/modulation';
import { STEP_SEQ_STEP_MODES, STEP_SEQ_MIDI_CLOCK_MODES, STEP_SEQ_NOTE_SYNC_BPM } from '../../types/modulation';
import { useThemeStore } from '../../theme/themeStore';
import { ControlGroup, SyncBpmControls } from './SyncBpmControls';
import { StepGridEditor, type StepModeVisualStyle } from './StepGridEditor';
import { CAPABILITY_BITS } from '../../midi/preenFmConstants';
import { useSupportsFeature } from '../../midi/useSynthCapabilities';

const SeqContainer = styled.div`
  background: ${props => props.theme.colors.panel};
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  border: 1px solid ${props => props.theme.colors.border};
  width: 100%;
  max-width: 520px;
`;

const HeaderRow = styled.div`
  margin-bottom: 12px;
`;

const TitleTabGroup = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const SeqTitle = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 0.9rem;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
  min-width: 150px;
`;

const SeqTabs = styled.div`
  display: flex;
  gap: 8px;
`;

const SeqTab = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? props.theme.colors.buttonActive : props.theme.colors.background};
  border: 1px solid ${props => props.$active ? props.theme.colors.border : props.theme.colors.border};
  border-radius: 4px;
  color: ${props => props.$active ? props.theme.colors.background : props.theme.colors.textMuted};
  padding: 6px 12px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.theme.colors.buttonHover};
    color: ${props => props.theme.colors.primary};
  }
`;

const SeqControls = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

const getStepSeqModeStyle = (mode: StepSeqStepMode): StepModeVisualStyle => {
  if (mode === 'Norm') {
    return { badgeLabel: '-' };
  }
  if (mode === 'Alt2' || mode === 'Alt3') {
    return {
      borderColor: '#ecc94b',
      fillBackground: 'linear-gradient(to top, #d69e2e 0%, #ecc94b 100%)',
      badgeBorderColor: '#ecc94b',
      badgeBackground: '#d69e2e28',
      badgeTextColor: '#ecc94b',
      optionTextColor: '#ecc94b',
    };
  }
  if (mode === 'Mute') {
    return {
      borderColor: '#e53e3e80',
      fillBackground: 'rgba(160, 174, 192, 0.25)',
      badgeBorderColor: '#fc8181',
      badgeBackground: '#e53e3e28',
      badgeTextColor: '#fc8181',
      optionTextColor: '#fc8181',
    };
  }
  if (mode === 'Pass') {
    return {
      borderColor: '#71809680',
      dashed: true,
      fillBackground: 'rgba(160, 174, 192, 0.4)',
      badgeBorderColor: '#a0aec0',
      badgeBackground: '#71809628',
      badgeTextColor: '#a0aec0',
      optionTextColor: '#a0aec0',
    };
  }
  if (mode.startsWith('Gld')) {
    return {
      borderColor: '#805ad5',
      fillBackground: 'linear-gradient(to top, #6b46c1 0%, #9f7aea 100%)',
      badgeBorderColor: '#b794f4',
      badgeBackground: '#805ad528',
      badgeTextColor: '#d6bcfa',
      optionTextColor: '#d6bcfa',
    };
  }
  if (mode.startsWith('Lfo')) {
    return {
      borderColor: '#38b2ac',
      fillBackground: 'linear-gradient(to top, #2c7a7b 0%, #4fd1c5 100%)',
      badgeBorderColor: '#4fd1c5',
      badgeBackground: '#38b2ac28',
      badgeTextColor: '#81e6d9',
      optionTextColor: '#81e6d9',
    };
  }
  // Ratchet 1/32, 1/48, 1/64
  return {
    borderColor: '#4299e1',
    fillBackground: 'linear-gradient(to top, #2b6cb0 0%, #63b3ed 100%)',
    badgeBorderColor: '#63b3ed',
    badgeBackground: '#4299e128',
    badgeTextColor: '#90cdf4',
    optionTextColor: '#90cdf4',
  };
};

/**
 * Composant SeqEditor
 * Gère les 2 séquenceurs à pas (Step Sequencers) du PreenFM3
 */
export const SeqEditor: React.FC = () => {
  const { t } = useTranslation();
  const [activeSeq, setActiveSeq] = useState<0 | 1>(0);
  const seq = useStepSequencer(activeSeq);
  const { theme } = useThemeStore();
  const supportsStepModes = useSupportsFeature(CAPABILITY_BITS.STEP_SEQ_MODES);

  const currentModes: StepSeqStepMode[] = seq.stepModes && seq.stepModes.length === 16
    ? seq.stepModes
    : Array(16).fill('Norm');
  const loopLength = typeof seq.loopLength === 'number'
    ? (seq.loopLength === 0 ? 16 : Math.max(1, Math.min(16, seq.loopLength)))
    : 16;

  const handleModeChange = (stepIndex: number, mode: StepSeqStepMode) => {
    const newModes = [...currentModes];
    newModes[stepIndex] = mode;
    updateStepSequencer(activeSeq, { stepModes: newModes });
  };

  const handleLoopLengthChange = (length: number) => {
    const clamped = Math.max(1, Math.min(16, Math.round(length)));
    updateStepSequencer(activeSeq, { loopLength: clamped });
  };

  // Envoie le NRPN de synchro / BPM (10-240 Int, 241-245 Ext MIDI Clock, 246 Note)
  const handleSyncModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMode = e.target.value as StepSeqSyncMode;
    if (newMode === 'Note') {
      updateStepSequencer(activeSeq, { syncMode: 'Note', bpm: STEP_SEQ_NOTE_SYNC_BPM });
    } else if (newMode === 'Ext') {
      const modeIndex = STEP_SEQ_MIDI_CLOCK_MODES.indexOf(seq.midiClockMode);
      const bpm = 241 + (modeIndex >= 0 ? modeIndex : 0);
      updateStepSequencer(activeSeq, { syncMode: 'Ext', bpm, midiClockMode: seq.midiClockMode });
    } else {
      const intBpm = seq.bpm >= 10 && seq.bpm <= 240 ? seq.bpm : 120;
      updateStepSequencer(activeSeq, { syncMode: 'Int', bpm: intBpm });
    }
  };

  const handleMidiClockModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newClockMode = e.target.value as StepSeqMidiClockMode;
    if (seq.syncMode === 'Ext') {
      const modeIndex = STEP_SEQ_MIDI_CLOCK_MODES.indexOf(newClockMode);
      const bpm = 241 + (modeIndex >= 0 ? modeIndex : 0);
      updateStepSequencer(activeSeq, { midiClockMode: newClockMode, bpm });
    } else {
      updateStepSequencer(activeSeq, { midiClockMode: newClockMode });
    }
  };

  const syncModes: StepSeqSyncMode[] = ['Int', 'Ext', 'Note'];

  return (
    <SeqContainer>
      <HeaderRow>
        <TitleTabGroup>
          <SeqTitle>{t('modulation.stepSeq')}</SeqTitle>
          <SeqTabs>
            {([0, 1] as const).map((seqNum) => (
              <SeqTab
                key={seqNum}
                $active={activeSeq === seqNum}
                onClick={() => setActiveSeq(seqNum)}
              >
                Seq {seqNum + 1}
              </SeqTab>
            ))}
          </SeqTabs>
        </TitleTabGroup>
      </HeaderRow>

      <StepGridEditor
        steps={seq.steps}
        modes={currentModes}
        availableModes={STEP_SEQ_STEP_MODES}
        getModeLabel={(mode) => t(`modulation.stepModes.${mode}`)}
        getModeStyle={getStepSeqModeStyle}
        isStepEditable={(mode) => mode !== 'Mute' && mode !== 'Pass'}
        resetKey={activeSeq}
        onStepsChange={(steps) => updateStepSequencer(activeSeq, { steps })}
        onModeChange={handleModeChange}
        showModes={supportsStepModes}
        activeLength={supportsStepModes ? loopLength : 16}
      />

      <SeqControls>
        {supportsStepModes && (
        <ControlGroup>
          <KnobBase
            size={50}
            knobRadius={16}
            min={1}
            max={16}
            step={1}
            value={loopLength}
            onChange={handleLoopLengthChange}
            color={theme.colors.accent}
            backgroundColor={theme.colors.knobBackground}
            strokeColor={theme.colors.knobStroke}
            renderLabel={(v) => Math.round(v)}
            label={t('modulation.loopLength')}
          />
        </ControlGroup>
        )}

        <ControlGroup>
          <KnobBase
            size={50}
            min={0}
            max={1}
            step={0.01}
            value={seq.gate}
            onChange={(gate) => updateStepSequencer(activeSeq, { gate })}
            color={theme.colors.knobSeq}
            backgroundColor={theme.colors.knobBackground}
            strokeColor={theme.colors.knobStroke}
            knobRadius={16}
            renderLabel={(v) => `${(v * 100).toFixed(0)}%`}
            label={t('modulation.gate')}
          />
        </ControlGroup>

        <SyncBpmControls
          syncLabel="Sync"
          syncValue={seq.syncMode}
          syncOptions={syncModes.map((mode) => ({
            value: mode,
            label: mode === 'Int' ? 'Internal' : mode === 'Ext' ? 'External' : 'Note (NoteOn)',
          }))}
          onSyncChange={handleSyncModeChange}
          selectMinWidth="80px"
          showBpm={seq.syncMode === 'Int'}
          bpm={seq.bpm}
          onBpmChange={(bpm) => updateStepSequencer(activeSeq, { bpm })}
          bpmColor={theme.colors.knobPhase}
          showExtClock={seq.syncMode === 'Ext'}
          extClockLabel="MIDI Clock"
          extClockValue={seq.midiClockMode}
          extClockOptions={STEP_SEQ_MIDI_CLOCK_MODES}
          onExtClockChange={handleMidiClockModeChange}
        />
      </SeqControls>
    </SeqContainer>
  );
};
