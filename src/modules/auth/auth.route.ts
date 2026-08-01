import { Router } from "express";
import { authController } from "./auth.controller";
import { auth } from "../../middlewares/auth";
import { Role } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middlewares/validateRequest";
import {
  loginUserSchema,
  registerUserSchema,
  updateActiveStatusSchema,
  updateProfileSchema,
} from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validateRequest(registerUserSchema),
  authController.registerUser,
);
router.post("/login", validateRequest(loginUserSchema), authController.loginUser);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout);
router.get(
  "/me",
  auth(Role.TENANT, Role.LANDLORD, Role.ADMIN),
  authController.getMyProfile,
);
router.patch(
  "/my-profile",
  auth(Role.TENANT, Role.LANDLORD, Role.ADMIN),
  validateRequest(updateProfileSchema),
  authController.updateProfile,
);
router.get("/users", auth(Role.ADMIN), authController.getAllUser);
router.put(
  "/users/:userId",
  auth(Role.ADMIN),
  validateRequest(updateActiveStatusSchema),
  authController.updateUsersActiveStatus,
);
router.get("/overview", auth(Role.ADMIN), authController.overview);

export const authRouter = router;
