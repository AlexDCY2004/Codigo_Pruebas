export default function Card({ title, description, children }) {
  return (
    <article className="ui-card">
      {title ? <h3 className="ui-card__title">{title}</h3> : null}
      {description ? <p className="ui-card__description">{description}</p> : null}
      <div>{children}</div>
    </article>
  );
}
