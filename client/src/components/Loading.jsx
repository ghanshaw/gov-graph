// The loading spinner (.loader in index.css). The label is not shown, only announced to
// screen readers. `small` is the half-size spinner used inside a document's text.
export default function Loading({ label = 'Loading…', small = false }) {
  return (
    <div className={small ? 'loading small' : 'state loading'} role="status">
      <div className="loader" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
