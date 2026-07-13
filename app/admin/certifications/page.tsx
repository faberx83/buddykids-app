import CertificationsAdminClient from "./CertificationsAdminClient";
import { getAllCertificationsForAdmin } from "@/lib/data/certifications";

export default async function AdminCertificationsPage() {
  const certifications = await getAllCertificationsForAdmin();
  return <CertificationsAdminClient initialCertifications={certifications} />;
}
