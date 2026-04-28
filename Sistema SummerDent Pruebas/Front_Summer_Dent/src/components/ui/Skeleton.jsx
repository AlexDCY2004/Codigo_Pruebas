export default function Skeleton({ height = 16, width = '100%' }) {
  return <div className="ui-skeleton" style={{ height, width }} aria-hidden="true" />;
}
