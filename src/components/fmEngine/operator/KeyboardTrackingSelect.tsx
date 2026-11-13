import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { StyledSelect } from '../../StyledSelect';

interface KeyboardTrackingSelectProps {
  value: number;
  onChange: (value: number) => void;
}

const trackingModes = [
  { value: 0, label: 'Fixed' },
  { value: 1, label: 'Keyboard' },
  { value: 2, label: 'Finetune Hz' }
];

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

export const KeyboardTrackingSelect: React.FC<KeyboardTrackingSelectProps> = ({ value, onChange }) => {
  const { t } = useTranslation();

  return (
    <ControlContainer>
      <ControlLabel>{t('keyboardTrackingSelect.label')}</ControlLabel>
      <StyledSelect
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {trackingModes.map(mode => (
          <option key={mode.value} value={mode.value}>
            {mode.label}
          </option>
        ))}
      </StyledSelect>
    </ControlContainer>
  );
}

export default KeyboardTrackingSelect;