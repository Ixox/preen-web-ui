import React from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import KnobBase from '../knobs/KnobBase';
import { StyledSelect } from '../StyledSelect';
import { useThemeStore } from '../../theme/themeStore';

export const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

export const ControlLabel = styled.label`
  color: ${props => props.theme.colors.textMuted};
  font-size: 0.65rem;
  text-transform: uppercase;
  white-space: nowrap;
`;

export interface SyncOption {
  value: string;
  label: string;
}

interface SyncBpmControlsProps {
  syncLabel: string;
  syncValue: string;
  syncOptions: readonly SyncOption[];
  onSyncChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  selectWidth?: string;
  selectMinWidth?: string;

  showBpm: boolean;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  bpmColor: string;
  bpmKnobSize?: number;

  showExtClock?: boolean;
  extClockLabel?: string;
  extClockValue?: string;
  extClockOptions?: readonly string[];
  onExtClockChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

/**
 * Shared Sync / Clock selector + conditional BPM knob (+ optional Ext MIDI Clock selector)
 * reused by both SeqEditor and ArpeggiatorEditor.
 */
export const SyncBpmControls: React.FC<SyncBpmControlsProps> = ({
  syncLabel,
  syncValue,
  syncOptions,
  onSyncChange,
  selectWidth,
  selectMinWidth,
  showBpm,
  bpm,
  onBpmChange,
  bpmColor,
  bpmKnobSize = 50,
  showExtClock = false,
  extClockLabel = 'MIDI Clock',
  extClockValue,
  extClockOptions,
  onExtClockChange,
}) => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();

  return (
    <>
      <ControlGroup>
        <ControlLabel>{syncLabel}</ControlLabel>
        <StyledSelect
          $width={selectWidth}
          $minWidth={selectMinWidth}
          value={syncValue}
          onChange={onSyncChange}
        >
          {syncOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </StyledSelect>
      </ControlGroup>

      {showBpm && (
        <ControlGroup>
          <KnobBase
            size={bpmKnobSize}
            knobRadius={16}
            min={10}
            max={240}
            step={1}
            value={bpm}
            onChange={onBpmChange}
            color={bpmColor}
            backgroundColor={theme.colors.knobBackground}
            strokeColor={theme.colors.knobStroke}
            renderLabel={(v) => Math.round(v)}
            label={t('modulation.bpm')}
          />
        </ControlGroup>
      )}

      {showExtClock && extClockOptions && onExtClockChange && (
        <ControlGroup>
          <ControlLabel>{extClockLabel}</ControlLabel>
          <StyledSelect
            $width={selectWidth}
            $minWidth={selectMinWidth}
            value={extClockValue}
            onChange={onExtClockChange}
          >
            {extClockOptions.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </StyledSelect>
        </ControlGroup>
      )}
    </>
  );
};
