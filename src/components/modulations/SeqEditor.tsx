import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import KnobBase from '../knobs/KnobBase';
import { useStepSequencer, updateStepSequencer } from '../../stores/patchStore';
import type { StepSeqSyncMode, StepSeqMidiClockMode, StepSeqStepMode } from '../../types/modulation';
import { STEP_SEQ_STEP_MODES, STEP_SEQ_MIDI_CLOCK_MODES, STEP_SEQ_NOTE_SYNC_BPM } from '../../types/modulation';
import { useThemeStore } from '../../theme/themeStore';
import { StyledSelect } from '../StyledSelect';

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
  border: 1px solid ${props => props.theme.colors.border};
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

const StepsContainer = styled.div`
  margin-bottom: 12px;
  overflow-x: auto;
`;

const StepGrid = styled.div`
  display: flex;
  gap: 6px;
  justify-content: space-between;
`;

const StepColumn = styled.div<{ $isPastLoop?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  user-select: none;
  position: relative;
  opacity: ${props => props.$isPastLoop ? 0.38 : 1};
  transition: opacity 0.2s;
`;

const isRatchetMode = (mode?: StepSeqStepMode) =>
  mode === '1/32' || mode === '1/48' || mode === '1/64';

const isLfoTrigMode = (mode?: StepSeqStepMode) =>
  mode?.startsWith('Lfo') ?? false;

const StepBar = styled.div<{ $mode?: StepSeqStepMode }>`
  width: 100%;
  height: 120px;
  background: ${props => `linear-gradient(to bottom, ${props.theme.colors.primary}20 0%, ${props.theme.colors.primary}10 100%)`};
  border: 1px solid ${props => {
    if (props.$mode === 'Rset') return '#ecc94b';
    if (props.$mode === 'Mute') return '#e53e3e80';
    if (props.$mode === 'Pass') return '#71809680';
    if (props.$mode?.startsWith('Gld')) return '#805ad5';
    if (isLfoTrigMode(props.$mode)) return '#38b2ac';
    if (isRatchetMode(props.$mode)) return '#4299e1';
    return props.theme.colors.border;
  }};
  border-style: ${props => props.$mode === 'Pass' ? 'dashed' : 'solid'};
  border-radius: 4px;
  position: relative;
  cursor: ${props => !props.$mode || (props.$mode !== 'Mute' && props.$mode !== 'Pass' && props.$mode !== 'Rset') ? 'crosshair' : 'not-allowed'};
  transition: border-color 0.2s;
  
  &:hover {
    border-color: ${props => props.theme.colors.primary};
  }
`;

const StepFill = styled.div<{ $value: number; $mode?: StepSeqStepMode }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${props => props.$value}%;
  background: ${props => {
    if (props.$mode === 'Mute') return 'rgba(160, 174, 192, 0.25)';
    if (props.$mode === 'Pass') return 'rgba(160, 174, 192, 0.4)';
    if (props.$mode === 'Rset') return 'linear-gradient(to top, #d69e2e 0%, #ecc94b 100%)';
    if (props.$mode?.startsWith('Gld')) return 'linear-gradient(to top, #6b46c1 0%, #9f7aea 100%)';
    if (isLfoTrigMode(props.$mode)) return 'linear-gradient(to top, #2c7a7b 0%, #4fd1c5 100%)';
    if (isRatchetMode(props.$mode)) return 'linear-gradient(to top, #2b6cb0 0%, #63b3ed 100%)';
    return `linear-gradient(to top, ${props.theme.colors.primary} 0%, ${props.theme.colors.accent} 100%)`;
  }};
  border-radius: 0 0 3px 3px;
  pointer-events: none;
  transition: height 0.05s ease-out;
`;

const StepLabel = styled.div`
  color: ${props => props.theme.colors.textMuted};
  font-size: 0.65rem;
  text-align: center;
`;

const StepModeBadge = styled.button<{ $mode: StepSeqStepMode; $active?: boolean }>`
  width: 100%;
  padding: 2px 0;
  font-size: 0.6rem;
  font-weight: 600;
  line-height: 1;
  border-radius: 3px;
  border: 1px solid ${props => {
    if (props.$mode === 'Rset') return '#ecc94b';
    if (props.$mode === 'Mute') return '#fc8181';
    if (props.$mode === 'Pass') return '#a0aec0';
    if (props.$mode.startsWith('Gld')) return '#b794f4';
    if (isLfoTrigMode(props.$mode)) return '#4fd1c5';
    if (isRatchetMode(props.$mode)) return '#63b3ed';
    return props.theme.colors.border;
  }};
  background: ${props => {
    if (props.$mode === 'Rset') return '#d69e2e28';
    if (props.$mode === 'Mute') return '#e53e3e28';
    if (props.$mode === 'Pass') return '#71809628';
    if (props.$mode.startsWith('Gld')) return '#805ad528';
    if (isLfoTrigMode(props.$mode)) return '#38b2ac28';
    if (isRatchetMode(props.$mode)) return '#4299e128';
    return props.theme.colors.button;
  }};
  color: ${props => {
    if (props.$mode === 'Rset') return '#ecc94b';
    if (props.$mode === 'Mute') return '#fc8181';
    if (props.$mode === 'Pass') return '#a0aec0';
    if (props.$mode.startsWith('Gld')) return '#d6bcfa';
    if (isLfoTrigMode(props.$mode)) return '#81e6d9';
    if (isRatchetMode(props.$mode)) return '#90cdf4';
    return props.theme.colors.textMuted;
  }};
  cursor: pointer;
  text-align: center;
  transition: all 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    border-color: ${props => props.theme.colors.primary};
    color: ${props => props.theme.colors.primary};
  }
`;

const ModePopupContainer = styled.div<{ $top: number; $left: number; $openBelow: boolean }>`
  position: fixed;
  top: ${props => props.$top}px;
  left: ${props => props.$left}px;
  transform: ${props => props.$openBelow ? 'translateY(0)' : 'translateY(-100%)'};
  background: ${props => props.theme.colors.panel};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 2000;
  min-width: 148px;
  max-height: min(380px, calc(100vh - 16px));
  overflow-y: auto;
  white-space: nowrap;
`;

const ModeOptionButton = styled.button<{ $isSelected: boolean; $mode: StepSeqStepMode }>`
  background: ${props => props.$isSelected ? props.theme.colors.buttonActive : 'transparent'};
  border: none;
  border-radius: 4px;
  color: ${props => {
    if (props.$mode === 'Rset') return '#ecc94b';
    if (props.$mode === 'Mute') return '#fc8181';
    if (props.$mode === 'Pass') return '#a0aec0';
    if (props.$mode.startsWith('Gld')) return '#d6bcfa';
    if (isLfoTrigMode(props.$mode)) return '#81e6d9';
    if (isRatchetMode(props.$mode)) return '#90cdf4';
    return props.theme.colors.text;
  }};
  font-size: 0.7rem;
  font-weight: 600;
  padding: 5px 8px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  white-space: nowrap;

  &:hover {
    background: ${props => props.theme.colors.buttonHover};
    color: ${props => props.theme.colors.primary};
  }
`;

const StepValue = styled.div`
  color: ${props => props.theme.colors.text};
  font-size: 0.65rem;
  font-weight: bold;
  text-align: center;
  min-height: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
`;

const SeqControls = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const ControlLabel = styled.label`
  color: ${props => props.theme.colors.textMuted};
  font-size: 0.65rem;
  text-transform: uppercase;
  white-space: nowrap;
`;

/**
 * Composant SeqEditor
 * Gère les 2 séquenceurs à pas (Step Sequencers) du PreenFM3
 * Structure firmware:
 * - 16 steps avec valeurs 0-100
 * - Gate global (0-1, représenté en % 0-100%)
 * - Sync mode: Internal (BPM) ou External (MIDI Clock)
 * - BPM: 10-240 (utilisé si syncMode = 'Int')
 * - MIDI Clock mode: C/16, Ck/8, Ck/4, Ck/2, Ck, Ck*2, Ck*3, Ck*4, Ck*8 (utilisé si syncMode = 'Ext')
 */
export const SeqEditor: React.FC = () => {
  const { t } = useTranslation();
  const [activeSeq, setActiveSeq] = useState<0 | 1>(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [openModeMenu, setOpenModeMenu] = useState<{ index: number; top: number; left: number; openBelow: boolean } | null>(null);
  const seq = useStepSequencer(activeSeq);
  const { theme } = useThemeStore();
  
  // État local pour un dessin fluide, synchronisé avec le store uniquement à la fin
  const [localSteps, setLocalSteps] = useState<number[] | null>(null);
  const displaySteps = localSteps || seq.steps;
  const currentModes: StepSeqStepMode[] = seq.stepModes && seq.stepModes.length === 16
    ? seq.stepModes
    : Array(16).fill('Norm');
  const loopLength = typeof seq.loopLength === 'number'
    ? seq.loopLength
    : (currentModes.indexOf('Rset') >= 0 ? currentModes.indexOf('Rset') + 1 : 16);
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  /** Trouve le step le plus proche en X et calcule la valeur en Y (sensible au-dessus/dessous des barres) */
  const findStepAndValue = (clientX: number, clientY: number): { index: number; value: number } | null => {
    if (!stepsContainerRef.current) return null;
    const bars = stepsContainerRef.current.querySelectorAll<HTMLElement>('[data-step-index]');
    if (bars.length === 0) return null;
    let closestIndex = -1;
    let minDist = Infinity;
    let closestRect: DOMRect | null = null;
    bars.forEach((bar) => {
      const rect = bar.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const dist = Math.abs(clientX - centerX);
      const idx = parseInt(bar.getAttribute('data-step-index') || '-1');
      if (dist < minDist && idx >= 0) {
        minDist = dist;
        closestIndex = idx;
        closestRect = rect;
      }
    });
    if (closestIndex < 0 || !closestRect) return null;
    const rect = closestRect as DOMRect;
    const y = clientY - rect.top;
    const value = Math.round(100 - (y / rect.height) * 100);
    return { index: closestIndex, value: Math.max(0, Math.min(100, value)) };
  };

  // Fermer le menu popup si on clique en dehors
  useEffect(() => {
    if (!openModeMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setOpenModeMenu(null);
      }
    };
    const handleScrollOrResize = () => setOpenModeMenu(null);
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [openModeMenu]);

  // Synchroniser l'état local quand on change de séquenceur
  React.useEffect(() => {
    setLocalSteps(null);
    setOpenModeMenu(null);
  }, [activeSeq]);

  const handleModeChange = (stepIndex: number, mode: StepSeqStepMode) => {
    const newModes = [...currentModes];
    newModes[stepIndex] = mode;
    // Si on met Rset sur ce pas, les autres pas avec Rset repassent à Norm (comme dans le firmware)
    if (mode === 'Rset') {
      for (let i = 0; i < 16; i++) {
        if (i !== stepIndex && newModes[i] === 'Rset') {
          newModes[i] = 'Norm';
        }
      }
    }
    const rsetIndex = newModes.indexOf('Rset');
    const newLoopLength = rsetIndex >= 0 ? rsetIndex + 1 : 16;
    updateStepSequencer(activeSeq, { stepModes: newModes, loopLength: newLoopLength });
    setOpenModeMenu(null);
  };

  const handleLoopLengthChange = (length: number) => {
    const clamped = Math.max(1, Math.min(16, Math.round(length)));
    const newModes = [...currentModes];
    // Placer Rset sur le pas length - 1 et remettre les autres Rset à Norm (comme firmware)
    for (let i = 0; i < 16; i++) {
      if (i === clamped - 1) {
        newModes[i] = 'Rset';
      } else if (newModes[i] === 'Rset') {
        newModes[i] = 'Norm';
      }
    }
    updateStepSequencer(activeSeq, { stepModes: newModes, loopLength: clamped });
  };

  const calculateValueFromMouseY = (e: React.MouseEvent<HTMLDivElement>, rect: DOMRect) => {
    const y = e.clientY - rect.top;
    const height = rect.height;
    const value = Math.round(100 - (y / height) * 100);
    return Math.max(0, Math.min(100, value));
  };

  const isEditableStepMode = (mode?: StepSeqStepMode) =>
    !mode || (mode !== 'Mute' && mode !== 'Pass' && mode !== 'Rset');

  const isStepEditable = (index: number) => isEditableStepMode(seq.stepModes?.[index]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDrawing(true);
    const newSteps = [...seq.steps];
    const hit = findStepAndValue(e.clientX, e.clientY);
    if (hit && isStepEditable(hit.index)) {
      newSteps[hit.index] = hit.value;
    }
    setLocalSteps(newSteps);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    // Synchroniser avec le store uniquement à la fin
    if (localSteps) {
      updateStepSequencer(activeSeq, { steps: localSteps });
      setLocalSteps(null);
    }
  };

  const handleStepClick = (index: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!isStepEditable(index)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const value = calculateValueFromMouseY(e, rect);
    // Mise à jour immédiate du store pour un simple clic
    const newSteps = [...seq.steps];
    newSteps[index] = value;
    updateStepSequencer(activeSeq, { steps: newSteps });
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
    // Si on est en mode Ext, envoyer bpm = 241 + index du mode clock (241..245)
    if (seq.syncMode === 'Ext') {
      const modeIndex = STEP_SEQ_MIDI_CLOCK_MODES.indexOf(newClockMode);
      const bpm = 241 + (modeIndex >= 0 ? modeIndex : 0);
      updateStepSequencer(activeSeq, { midiClockMode: newClockMode, bpm });
    } else {
      updateStepSequencer(activeSeq, { midiClockMode: newClockMode });
    }
  };

  React.useEffect(() => {
    if (!isDrawing) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!localSteps) return;
      const hit = findStepAndValue(e.clientX, e.clientY);
      if (!hit || !isStepEditable(hit.index)) return;
      const newSteps = [...localSteps];
      if (newSteps[hit.index] !== hit.value) {
        newSteps[hit.index] = hit.value;
        setLocalSteps(newSteps);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDrawing(false);
      if (localSteps) {
        updateStepSequencer(activeSeq, { steps: localSteps });
        setLocalSteps(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDrawing, localSteps, activeSeq]);

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

      <StepsContainer ref={stepsContainerRef} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}>
        <StepGrid>
          {displaySteps.map((value, index) => {
            const mode = currentModes[index] ?? 'Norm';
            const isPastLoop = index >= loopLength;
            const showValue = isEditableStepMode(mode);
            return (
              <StepColumn key={index} $isPastLoop={isPastLoop}>
                <StepValue>{showValue ? value : ''}</StepValue>
                <StepBar
                  data-step-index={index}
                  onClick={(e) => handleStepClick(index, e)}
                  title={showValue ? `Step ${index + 1}: ${value} (${mode})` : `Step ${index + 1}: ${mode}`}
                  $mode={mode}
                >
                  {showValue && <StepFill $value={value} $mode={mode} />}
                </StepBar>
                <StepLabel>{index + 1}</StepLabel>
                <StepModeBadge
                  type="button"
                  $mode={mode}
                  $active={openModeMenu?.index === index}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (openModeMenu?.index === index) {
                      setOpenModeMenu(null);
                      return;
                    }
                    const rect = e.currentTarget.getBoundingClientRect();
                    const popupWidth = 156;
                    const openBelow = rect.top < 360;
                    const top = openBelow ? rect.bottom + 6 : rect.top - 6;
                    const rawLeft = rect.left + rect.width / 2 - popupWidth / 2;
                    const left = Math.max(8, Math.min(window.innerWidth - popupWidth - 8, rawLeft));
                    setOpenModeMenu({ index, top, left, openBelow });
                  }}
                  title={`Mode: ${t(`modulation.stepModes.${mode}`)}`}
                >
                  {mode === 'Norm' ? '-' : mode}
                </StepModeBadge>
              </StepColumn>
            );
          })}
        </StepGrid>
      </StepsContainer>

      {openModeMenu !== null && createPortal(
        <ModePopupContainer
          ref={modeMenuRef}
          $top={openModeMenu.top}
          $left={openModeMenu.left}
          $openBelow={openModeMenu.openBelow}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {STEP_SEQ_STEP_MODES.map((optMode) => {
            const currentMode = currentModes[openModeMenu.index] ?? 'Norm';
            return (
              <ModeOptionButton
                key={optMode}
                type="button"
                $mode={optMode}
                $isSelected={currentMode === optMode}
                onClick={() => handleModeChange(openModeMenu.index, optMode)}
              >
                <span>{optMode}</span>
                <span style={{ fontSize: '0.6rem', opacity: 0.75 }}>
                  {t(`modulation.stepModes.${optMode}`)}
                </span>
              </ModeOptionButton>
            );
          })}
        </ModePopupContainer>,
        document.body
      )}

      <SeqControls>
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

        <ControlGroup>
          <ControlLabel>Sync</ControlLabel>
          <StyledSelect 
            $minWidth="80px"
            value={seq.syncMode}
            onChange={handleSyncModeChange}
          >
            {syncModes.map(mode => (
              <option key={mode} value={mode}>
                {mode === 'Int' ? 'Internal' : mode === 'Ext' ? 'External' : 'Note (NoteOn)'}
              </option>
            ))}
          </StyledSelect>
        </ControlGroup>

        {seq.syncMode === 'Int' && (
          <ControlGroup>
            <KnobBase
              size={50}
              knobRadius={16}
              min={10}
              max={240}
              step={1}
              value={seq.bpm}
              onChange={(bpm) => updateStepSequencer(activeSeq, { bpm })}
              color={theme.colors.knobPhase}
              backgroundColor={theme.colors.knobBackground}
              strokeColor={theme.colors.knobStroke}
              renderLabel={(v) => Math.round(v)}
              label={t('modulation.bpm')}
            />
          </ControlGroup>
        )}

        {seq.syncMode === 'Ext' && (
          <ControlGroup>
            <ControlLabel>MIDI Clock</ControlLabel>
            <StyledSelect 
              $minWidth="80px"
              value={seq.midiClockMode}
              onChange={handleMidiClockModeChange}
            >
              {STEP_SEQ_MIDI_CLOCK_MODES.map(mode => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </StyledSelect>
          </ControlGroup>
        )}
      </SeqControls>
    </SeqContainer>
  );
};
