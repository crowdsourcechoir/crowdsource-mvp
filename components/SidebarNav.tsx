import Link from "next/link";

export default function SidebarNav() {
  return (
    <nav className="flex flex-col gap-1 p-4">
      <Link
        href="/admin/live"
        className="rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
      >
        Live
      </Link>
      <Link
        href="/admin/events"
        className="rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
      >
        Events
      </Link>
      <Link
        href="/admin/gardens"
        className="rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
      >
        Gardens
      </Link>
      <Link
        href="/admin/composition/brief"
        className="rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
      >
        Composition
      </Link>
    </nav>
  );
}
