import { prisma } from "../../lib/prisma";
import { ICategory } from "./category.interface";

const createCategoryIntoDB = async (payload: ICategory) => {
  const result = await prisma.category.create({
    data: {
      ...payload,
    },
  });

  return result;
};

const getAllCategoryFromDB = async () => {
  const result = await prisma.category.findMany({
    where: {
      deletedAt: null,
    },
  });

  return result;
};

const updateCategoryIntoDB = async (categoryId: string, payload: ICategory) => {
  const category = await prisma.category.findUniqueOrThrow({
    where: {
      id: categoryId,
    },
  });

  const result = await prisma.category.update({
    where: {
      id: categoryId,
    },
    data: {
      ...payload,
    },
  });

  return result;
};

const deleteCategoryFromDB = async (categoryId: string) => {
  const category = await prisma.category.findUniqueOrThrow({
    where: {
      id: categoryId,
    },
  });

  await prisma.category.update({
    where: {
      id: categoryId,
    },
    data: {
      deletedAt: new Date(),
    },
  });
};

export const categoryService = {
  createCategoryIntoDB,
  getAllCategoryFromDB,
  updateCategoryIntoDB,
  deleteCategoryFromDB,
};
