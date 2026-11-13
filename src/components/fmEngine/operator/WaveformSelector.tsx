import styled from 'styled-components';
import { WaveformType, WAVEFORMS } from '../../../types/waveform';
import { useTranslation } from 'react-i18next';
import { StyledSelect } from '../../StyledSelect';

const ControlContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ControlLabel = styled.label`
  color: ${props => props.theme.colors.textMuted};
  font-size: 0.75rem;
  text-transform: uppercase;
`;

export const WaveformSelector = ({ value, onChange }: { value?: WaveformType; onChange: (v: WaveformType) => void }) => {
  const { t } = useTranslation();

  return (
    <ControlContainer>
      <ControlLabel>{t('waveformSelector.label')}</ControlLabel>
      <StyledSelect
        value={value || 'SINE'}
        onChange={(e) => onChange(e.target.value as WaveformType)}
      >
        {WAVEFORMS.map(wave => (
          <option key={wave.name} value={wave.name}>
            {t(`waveformSelector.types.${wave.name}`)}
          </option>
        ))}
      </StyledSelect>
    </ControlContainer>
  );
}


export default WaveformSelector;