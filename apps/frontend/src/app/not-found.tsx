import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="text-center p-8">
        <h1 className="text-6xl font-bold text-text-primary mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-text-secondary mb-4">
          Page Not Found
        </h2>
        <p className="text-text-tertiary mb-8">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
