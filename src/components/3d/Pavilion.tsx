import React, { Suspense } from 'react';
import { soundEngine } from '../../utils/audioSynthesizer';
import { PAVILION_POS } from '../../utils/terrain';
import { ProceduralPavilion } from './ProceduralPavilion';
import { TraditionalLantern, QinTable } from './PavilionFurniture';

export const Pavilion: React.FC = () => {
  const handlePlayGuqin = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    soundEngine.playGuqinString();
  };
  return <group position={PAVILION_POS}>
    <Suspense fallback={null}>
      <ProceduralPavilion />
    </Suspense>
    <QinTable onPlay={handlePlayGuqin} />
    <TraditionalLantern />
  </group>;
};
