export default function LoadingState({ lines = 5 }) {
  return (
    <div className="loading-state">
      {[...Array(lines)].map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${60 + Math.random() * 40}%`, marginBottom: '0.75rem' }} />
      ))}
    </div>
  );
}
