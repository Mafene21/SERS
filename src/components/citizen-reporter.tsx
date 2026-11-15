"use client";

import { Camera, LoaderCircle, Phone, UserRound } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

type Reporter = { name: string; phone: string; hasPhoto: boolean };

export function CitizenReporter({ incidentId }: { incidentId: string }) {
  const [reporter, setReporter] = useState<Reporter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch(`/api/incidents/${incidentId}/reporter`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data: { reporter?: Reporter | null } | null) => {
        if (active) setReporter(data?.reporter ?? null);
      })
      .catch(() => {
        if (active) setReporter(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [incidentId]);

  if (loading)
    return (
      <section className="panel citizen-reporter loading" aria-label="Loading reporter details">
        <LoaderCircle size={17} />
        <span>Loading reporter details…</span>
      </section>
    );
  if (!reporter) return null;

  const phoneLink = reporter.phone.replace(/[^+\d]/g, "");
  return (
    <section className="panel citizen-reporter">
      <div className="panel-heading">
        <div>
          <h2>Citizen reporter</h2>
          <p>Private contact details for this report.</p>
        </div>
        <UserRound size={18} />
      </div>
      <div className="citizen-reporter-body">
        <strong>{reporter.name}</strong>
        <a href={`tel:${phoneLink}`} className="citizen-phone">
          <Phone size={15} />
          {reporter.phone}
        </a>
        {reporter.hasPhoto && (
          <figure className="citizen-photo">
            <Image
              src={`/api/incidents/${incidentId}/reporter-photo`}
              alt="Photograph attached by the citizen reporter"
              width={640}
              height={480}
              unoptimized
            />
            <figcaption>
              <Camera size={14} />
              Citizen photograph
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
