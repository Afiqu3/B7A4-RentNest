import { Router } from "express";
import { propertyController } from "./property.controller";
import { auth } from "../../middlewares/auth";
import { Role } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middlewares/validateRequest";
import {
  createPropertySchema,
  updatePropertySchema,
} from "./property.validation";

const router = Router();

router.get("/", auth(Role.ADMIN), propertyController.getAllProperty);
router.get(
  "/my-properties",
  auth(Role.LANDLORD),
  propertyController.getAllMyProperty,
);
router.get("/available", propertyController.getAllAvailableProperty);

router.post(
  "/",
  auth(Role.LANDLORD),
  validateRequest(createPropertySchema),
  propertyController.createProperty,
);

router.get("/:propertyId", propertyController.getPropertyById);
router.get(
  "/:propertyId/user",
  auth(Role.TENANT, Role.LANDLORD, Role.ADMIN),
  propertyController.getPropertyByIdUser,
);
router.patch(
  "/:propertyId",
  auth(Role.LANDLORD),
  validateRequest(updatePropertySchema),
  propertyController.updateProperty,
);
router.delete(
  "/:propertyId",
  auth(Role.LANDLORD),
  propertyController.deleteProperty,
);

export const propertyRouter = router;
