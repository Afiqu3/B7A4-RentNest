import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { reviewService } from "./review.service";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";

const createReview = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const rentalRequestId = req.params?.rentalRequestId as string;
    const tenantId = req.user?.id as string;
    const payload = req.body;

    const result = await reviewService.createReviewIntoDB(
      tenantId,
      rentalRequestId,
      payload,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Review submitted successfully",
      data: result,
    });
  },
);

const isReviewExists = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const rentalRequestId = req.params?.rentalRequestId as string;

    const result = await reviewService.isReviewExists(rentalRequestId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Review existence check completed successfully",
      data: result,
    });
  },
);

export const reviewController = {
  createReview,
  isReviewExists,
};
