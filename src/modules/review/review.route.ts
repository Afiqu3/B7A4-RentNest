import { Router } from "express";
import { reviewController } from "./review.controller";
import { auth } from "../../middlewares/auth";
import { Role } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middlewares/validateRequest";
import { createReviewSchema } from "./review.validation";

const router = Router();

router.get(
  "/landlord-reviews",
  auth( Role.LANDLORD),
  reviewController.getReviewsForLandlord,
);

router.post(
  "/:rentalRequestId",
  auth(Role.TENANT),
  validateRequest(createReviewSchema),
  reviewController.createReview,
);

router.get(
  "/:rentalRequestId/exists",
  auth(Role.TENANT),
  reviewController.isReviewExists,
);


export const reviewRouter = router;
