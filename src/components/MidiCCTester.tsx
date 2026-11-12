import { useState } from 'react';
import styled from 'styled-components';
import { sendCC } from '../midi/midiService';

const Container = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  background: ${props => props.theme.colors.panel};
  border: 2px solid ${props => props.theme.colors.primary};
  border-radius: 8px;
  padding: 20px;
  z-index: 9999;
  max-width: 400px;
`;

const Title = styled.h3`
  margin: 0 0 15px 0;
  color: ${props => props.theme.colors.text};
  font-size: 1rem;
`;

const TestGrid = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 15px;
`;

const Label = styled.label`
  color: ${props => props.theme.colors.textMuted};
  font-size: 0.875rem;
`;

const Button = styled.button`
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.875rem;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:active {
    opacity: 0.8;
  }
`;

const Input = styled.input`
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  color: ${props => props.theme.colors.text};
  padding: 6px 8px;
  font-size: 0.875rem;
  width: 80px;
`;

const Info = styled.div`
  color: ${props => props.theme.colors.textMuted};
  font-size: 0.75rem;
  margin-bottom: 10px;
  padding: 10px;
  background: ${props => props.theme.colors.background};
  border-radius: 4px;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background: transparent;
  border: none;
  color: ${props => props.theme.colors.textMuted};
  cursor: pointer;
  font-size: 1.2rem;
  
  &:hover {
    color: ${props => props.theme.colors.text};
  }
`;

export const MidiCCTester = ({ onClose }: { onClose: () => void }) => {
  const [ccNumber, setCcNumber] = useState(27);
  const [value, setValue] = useState(100);
  const [lastSent, setLastSent] = useState<string>('');

  const testCC = (cc: number) => {
    sendCC(cc, value, 1);
    setLastSent(`CC ${cc} = ${value}`);
    console.log(`🧪 TEST: Sent CC ${cc} = ${value}`);
  };

  return (
    <Container>
      <CloseButton onClick={onClose}>×</CloseButton>
      <Title>🧪 MIDI CC Tester</Title>
      
      <Info>
        <strong>Mapping Référence :</strong> Mix & Pan entrelacés pour OP1-4 (Mix: 22, 24, 26, 28 / Pan: 23, 25, 27, 29). OP5: Mix 31, Pan 36. OP6: Mix 37, Pan 39.
      </Info>

      <TestGrid>
        <Label>CC Number:</Label>
        <Input 
          type="number" 
          min="0" 
          max="127" 
          value={ccNumber}
          onChange={(e) => setCcNumber(Number(e.target.value))}
        />
        <Button onClick={() => testCC(ccNumber)}>Send</Button>

        <Label>Value:</Label>
        <Input 
          type="number" 
          min="0" 
          max="127" 
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <div></div>
      </TestGrid>

      {lastSent && (
        <Info style={{ marginTop: '10px', background: '#2a4' }}>
          ✅ Sent: {lastSent}
        </Info>
      )}

      <div style={{ marginTop: '15px', borderTop: '1px solid #444', paddingTop: '15px' }}>
        <Label style={{ display: 'block', marginBottom: '10px' }}>Quick Tests Mix & Pan (OP1-6) :</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
          {[
            { label: 'Mix1', cc: 22 },
            { label: 'Pan1', cc: 23 },
            { label: 'Mix2', cc: 24 },
            { label: 'Pan2', cc: 25 },
            { label: 'Mix3', cc: 26 },
            { label: 'Pan3', cc: 27 },
            { label: 'Mix4', cc: 28 },
            { label: 'Pan4', cc: 29 },
            { label: 'Mix5', cc: 31 },
            { label: 'Pan5', cc: 36 },
            { label: 'Mix6', cc: 37 },
            { label: 'Pan6', cc: 39 },
          ].map(({ label, cc }) => (
            <Button 
              key={cc} 
              onClick={() => testCC(cc)}
              style={{ fontSize: '0.75rem', padding: '4px 6px' }}
            >
              {label} ({cc})
            </Button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '15px', borderTop: '1px solid #444', paddingTop: '15px' }}>
        <Label style={{ display: 'block', marginBottom: '10px' }}>Quick Tests Timbre & Master FX (CC 40-45) :</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
          {[
            { label: 'DryWet', cc: 40 },
            { label: 'Dyn', cc: 41 },
            { label: 'Decim', cc: 42 },
            { label: 'Play', cc: 43 },
            { label: 'MFX Ret', cc: 44 },
            { label: 'MFX Prst', cc: 45 },
          ].map(({ label, cc }) => (
            <Button
              key={cc}
              onClick={() => testCC(cc)}
              style={{ fontSize: '0.75rem', padding: '4px 6px' }}
            >
              {label} ({cc})
            </Button>
          ))}
        </div>
      </div>

      <Info style={{ marginTop: '15px' }}>
        <strong>Documentation :</strong><br/>
        Mix OP1-4 : 22, 24, 26, 28 | Pan OP1-4 : 23, 25, 27, 29<br/>
        OP5 : Mix 31, Pan 36 | OP6 : Mix 37, Pan 39<br/>
        Warp OP1-3 : 33-35 | Warp OP4-6 : 111-113<br/>
        Timbre/MFX : DryWet 40, Dyn 41, Decim 42, Play 43, Ret 44, Prst 45
      </Info>
    </Container>
  );
};

export default MidiCCTester;
