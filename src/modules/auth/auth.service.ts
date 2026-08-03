import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import {
  ILoginUser,
  IRegisterUserPayload,
  IUserQuery,
  IUserUpdatedPayload,
} from "./auth.interface";
import config from "../../config";
import { jwtUtils } from "../../utils/jwt";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import {
  ActiveStatus,
  PropertyStatus,
  RentalRequestStatus,
  Role,
} from "../../../generated/prisma/enums";

const registerUserIntoDB = async (payload: IRegisterUserPayload) => {
  const { name, email, password, phone, role } = payload;

  const isUserExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });
  if (isUserExist) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(
    password,
    Number(config.bcrypt_salt_rounds),
  );

  const createdUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      phone,
      role,
    },
  });
  const user = await prisma.user.findUnique({
    where: {
      id: createdUser.id,
      email: createdUser.email || email,
    },
    omit: {
      password: true,
    },
  });
  return user;
};

const loginUserIntoDB = async (payload: ILoginUser) => {
  const { email, password } = payload;

  const user = await prisma.user.findUniqueOrThrow({
    where: {
      email,
    },
  });

  if (user.activeStatus === "BLOCKED") {
    throw new Error("Your account has been blocked. Please contact support.");
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    throw new Error("Password is incorrect");
  }

  const jwtPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const refreshToken = async (refreshToken: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    refreshToken,
    config.jwt_refresh_secret,
  );

  if (!verifiedRefreshToken.success) {
    throw new Error(verifiedRefreshToken.error);
  }

  const { id } = verifiedRefreshToken.data as JwtPayload;
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id,
    },
  });

  if (user.activeStatus === "BLOCKED") {
    throw new Error("User is blocked!");
  }

  const jwtPayload = {
    id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  return { accessToken };
};

const getMyProfileFromDB = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId,
    },
    omit: {
      password: true,
    },
  });

  return user;
};

const updateProfileIntoDB = async (
  userId: string,
  payload: IUserUpdatedPayload,
) => {
  const { name, phone } = payload;

  const updatedUser = await prisma.user.update({
    where: { id: userId },

    data: {
      name,
      phone,
    },
    omit: {
      password: true,
    },
  });

  return updatedUser;
};

const getAllUserFromDB = async (query: IUserQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  // also add search by name

  const users = await prisma.user.findMany({
    where: {
      role: {
        in: [Role.LANDLORD, Role.TENANT],
      },
      name: {
        contains: query.search ? query.search : "",
        mode: "insensitive",
      },
    },
    omit: {
      password: true,
    },

    take: limit,
    skip: skip,
  });

  const totalUsers = await prisma.user.count();

  return {
    data: users,
    meta: {
      page: page,
      limit: limit,
      total: totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
    },
  };
};

const updateUsersActiveStatusIntoDB = async (
  userId: string,
  activeStatus: ActiveStatus,
) => {
  const updatedUserStatus = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      activeStatus,
    },
  });

  return updatedUserStatus;
};

const overviewService = async () => {
  const totalUsers = await prisma.user.count();
  const totalActiveUsers = await prisma.user.count({
    where: {
      activeStatus: ActiveStatus.ACTIVE,
    },
  });
  const totalBlockedUsers = await prisma.user.count({
    where: {
      activeStatus: ActiveStatus.BLOCKED,
    },
  });
  const totalTenants = await prisma.user.count({
    where: {
      role: Role.TENANT,
    },
  });
  const totalLandlords = await prisma.user.count({
    where: {
      role: Role.LANDLORD,
    },
  });

  const totalProperties = await prisma.property.count();
  const totalRentedProperties = await prisma.property.count({
    where: {
      status: PropertyStatus.RENTED,
    },
  });
  const totalAvailableProperties = await prisma.property.count({
    where: {
      status: PropertyStatus.AVAILABLE,
    },
  });

  const totalPendingRentalRequests = await prisma.rentalRequest.count({
    where: {
      status: RentalRequestStatus.PENDING,
    },
  });
  const totalApprovedRentalRequests = await prisma.rentalRequest.count({
    where: {
      status: RentalRequestStatus.APPROVED,
    },
  });
  const totalRejectedRentalRequests = await prisma.rentalRequest.count({
    where: {
      status: RentalRequestStatus.REJECTED,
    },
  });
  const totalActiveRentalRequests = await prisma.rentalRequest.count({
    where: {
      status: RentalRequestStatus.ACTIVE,
    },
  });
  const totalCompletedRentalRequests = await prisma.rentalRequest.count({
    where: {
      status: RentalRequestStatus.COMPLETED,
    },
  });
  const totalRentalRequests = await prisma.rentalRequest.count();

  return {
    totalUsers,
    totalActiveUsers,
    totalBlockedUsers,
    totalTenants,
    totalLandlords,
    totalProperties,
    totalRentedProperties,
    totalAvailableProperties,
    totalPendingRentalRequests,
    totalApprovedRentalRequests,
    totalRejectedRentalRequests,
    totalActiveRentalRequests,
    totalCompletedRentalRequests,
    totalRentalRequests,
  };
};

const landlordOverviewService = async (landlordId: string) => {
  const totalProperties = await prisma.property.count({
    where: {
      landlordId,
    },
  });
  const totalActiveRequests = await prisma.rentalRequest.count({
    where: {
      property: {
        landlordId,
      },
      status: RentalRequestStatus.ACTIVE,
    },
  });


  return {
    totalProperties,
    totalActiveRequests,
  };
};

export const authService = {
  registerUserIntoDB,
  loginUserIntoDB,
  refreshToken,
  getMyProfileFromDB,
  updateProfileIntoDB,
  getAllUserFromDB,
  updateUsersActiveStatusIntoDB,
  landlordOverviewService,
  overviewService
};
