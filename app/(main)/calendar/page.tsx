import CalendarClient from "@/components/CalendarClient";
import { bookedDays, eventDays, today } from "@/lib/mock-data";
import { getCenterEnrollmentsForUser, getUpcomingEventsForUser } from "@/lib/data/calendar";

export default async function CalendarPage() {
  const [events, enrollments] = await Promise.all([
    getUpcomingEventsForUser(),
    getCenterEnrollmentsForUser(),
  ]);

  return (
    <CalendarClient
      events={events}
      enrollments={enrollments}
      today={today}
      bookedDays={bookedDays}
      eventDays={eventDays}
    />
  );
}
