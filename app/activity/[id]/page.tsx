import { notFound } from "next/navigation";
import { activities } from "@/lib/mock-data";
import PhoneShell from "@/components/PhoneShell";
import DetailClient from "./DetailClient";

export function generateStaticParams() {
  return activities.map((a) => ({ id: a.id }));
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activity = activities.find((a) => a.id === id);
  if (!activity) return notFound();

  return (
    <PhoneShell>
      <DetailClient activity={activity} />
    </PhoneShell>
  );
}
