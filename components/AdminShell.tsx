import AdminSideNav from "./AdminSideNav";

type AdminShellProps = {
  children: React.ReactNode;
  title: string;
};

export default function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen bg-black text-gray-100">
      <AdminSideNav />
      <main className="min-w-0 flex-1 overflow-auto bg-black">
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
