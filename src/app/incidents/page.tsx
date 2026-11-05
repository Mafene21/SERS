import { Suspense } from "react";
import { IncidentsPage } from "@/components/pages";
export default function Page() {
  return (
    <Suspense fallback={<div className="skeleton page-skeleton" />}>
      <IncidentsPage />
    </Suspense>
  );
}
