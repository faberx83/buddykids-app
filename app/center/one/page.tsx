import Link from "next/link";

// TRAMA ONE — Partner. Sprint 0: shell/foundation. Sprint 1: prima
// funzionalità di business reale (onboarding), collegata da qui.
export default function OneCenterPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>TRAMA ONE — Partner</h1>
      <p>
        <Link href="/center/one/onboarding" style={{ color: "#2E86DE", fontWeight: 600 }}>
          Vai all&apos;onboarding del centro →
        </Link>
      </p>
    </main>
  );
}
