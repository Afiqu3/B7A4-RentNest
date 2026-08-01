import { z } from "zod";
import {
  loginUserSchema,
  registerUserSchema,
  updateProfileSchema,
} from "./auth.validation";

export type IRegisterUserPayload = z.infer<typeof registerUserSchema>;
export type ILoginUser = z.infer<typeof loginUserSchema>;
export type IUserUpdatedPayload = z.infer<typeof updateProfileSchema>;

export interface IUserQuery {
  page?: string;
  limit?: string;
}