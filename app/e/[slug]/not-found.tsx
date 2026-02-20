import Link from "next/link";

export default function EventNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <h1 className="text-xl font-semibold text-gray-900">Event Not Found</h1>
      <p className="mt-2 text-gray-600">The event you’re looking for doesn’t exist or was removed.</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Go home
      </Link>
    </div>
  );
}
