import JoinGroupClient from "@/components/JoinGroupClient";

export default async function JoinGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JoinGroupClient groupId={id} />;
}
