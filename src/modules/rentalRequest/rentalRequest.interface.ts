import { RentalRequestStatus } from "../../../generated/prisma/enums";
import { RentalRequestWhereInput } from "../../../generated/prisma/models";

export interface IRentalRequest {
  moveInDate: string;
  durationMonths?: number;
}

export interface IRentalRequestUpdate {
  status: RentalRequestStatus;
}

export interface IRentalRequestQuery extends RentalRequestWhereInput {
  page?: string;
  limit?: string;
}