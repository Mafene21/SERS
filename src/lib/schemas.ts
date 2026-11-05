import { z } from "zod";
import { CATEGORIES, PRIORITIES } from "./types";

export const noteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(3, "Write at least 3 characters.")
    .max(1000, "Keep notes under 1,000 characters."),
});
export const reportSchema = z.object({
  title: z.string().trim().min(5, "Use at least 5 characters.").max(100),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  location: z.string().trim().min(3, "Enter a location label.").max(150),
  description: z
    .string()
    .trim()
    .min(10, "Use at least 10 characters.")
    .max(2000),
});
export type ReportInput = z.infer<typeof reportSchema>;
