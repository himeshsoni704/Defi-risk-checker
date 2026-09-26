import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <div className="empty">
        <div className="empty-title">Page not found</div>
        <p>This address does not match any page. The analysis flow starts on the dashboard.</p>
        <div className="row">
          <Link href="/" className="btn btn-primary">
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
