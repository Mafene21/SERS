"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FlaskConical, Plus } from "lucide-react";
import { reportSchema, type ReportInput } from "@/lib/schemas";
import { CATEGORIES, PRIORITIES } from "@/lib/types";
import { Modal } from "./ui";
import { useDemo } from "./demo-provider";

export function SimulateButton() {
  const [open, setOpen] = useState(false);
  const { isAdmin, isDemo } = useDemo();
  if (!isAdmin) return null;
  return (
    <>
      <button className="button primary" onClick={() => setOpen(true)}>
        <Plus size={17} />
        {isDemo ? "Simulate incident" : "Record incident"}
      </button>
      {open && <ReportDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ReportDialog({ onClose }: { onClose: () => void }) {
  const { simulate, isDemo, busy } = useDemo();
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: { category: "Road Accident", priority: "High" },
  });
  async function submit(value: ReportInput) {
    if ((value.latitude == null) !== (value.longitude == null)) {
      setError("Enter both latitude and longitude, or leave both empty.");
      return;
    }
    const result = await simulate(value);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
    router.push(`/incidents/${result.incidentId}`);
  }
  return (
    <Modal
      title={isDemo ? "Simulate an incident" : "Record an incident"}
      description={
        isDemo
          ? "Create a fictional report to try the response workflow."
          : "Record a report for your response team to review and assign."
      }
      onClose={onClose}
    >
      <div className="info-callout">
        <FlaskConical size={18} />
        <span>
          {isDemo
            ? "Training only. This form does not contact emergency services. New reports start without confirmed coordinates."
            : "Check the report details before saving. Coordinates are optional; enter them only when the location has been confirmed."}
        </span>
      </div>
      <form onSubmit={handleSubmit(submit)} className="form-stack">
        <label>
          Incident title
          <input
            {...register("title")}
            placeholder={
              isDemo
                ? "e.g. Training vehicle collision"
                : "e.g. Vehicle collision on Jinja Road"
            }
            aria-invalid={!!errors.title}
          />
          {errors.title && (
            <span className="field-error">{errors.title.message}</span>
          )}
        </label>
        <div className="form-grid">
          <label>
            Category
            <select {...register("category")}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select {...register("priority")}>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Location label
          <input
            {...register("location")}
            placeholder={
              isDemo ? "e.g. Kampala training area" : "e.g. Jinja Road, Nakawa"
            }
            aria-invalid={!!errors.location}
          />
          {errors.location && (
            <span className="field-error">{errors.location.message}</span>
          )}
        </label>
        {!isDemo && (
          <div className="form-grid">
            <label>
              Latitude
              <input
                type="number"
                step="any"
                min={-90}
                max={90}
                {...register("latitude", {
                  setValueAs: (v) => (v === "" ? null : Number(v)),
                })}
              />
              {errors.latitude && (
                <span className="field-error">{errors.latitude.message}</span>
              )}
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="any"
                min={-180}
                max={180}
                {...register("longitude", {
                  setValueAs: (v) => (v === "" ? null : Number(v)),
                })}
              />
              {errors.longitude && (
                <span className="field-error">{errors.longitude.message}</span>
              )}
            </label>
          </div>
        )}
        <label>
          Description
          <textarea
            {...register("description")}
            rows={3}
            placeholder={
              isDemo
                ? "Describe the fictional incident…"
                : "Describe the incident and help required…"
            }
            aria-invalid={!!errors.description}
          />
          {errors.description && (
            <span className="field-error">{errors.description.message}</span>
          )}
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={busy || isSubmitting}
          >
            {isSubmitting
              ? "Saving…"
              : isDemo
                ? "Create training incident"
                : "Save incident"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
