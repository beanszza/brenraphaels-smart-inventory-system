export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, message: "Invalid category ID." },
        { status: 400 }
      );
    }

    const category = await prisma.categories.findUnique({
      where: { CategoryId: categoryId },
      include: {
        _count: {
          select: { Items: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, message: "Category not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        categoryId: category.CategoryId,
        categoryName: category.CategoryName,
        description: category.Description,
        isActive: category.IsActive,
        itemCount: category._count?.Items || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, message: "Invalid category ID." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { categoryName, description, isActive } = body;

    const existing = await prisma.categories.findUnique({
      where: { CategoryId: categoryId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Category not found." },
        { status: 404 }
      );
    }

    const updateData: any = {};

    if (categoryName !== undefined) {
      const trimmedName = categoryName.trim();
      if (!trimmedName) {
        return NextResponse.json(
          { success: false, message: "Category name cannot be empty." },
          { status: 400 }
        );
      }
      if (trimmedName.length < 2 || trimmedName.length > 50) {
        return NextResponse.json(
          { success: false, message: "Category name must be between 2 and 50 characters." },
          { status: 400 }
        );
      }

      // Check if another category has the same name
      const duplicate = await prisma.categories.findFirst({
        where: {
          CategoryName: {
            equals: trimmedName,
            mode: "insensitive",
          },
          CategoryId: {
            not: categoryId,
          },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, message: "A category with this name already exists." },
          { status: 400 }
        );
      }

      updateData.CategoryName = trimmedName;
    }

    if (description !== undefined) {
      updateData.Description = description.trim();
    }

    if (isActive !== undefined) {
      updateData.IsActive = Boolean(isActive);
    }

    const updated = await prisma.categories.update({
      where: { CategoryId: categoryId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Category updated successfully.",
      data: {
        categoryId: updated.CategoryId,
        categoryName: updated.CategoryName,
        description: updated.Description,
        isActive: updated.IsActive,
      },
    });
  } catch (error: any) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update category." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(request, { params });
}
