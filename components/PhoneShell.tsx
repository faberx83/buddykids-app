// Wrapper "telefono" usato dalle schermate rivolte ai genitori (mobile-first),
// così le sezioni desktop (/admin, /center) possono avere un layout full-width
// senza essere schiacciate nella cornice da 480px.
export default function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-backdrop">
      <div className="app-shell">{children}</div>
    </div>
  );
}
