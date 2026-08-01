import { prisma } from "../../lib/prisma";
import {
  IRentalRequest,
  IRentalRequestQuery,
  IRentalRequestUpdate,
} from "./rentalRequest.interface";

const createRentalRequestIntoDB = async (
  propertyId: string,
  tenantId: string,
  payload: IRentalRequest,
) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    const property = await tx.property.findUniqueOrThrow({
      where: {
        id: propertyId,
      },
    });

    const existingOpen = await tx.rentalRequest.findFirst({
      where: {
        tenantId,
        propertyId,
        status: { in: ["PENDING", "APPROVED", "ACTIVE"] },
      },
    });

    if (existingOpen) {
      throw new Error("You already have an active request for this property.");
    }

    const moveInDate = new Date(payload.moveInDate);
    const durationMonths = payload.durationMonths ?? 1;

    if (!Number.isInteger(durationMonths) || durationMonths < 1) {
      throw new Error("durationMonths must be a whole number of at least 1.");
    }

    const endDate = new Date(moveInDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    const result = await tx.rentalRequest.create({
      data: {
        moveInDate,
        durationMonths,
        endDate,
        propertyId,
        tenantId,
      },
    });

    await tx.payment.create({
      data: {
        amount: property.rentAmount,
        rentalRequestId: result.id,
        tenantId: tenantId,
      },
    });
    return result;
  });

  return transactionResult;
};

const updateRentalRequestStatusIntoDB = async (
  landlordId: string,
  requestId: string,
  payload: IRentalRequestUpdate,
) => {
  const request = await prisma.rentalRequest.findUniqueOrThrow({
    where: {
      id: requestId,
    },
    include: {
      property: true,
    },
  });

  if (request.property.landlordId !== landlordId) {
    throw new Error("You are not allowed to update this request");
  }

  if (payload.status !== "APPROVED" && payload.status !== "REJECTED") {
    throw new Error("Invalid status update. Must be APPROVED or REJECTED.");
  }

  const result = await prisma.rentalRequest.update({
    where: {
      id: requestId,
    },
    data: {
      status: payload.status,
    },
  });

  return result;
};

const getAllRentalRequestFromDB = async (query: IRentalRequestQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const rentalRequests = await prisma.rentalRequest.findMany({
    take: limit,
    skip: skip,

    include: {
      property: {
        select: {
          title: true,
          location: true,
          rentAmount: true,
          landlord: {
            select: {
              name: true,
              email: true,
              phone: true,
            }
          }
        },
      },
      tenant: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
      payment: {
        select: {
          status: true,
        },
      },
    },
  });

  const totalRentalRequests = await prisma.rentalRequest.count();

  return {
    data: rentalRequests,
    meta: {
      page: page,
      limit: limit,
      total: totalRentalRequests,
      totalPages: Math.ceil(totalRentalRequests / limit),
    },
  };
};

const getMyRenalRequestFromDB = async (landlordId: string) => {
  const result = await prisma.rentalRequest.findMany({
    where: {
      property: {
        landlordId,
      },
    },
    include: {
      property: true,
      tenant: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  return result;
};

const getMyRequestFromDB = async (tenantId: string) => {
  const result = await prisma.rentalRequest.findMany({
    where: {
      tenantId,
    },
    include: {
      property: true,
    },
  });

  return result;
};

const expireOverdueRentals = async () => {
  const now = new Date();

  const overdue = await prisma.rentalRequest.findMany({
    where: {
      status: "ACTIVE",
      endDate: {
        not: null,
        lt: now,
      },
    },
    select: {
      id: true,
      propertyId: true,
    },
  });

  let completed = 0;

  for (const rental of overdue) {
    await prisma.$transaction(async (tx) => {
      await tx.rentalRequest.update({
        where: {
          id: rental.id,
        },
        data: {
          status: "COMPLETED",
        },
      });

      await tx.property.updateMany({
        where: {
          id: rental.propertyId,
          status: "RENTED",
        },
        data: {
          status: "AVAILABLE",
        },
      });
    });

    completed += 1;
  }

  return {
    scanned: overdue.length,
    completed,
  };
};

export const rentalRequestService = {
  createRentalRequestIntoDB,
  updateRentalRequestStatusIntoDB,
  getAllRentalRequestFromDB,
  getMyRenalRequestFromDB,
  getMyRequestFromDB,
  expireOverdueRentals,
};
