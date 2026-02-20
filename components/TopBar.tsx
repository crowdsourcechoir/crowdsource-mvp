import Link from "next/link";

type TopBarProps = {
  title: string;
};

export default function TopBar({ title }: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 flex min-h-[3.5rem] items-center justify-between border-b border-gray-800 bg-[#0c0c0e] px-4 sm:px-6">
      <div className="flex items-center">
        {title ? (
          <h1 className="truncate text-base font-semibold text-white sm:text-lg">{title}</h1>
        ) : (
          <Link href="/admin/events" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Crowdsource Choir" className="h-8 w-auto" />
          </Link>
        )}
      </div>
    </header>
  );
}
