import PartnerOffersAdminClient from "./PartnerOffersAdminClient";
import { getAllPartnerOffersForAdmin } from "@/lib/data/partner-offers";

export default async function AdminPartnerOffersPage() {
  const offers = await getAllPartnerOffersForAdmin();
  return <PartnerOffersAdminClient initialOffers={offers} />;
}
