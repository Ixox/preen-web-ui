import styled from 'styled-components';

export interface StyledSelectProps {
  $variant?: 'compact' | 'full';
  $width?: string;
  $minWidth?: string;
}

export const StyledSelect = styled.select<StyledSelectProps>`
  background: ${({ theme }) => theme.colors.button};
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-family: inherit;
  cursor: pointer;
  box-sizing: border-box;

  ${({ $variant = 'compact', $width, $minWidth }) =>
    $variant === 'full'
      ? `
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 0.82rem;
    width: 100%;
    height: 30px;
  `
      : `
    border-radius: 4px;
    padding: 4px 24px 4px 10px;
    font-size: 0.75rem;
    width: ${$width ?? ($minWidth ? 'auto' : '100px')};
    max-width: ${$width ?? ($minWidth ? 'none' : '120px')};
    ${$minWidth ? `min-width: ${$minWidth};` : ''}
    height: 30px;
  `}

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  option {
    background: ${({ theme }) => theme.colors.panel};
  }
`;
