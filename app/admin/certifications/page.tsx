import CertificationsAdminClient from "./CertificationsAdminClient";
import { getAllCertificationsForAdmin } from "@/lib/data/certifications";
import DemoToggle from "@/components/admin/DemoToggle";
import { isDemoCertification } from "@/lib/admin-ops/demo";

// Retest Admin del 12/11/2026: certificazioni di centri o attività di prova
// nascoste di default, come nella card di Oggi; visibili con ?demo=1.
export default async function AdminCertificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const showDemo = sp.demo === "1";
  const all = await getAllCertificationsForAdmin();
  const certifications = showDemo ? all : all.filter((c) => !isDemoCertification(c));
  return (
    <div>
      <DemoToggle hidden={all.length - certifications.length} showing={showDemo} showHref="/admin/certifications?demo=1" hideHref="/admin/certifications" />
      <CertificationsAdminClient initialCertifications={certifications} />
    </div>
  );
}
