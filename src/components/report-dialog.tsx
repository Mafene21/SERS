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
  const { isAdmin } = useDemo();
  if (!isAdmin) return null;
  return (
    <>
      <button className="button primary" onClick={() => setOpen(true)}>
        <Plus size={17} />
        Simulate incident
      </button>
      {open && <ReportDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ReportDialog({ onClose }: { onClose: () => void }) {
  const { simulate } = useDemo();
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: { category: "Road Accident", priority: "High" },
  });
  function submit(value: ReportInput) {
    const result = simulate(value);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
    router.push(`/incidents/${result.incidentId}`);
  }
  return (
    <Modal
      title="Simulate an incident"
      description="Create a fictional report to try the response workflow."
      onClose={onClose}
    >
      <div className="info-callout">
        <FlaskConical size={18} />
        <span>
          Training only. This form does not contact emergency services. New
          reports start without confirmed coordinates.
        </span>
      </div>
      <form onSubmit={handleSubmit(submit)} className="form-stack">
        <label>
          Incident title
          <input
            {...register("title")}
            placeholder="e.g. Training vehicle collision"
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
            placeholder="e.g. Kampala training area"
            aria-invalid={!!errors.location}
          />
          {errors.location && (
            <span className="field-error">{errors.location.message}</span>
          )}
        </label>
        <label>
          Description
          <textarea
            {...register("description")}
            rows={3}
            placeholder="Describe the fictional incident…"
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
          <button className="button primary" type="submit">
            Create training incident
          </button>
        </div>
      </form>
    </Modal>
  );
}
