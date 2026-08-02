import { prisma } from "../../lib/prisma";
import { IReview } from "./review.interface";

const createReviewIntoDB = async (
  tenantId: string,
  rentalRequestId: string,
  payload: IReview,
) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    const rentalRequest = await tx.rentalRequest.findFirstOrThrow({
      where: {
        id: rentalRequestId,
        tenantId,
      },
    });

    if (rentalRequest?.status !== "COMPLETED") {
      throw new Error("You are not allowed to review yet!");
    }

    if (payload.rating < 1 || payload.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const result = await tx.review.create({
      data: {
        tenantId,
        propertyId: rentalRequest.propertyId,
        rentalRequestId,
        ...payload,
      },
    });

    return result;
  });

  return transactionResult;
};

const isReviewExists = async (rentalRequestId: string) => {
  const review = await prisma.review.findFirst({
    where: {
      rentalRequestId,
    },
  });
  return !!review;
};

export const reviewService = {
  createReviewIntoDB,
  isReviewExists,
};
