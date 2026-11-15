"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Camera, Phone, UserRound } from "lucide-react";

type Contact = { name: string; phone: string; hasPhoto: boolean };
export function CitizenReport({ id }: { id: string }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [failed, setFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/incidents/${id}/citizen`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setContact(data.contact);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [id, attempt]);
  if (!contact && !failed) return null;
  return (
    <section className="panel detail-description">
      <h2>
        <UserRound size={18} /> Citizen report
      </h2>
      {failed ? (
        <p role="alert">
          Reporter details could not be loaded.{" "}
          <button className="button" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </p>
      ) : (
        contact && (
          <>
            <p>{contact.name || "Guest reporter"}</p>
            {contact.phone && (
              <p>
                <Phone size={15} />{" "}
                <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>
                  {contact.phone}
                </a>
              </p>
            )}
            {contact.hasPhoto && (
              <div>
                <h3>
                  <Camera size={16} /> Attached photo
                </h3>
                {photoFailed ? (
                  <p role="alert">
                    Photo could not be loaded.{" "}
                    <button
                      className="button"
                      onClick={() => {
                        setPhotoFailed(false);
                        setAttempt((n) => n + 1);
                      }}
                    >
                      Retry photo
                    </button>
                  </p>
                ) : (
                  <Image
                    src={`/api/incidents/${id}/photo?v=${attempt}`}
                    alt="Scene photo supplied by the reporter"
                    width={960}
                    height={640}
                    unoptimized
                    style={{
                      width: "100%",
                      height: "auto",
                      maxHeight: 440,
                      objectFit: "contain",
                      borderRadius: 12,
                    }}
                    onError={() => setPhotoFailed(true)}
                  />
                )}
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
