import AdminSideNav from "./AdminSideNav";

type AdminShellProps = {
  children: React.ReactNode;
  title: string;
};

export default function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="flex h-dvh overflow-hidden bg-black text-gray-100">
      <AdminSideNav />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-black">
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
