"use client";

import { useState } from "react";
import { Check, Copy, Navigation } from "lucide-react";
import type { Incident } from "@/lib/types";
import { validCoordinates } from "@/lib/utils";

export function LocationActions({
  coordinates,
}: Pick<Incident, "coordinates">) {
  const [message, setMessage] = useState("");
  if (!validCoordinates(coordinates))
    return (
      <p className="location-unavailable">
        Directions and copying will be available when coordinates are confirmed.
      </p>
    );
  const position = `${coordinates[0].toFixed(5)}, ${coordinates[1].toFixed(5)}`;
  const params = new URLSearchParams({
    api: "1",
    destination: coordinates.join(","),
    travelmode: "driving",
  });
  const copied = message === "Coordinates copied.";
  return (
    <div className="location-actions">
      <div className="location-buttons">
        <a
          className="button directions-button"
          href={`https://www.google.com/maps/dir/?${params}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Directions to fictional location (opens Google Maps)"
        >
          <Navigation size={17} /> Directions
        </a>
        <button
          className="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(position);
              setMessage("Coordinates copied.");
            } catch {
              setMessage(
                `Copy unavailable. Select these coordinates: ${position}`,
              );
            }
          }}
        >
          {copied ? <Check size={17} /> : <Copy size={17} />}
          {copied ? "Copied" : "Copy location"}
        </button>
      </div>
      <p className="location-caption">
        Fictional training location · Directions open Google Maps.
      </p>
      <p className="location-feedback" role="status">
        {message}
      </p>
    </div>
  );
}
