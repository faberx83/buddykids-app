import { notFound } from "next/navigation";
import { activities } from "@/lib/mock-data";
import ActivityEditForm from "./ActivityEditForm";

export function generateStaticParams() {
  return activities.map((a) => ({ id: a.id }));
}

export default async function CenterActivityEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activity = activities.find((a) => a.id === id);
  if (!activity) return notFound();

  return <ActivityEditForm activity={activity} />;
}
