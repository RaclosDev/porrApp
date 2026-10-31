import PaperLoading from './PaperLoading';

export function PredictionSkeleton({ compact = false }) {
  return (
    <PaperLoading
      embedded={compact}
      label={compact ? 'Cargando predicción del participante' : 'Cargando predicción'}
    />
  );
}

export function PageSkeleton() {
  return <PaperLoading />;
}
