import { notFound } from "next/navigation";
import { activities, defaultWeeks, kids, weeksByActivity } from "@/lib/mock-data";
import PhoneShell from "@/components/PhoneShell";
import BookingClient from "./BookingClient";

export function generateStaticParams() {
  return activities.map((a) => ({ id: a.id }));
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activity = activities.find((a) => a.id === id);
  if (!activity) return notFound();

  const weeks = weeksByActivity[activity.id] ?? defaultWeeks;

  return (
    <PhoneShell>
      <BookingClient activity={activity} weeks={weeks} kids={kids} />
    </PhoneShell>
  );
}
