// The page frame: a rail on the left, the content beside it. With `head`, the page is a
// single document: the heading sits above the text column and the rail starts level
// with the text (.layout.reading in index.css).
export default function PageLayout({ rail, head, children }) {
  if (head) {
    return (
      <div className="layout reading">
        <header className="doc-head">{head}</header>
        <aside className="rail">{rail}</aside>
        <main className="doc-body">{children}</main>
      </div>
    );
  }
  return (
    <div className="layout">
      <aside className="rail">{rail}</aside>
      <main className="page-main">{children}</main>
    </div>
  );
}
