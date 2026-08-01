import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { rentalRequestService } from "./rentalRequest.service";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";

const createRentalRequest = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const propertyId = req.params?.propertyId as string;
    const tenantId = req.user?.id as string;
    const payload = req.body;

    const result = await rentalRequestService.createRentalRequestIntoDB(
      propertyId,
      tenantId,
      payload,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Rental request submitted successfully",
      data: result,
    });
  },
);

const updateRentalRequestStatus = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const landlordId = req.user?.id as string;
    const requestId = req.params?.requestId as string;
    const payload = req.body;

    const result = await rentalRequestService.updateRentalRequestStatusIntoDB(
      landlordId,
      requestId,
      payload,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Rental request status updated successfully",
      data: result,
    });
  },
);

const getAllRentalRequest = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const query = req.query;

    const result = await rentalRequestService.getAllRentalRequestFromDB(query);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "All rental request retrieved successfully",
      data: result.data,
      meta: result.meta,
    });
  },
);

const getMyRenalRequest = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const landlordId = req.user?.id as string;

    const result =
      await rentalRequestService.getMyRenalRequestFromDB(landlordId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "My rental request retrieved successfully",
      data: result,
    });
  },
);

const getMyRequest = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.user?.id as string;

    const result = await rentalRequestService.getMyRequestFromDB(tenantId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "My rental request retrieved successfully",
      data: result,
    });
  },
);

export const rentalRequestController = {
  createRentalRequest,
  updateRentalRequestStatus,
  getAllRentalRequest,
  getMyRenalRequest,
  getMyRequest,
};
