import { z } from "zod";
import { PropertyStatus } from "../../../generated/prisma/enums";

export const createPropertySchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "title must be at least 2 characters")
    .max(200),
  description: z
    .string()
    .trim()
    .min(10, "description must be at least 10 characters")
    .max(5000),
  image: z
    .string()
    .trim()
    .min(5, "image must be at least 5 characters")
    .max(500),
  location: z
    .string()
    .trim()
    .min(2, "location must be at least 2 characters")
    .max(200),
  address: z
    .string()
    .trim()
    .min(5, "address must be at least 5 characters")
    .max(300),
  rentAmount: z.number().positive("rentAmount must be a positive number"),
  bedrooms: z.number().int().positive("bedrooms must be a positive integer"),
  bathrooms: z.number().int().positive("bathrooms must be a positive integer"),
  areaSquareFt: z
    .number()
    .positive("areaSquareFt must be a positive number")
    .optional(),
  amenities: z
    .array(z.string().trim().min(1))
    .min(1, "amenities must not be empty"),
  status: z.enum(PropertyStatus),
  categoryId: z.string().min(1, "categoryId is required"),
});

export const updatePropertySchema = createPropertySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "at least one field is required",
  });
