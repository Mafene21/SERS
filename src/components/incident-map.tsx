"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { divIcon } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { LocateFixed, MapPinOff } from "lucide-react";
import type { Incident } from "@/lib/types";
import { validCoordinates } from "@/lib/utils";
import { PriorityBadge, StatusBadge } from "./ui";

function Bounds({ incidents }: { incidents: Incident[] }) {
  const map = useMap();
  const positions = incidents
    .filter((i) => validCoordinates(i.coordinates))
    .map((i) => i.coordinates as [number, number]);
  const signature = JSON.stringify(positions);
  useEffect(() => {
    const points: [number, number][] = JSON.parse(signature);
    if (points.length === 1) map.setView(points[0], 14);
    else if (points.length > 1)
      map.fitBounds(points, { padding: [45, 45], maxZoom: 14 });
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, signature]);
  return (
    <button
      className="map-recenter"
      aria-label="Recenter on incidents"
      onClick={() => {
        if (positions.length > 0)
          map.fitBounds(positions, { padding: [45, 45], maxZoom: 14 });
        else map.setView([0.333, 32.591], 12);
      }}
    >
      <LocateFixed size={18} />
    </button>
  );
}

const carPath =
  '<path d="m4 10 2-5h12l2 5M3 10h18v7H3z"/><path d="M6 17v3m12-3v3M6 13h2m8 0h2"/>';
const flamePath =
  '<path d="M12 2c1 5 5 5 5 10 2-1 2-3 2-3 5 9-1 13-7 13S2 17 5 11c1 2 2 3 3 3-2-5 3-7 4-12Z"/>';

export default function IncidentMap({ incidents }: { incidents: Incident[] }) {
  const [tileError, setTileError] = useState(false);
  const valid = incidents.filter((i) => validCoordinates(i.coordinates));
  const missing = incidents.length - valid.length;
  return (
    <div className="map-wrapper" role="region" aria-label="Incident map">
      <MapContainer
        center={[0.333, 32.591]}
        zoom={12}
        scrollWheelZoom={false}
        className="incident-map"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={
            process.env.NEXT_PUBLIC_MAP_TILE_URL ||
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          eventHandlers={{
            tileerror: () => setTileError(true),
            tileload: () => setTileError(false),
          }}
        />
        <Bounds incidents={incidents} />
        {valid.map((i) => (
          <Marker
            key={i.id}
            title={`Simulated ${i.reference}: ${i.title}`}
            alt={`Simulated ${i.category}`}
            position={i.coordinates!}
            icon={divIcon({
              className: "custom-marker",
              html: `<span class="map-marker ${i.category === "Fire Outbreak" ? "fire-marker" : "road-marker"}"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${i.category === "Fire Outbreak" ? flamePath : carPath}</svg></span>`,
              iconSize: [37, 42],
              iconAnchor: [18, 40],
              popupAnchor: [0, -38],
            })}
          >
            <Popup>
              <div className="map-popup">
                <span className="eyebrow">SIMULATED · {i.reference}</span>
                <h3>{i.title}</h3>
                <p>{i.location}</p>
                <div className="popup-badges">
                  <StatusBadge status={i.status} />
                  <PriorityBadge priority={i.priority} />
                </div>
                <Link href={`/incidents/${i.id}`} className="text-link">
                  View incident →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <span className="map-training-label">FICTIONAL INCIDENT LOCATIONS</span>
      {tileError && (
        <div className="map-error" role="status">
          Map tiles unavailable. Incident coordinates and details remain
          accessible below.
        </div>
      )}
      {missing > 0 && (
        <div className="map-missing">
          <MapPinOff size={13} />
          {missing} {missing === 1 ? "incident needs" : "incidents need"}{" "}
          confirmed coordinates
        </div>
      )}
    </div>
  );
}
