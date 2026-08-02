import { PropertyWhereInput } from "../../../generated/prisma/models";
import { prisma } from "../../lib/prisma";
import {
  IProperty,
  IPropertyQuery,
  IPropertyUpdate,
} from "./property.interface";

const createPropertyIntoDB = async (landlordId: string, payload: IProperty) => {
  const result = await prisma.property.create({
    data: {
      landlordId,
      ...payload,
    },
    include: {
      category: true,
    },
  });

  return result;
};

const updatePropertyIntoDB = async (
  propertyId: string,
  landlordId: string,
  payload: IPropertyUpdate,
) => {
  const property = await prisma.property.findUniqueOrThrow({
    where: {
      id: propertyId,
    },
  });

  if (property.landlordId !== landlordId) {
    throw new Error("You are not the owner of this property!");
  }

  if (property.deletedAt !== null) {
    throw new Error("Cannot update a deleted property!");
  }

  const result = await prisma.property.update({
    where: {
      id: propertyId,
    },
    data: {
      ...payload,
    },
    include: {
      category: true,
    },
  });

  return result;
};

const deletePropertyFromDB = async (propertyId: string, landlordId: string) => {
  const property = await prisma.property.findUniqueOrThrow({
    where: {
      id: propertyId,
    },
  });

  if (property.landlordId !== landlordId) {
    throw new Error("You are not the owner of this property!");
  }

  await prisma.property.update({
    where: {
      id: propertyId,
    },
    data: {
      deletedAt: new Date(),
      status: "UNAVAILABLE",
    },
  });
};

const getPropertyByIdFromDB = async (propertyId: string) => {
  const result = await prisma.property.findFirstOrThrow({
    where: {
      id: propertyId,
      deletedAt: null,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      landlord: {
        select: {
          name: true,
        },
      },
    },
  });

  if (result.status !== "AVAILABLE") {
    throw new Error("Property is not Available!");
  }

  return result;
};

const getAllMyPropertyFromDB = async (landlordId: string, query: IPropertyQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const properties = await prisma.property.findMany({
    where: {
      landlordId,
      deletedAt: null,
    },
    take: limit,
    skip: skip,
    
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      landlord: {
        select: {
          name: true,
        },
      },
    },
  });

 const totalProperties = await prisma.property.count({
    where: {
      landlordId,
      deletedAt: null,
    },
  });

  return {
    data: properties,
    meta: {
      page: page,
      limit: limit,
      total: totalProperties,
      totalPages: Math.ceil(totalProperties / limit),
    },
  };
};

const getAllAvailablePropertyFromDB = async (query: IPropertyQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const minPrice = query.minPrice ? Number(query.minPrice) : 0;
  const maxPrice = query.maxPrice ? Number(query.maxPrice) : Infinity;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const amenities = query.amenities
    ? JSON.parse(query.amenities as string)
    : null;

  const amenitiesArray = Array.isArray(amenities) ? amenities : [];

  const andConditions: PropertyWhereInput[] = [];

  andConditions.push({
    status: "AVAILABLE",
    deletedAt: null,
  });

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        {
          location: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (query.minPrice || query.maxPrice) {
    andConditions.push({
      rentAmount: {
        gte: minPrice,
        ...(query.maxPrice && { lte: maxPrice }),
      },
    });
  }

  if (query.amenities) {
    andConditions.push({
      amenities: {
        hasSome: amenitiesArray,
      },
    });
  }

  if (query.categoryId) {
    andConditions.push({
      categoryId: query.categoryId,
    });
  }

  const properties = await prisma.property.findMany({
    where: {
      AND: andConditions,
    },

    take: limit,
    skip: skip,

    orderBy: {
      [sortBy]: sortOrder,
    },

    include: {
      category: {
        select: {
          name: true,
        },
      },
      landlord: {
        select: {
          name: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  const totalProperties = await prisma.property.count({
    where: {
      AND: andConditions,
    },
  });

  return {
    data: properties,
    meta: {
      page: page,
      limit: limit,
      total: totalProperties,
      totalPages: Math.ceil(totalProperties / limit),
    },
  };
};

const getAllPropertyFromDB = async (query: IPropertyQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const properties = await prisma.property.findMany({
    take: limit,
    skip: skip,

    include: {
      category: {
        select: {
          name: true,
        },
      },
      landlord: {
        select: {
          name: true,
        },
      },
    },
  });

  const totalProperties = await prisma.property.count();

  return {
    data: properties,
    meta: {
      page: page,
      limit: limit,
      total: totalProperties,
      totalPages: Math.ceil(totalProperties / limit),
    },
  };
};

export const propertyService = {
  createPropertyIntoDB,
  updatePropertyIntoDB,
  deletePropertyFromDB,
  getPropertyByIdFromDB,
  getAllMyPropertyFromDB,
  getAllAvailablePropertyFromDB,
  getAllPropertyFromDB,
};
