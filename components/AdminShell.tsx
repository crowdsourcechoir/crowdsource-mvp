import Link from "next/link";
import TopBar from "./TopBar";

type AdminShellProps = {
  children: React.ReactNode;
  title: string;
};

export default function AdminShell({ children, title }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-[#0c0c0e]">
      <TopBar title={title} />
      <main className="flex-1 overflow-auto bg-[#0c0c0e] text-gray-100">
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
