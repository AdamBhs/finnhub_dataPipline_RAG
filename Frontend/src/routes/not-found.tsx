import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">404</h1>
      <p className="text-gray-500 dark:text-gray-400">Page not found.</p>
      <Link to="/" className="text-sm font-medium text-blue-600 dark:text-blue-400">
        Go home
      </Link>
    </section>
  )
}
