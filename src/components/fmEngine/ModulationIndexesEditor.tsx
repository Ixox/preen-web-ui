import React from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { Algorithm } from '../../types/patch';
import { useCurrentPatch, updateModulationAmount, updateModulationVelo } from '../../stores/patchStore';
import { useFMSynthContext } from './FMSynthContext';
import { ALGO_DIAGRAMS } from '../../algo/algorithms.static';
import KnobBase from '../knobs/KnobBase';
import { useThemeStore } from '../../theme/themeStore';

const EditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  background: ${props => props.theme.colors.panel};
  border-radius: 8px;
  min-width: 400px;
  width: 100%;
  flex: 1;
  box-sizing: border-box;

  @media (max-width: 768px) {
    min-width: 0;
    max-width: 100%;
    width: 100%;
  }
`;

const ModulationList = styled.div`
  background: ${props => props.theme.colors.panel};
  border-radius: 8px;
  padding: 10px;
  width: 100%;
  box-sizing: border-box;
  min-height: 220px;
  overflow-y: auto;
  overflow-x: hidden;
`;

const ModulationListTitle = styled.h4`
  margin: 0 0 12px 0;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.85rem;
  font-weight: 600;
`;

const ModulationItem = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding: 4px 8px;
  background: ${props => props.theme.colors.background};
  border-radius: 4px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  flex: 1 1 auto;
  min-width: 0;
  max-width: 50%;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.7rem;
  line-height: 1;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const KnobsContainer = styled.div`
  display: flex;
  gap: 0px;
  align-items: center;
  justify-content: flex-start;
  flex: 0 0 auto;
  flex-shrink: 0;
`;

const EmptyMessage = styled.p`
  color: ${props => props.theme.colors.textMuted};
  font-size: 0.85rem;
  margin: 0;
`;

interface ModulationIndexesEditorProps {
  algorithm: Algorithm;
}

export const ModulationIndexesEditor: React.FC<ModulationIndexesEditorProps> = ({ algorithm }) => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const currentPatch = useCurrentPatch();
  const { setHighlightedLink } = useFMSynthContext();

  // Trouver le diagramme de l'algorithme pour connaître les types d'edges
  const diagram = ALGO_DIAGRAMS.find(d => d.id === String(algorithm.id));

  // Pré-calculer les IM indices dans l'ordre des edges (comme le firmware PreenFM3)
  const edgeIMIndex = new Map<string, number>(); // key: "srcId-tgtId"
  if (diagram) {
    let idx = 0;
    for (const edge of diagram.edges) {
      const src = parseInt(edge.from.replace(/\D/g, ''));
      const tgt = parseInt(edge.to.replace(/\D/g, ''));
      const isFb = src === tgt;
      edgeIMIndex.set(`${src}-${tgt}`, isFb ? 5 : idx);
      if (!isFb) idx++;
    }
  }

  // Collecte toutes les liaisons avec leurs indices à partir des opérateurs du patch
  const modulationLinks: Array<{
    imIndex: number;
    sourceId: number;
    targetId: number;
    im: number;
    modulationIndexVelo: number;
    edgeKind?: "modulation" | "sync";
  }> = [];

  if (!currentPatch || !currentPatch.operators) {
    return (
      <EditorContainer>
        <ModulationList>
          <ModulationListTitle>{t('modulation.imIndex')}</ModulationListTitle>
          <EmptyMessage>{t('common.noPatch')}</EmptyMessage>
        </ModulationList>
      </EditorContainer>
    );
  }

  currentPatch.operators.forEach((op) => {
    op.target.forEach((targetLink) => {
      // Récupérer l'index IM depuis la map pré-calculée (ordre edges du firmware)
      const imIndex = edgeIMIndex.get(`${op.id}-${targetLink.id}`) ?? 0;

      // Trouver le type d'edge dans le diagramme
      const edge = diagram?.edges.find(e => 
        e.from === `op${op.id}` && e.to === `op${targetLink.id}`
      );

      modulationLinks.push({
        imIndex,
        sourceId: op.id,
        targetId: targetLink.id,
        im: targetLink.im,
        modulationIndexVelo: targetLink.modulationIndexVelo ?? 0,
        edgeKind: edge?.kind
      });
    });
  });

  // Feedback toujours en dernier
  modulationLinks.sort((a, b) => {
    const aFb = a.sourceId === a.targetId ? 1 : 0;
    const bFb = b.sourceId === b.targetId ? 1 : 0;
    return aFb - bFb;
  });

  const handleIMChange = (sourceId: number, targetId: number, newValue: number) => {
    updateModulationAmount(sourceId, targetId, newValue);
    // Mettre en évidence la liaison pendant l'édition
    setHighlightedLink({ sourceId, targetId });
  };

  const handleVeloChange = (sourceId: number, targetId: number, newValue: number) => {
    updateModulationVelo(sourceId, targetId, newValue);
    setHighlightedLink({ sourceId, targetId });
  };

  if (modulationLinks.length === 0) {
    return (
      <EditorContainer>
        <ModulationList>
          <ModulationListTitle>{t('modulation.imIndex')}</ModulationListTitle>
          <EmptyMessage>{t('modulation.noLinks')}</EmptyMessage>
        </ModulationList>
      </EditorContainer>
    );
  }

  return (
    <EditorContainer>
      <ModulationList>
        <ModulationListTitle>{t('modulation.imIndex')}</ModulationListTitle>
        {modulationLinks.map((link) => {
        const isFeedback = link.sourceId === link.targetId;

        const label = isFeedback
          ? `Op${link.sourceId} Feedback` // feedback always uses IM6 slot
          : `IM${link.imIndex + 1}: Op${link.sourceId} → Op${link.targetId}`;
        const imMin = 0, imMax = 16, imStep = 0.01;
        const imValue = typeof link.im === 'number' ? Math.max(0, Math.min(16, link.im)) : 0;
        const veloMin = 0, veloMax = 16, veloStep = 0.01;
        const veloValue = typeof link.modulationIndexVelo === 'number' ? Math.max(0, Math.min(16, link.modulationIndexVelo)) : 0;

        return (
          <ModulationItem 
            key={`im-${link.sourceId}-${link.targetId}`}
            onMouseEnter={() => setHighlightedLink({ sourceId: link.sourceId, targetId: link.targetId })}
            onMouseLeave={() => setHighlightedLink(null)}
          >
            <Label>{label}</Label>
            <KnobsContainer>
              <KnobBase
                size={50}
                knobRadius={16}
                min={imMin}
                max={imMax}
                step={imStep}
                value={imValue}
                defaultValue={1}
                onChange={val => handleIMChange(link.sourceId, link.targetId, val)}
                color={theme.colors.knobModulation}
                backgroundColor={theme.colors.knobBackground}
                strokeColor={theme.colors.knobStroke}
                renderLabel={val => val.toFixed(2)}
                label="IM"
                labelPosition="left"
              />
              <KnobBase
                size={50}
                knobRadius={16}
                min={veloMin}
                max={veloMax}
                step={veloStep}
                value={veloValue}
                onChange={val => handleVeloChange(link.sourceId, link.targetId, val)}
                color={theme.colors.knobVelocity}
                backgroundColor={theme.colors.knobBackground}
                strokeColor={theme.colors.knobStroke}
                renderLabel={val => val.toFixed(2)}
                label="Velo"
                labelPosition="left"
              />
            </KnobsContainer>
          </ModulationItem>
        );
        })}
      </ModulationList>
    </EditorContainer>
  );
};

export default ModulationIndexesEditor;
