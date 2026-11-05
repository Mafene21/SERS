import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <span className="eyebrow">404 · PAGE NOT FOUND</span>
      <h1>Let’s get you back to the workspace.</h1>
      <p>The page you requested does not exist.</p>
      <Link className="button primary" href="/">
        Open dashboard
      </Link>
    </div>
  );
}
