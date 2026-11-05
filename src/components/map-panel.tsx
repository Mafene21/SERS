"use client";

import dynamic from "next/dynamic";
import type { Incident } from "@/lib/types";
import { Map as MapIcon } from "lucide-react";

const Map = dynamic(() => import("./incident-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <MapIcon size={25} />
      <span>Loading incident map…</span>
    </div>
  ),
});

export function MapPanel({ incidents }: { incidents: Incident[] }) {
  return <Map incidents={incidents} />;
}
