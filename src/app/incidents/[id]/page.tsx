import { IncidentDetails } from "@/components/incident-details";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IncidentDetails id={id} />;
}
