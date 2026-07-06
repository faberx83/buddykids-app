import BottomNav from "@/components/BottomNav";
import PhoneShell from "@/components/PhoneShell";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PhoneShell>
      <div className="flex h-full min-h-screen flex-col sm:min-h-0 sm:flex-1">
        <div className="no-scrollbar flex-1 overflow-y-auto">{children}</div>
        <BottomNav />
      </div>
    </PhoneShell>
  );
}
