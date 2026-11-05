export default function PitchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-black text-white" style={{ backgroundColor: "#000000" }}>
      {children}
    </div>
  );
}
