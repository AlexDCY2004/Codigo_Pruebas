export default function EmptyState({ icon, title, description }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state__icon">{icon}</div>}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
    </div>
  );
}
