export default function Skeleton({ width, height }) {
  return <div className="skeleton" style={{ width: width || '100%', height: height || '1rem' }} />;
}
