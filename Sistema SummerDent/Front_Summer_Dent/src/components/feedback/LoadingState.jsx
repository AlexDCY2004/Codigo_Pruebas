import Skeleton from '../ui/Skeleton';

export default function LoadingState({ lines = 3 }) {
  const list = Array.from({ length: lines }, (_, index) => index);

  return (
    <div className="feedback feedback--loading" aria-live="polite" aria-busy="true">
      {list.map((item) => (
        <Skeleton key={item} height={14} />
      ))}
    </div>
  );
}
