export default function Loading() {
  return (
    <div className="page-loading" role="status">
      <div className="skeleton page-skeleton" />
      <span>Loading workspace…</span>
    </div>
  );
}
