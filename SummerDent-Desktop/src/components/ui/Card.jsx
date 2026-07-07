export default function Card({ title, description, children }) {
  return (
    <article className="stat-card">
      {title && <h3 className="stat-card__title">{title}</h3>}
      {description && <p className="stat-card__description">{description}</p>}
      {children}
    </article>
  );
}
