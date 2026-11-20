import styled from 'styled-components';
import { ArpeggiatorEditor } from '../components/modulations/ArpeggiatorEditor';

const ArpContainer = styled.div`
  margin: 0 auto;
  padding: 0;
`;

export function ArpFilterEditor() {
  return (
    <ArpContainer>
      <ArpeggiatorEditor />
    </ArpContainer>
  );
}
