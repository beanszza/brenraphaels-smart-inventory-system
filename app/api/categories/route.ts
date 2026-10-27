export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("searchQuery") || searchParams.get("search") || "";
    const status = searchParams.get("status"); // "Active" | "Inactive" | "All"
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "1000", 10);

    const where: any = {
      CategoryName: {
        notIn: ["Finished Good", "Finished Goods"],
      },
    };

    if (status && status !== "All") {
      where.IsActive = status.toLowerCase() === "active";
    }

    if (searchQuery.trim()) {
      where.OR = [
        { CategoryName: { contains: searchQuery.trim(), mode: "insensitive" } },
        { Description: { contains: searchQuery.trim(), mode: "insensitive" } },
      ];
    }

    const totalCount = await prisma.categories.count({ where });

    const categories = await prisma.categories.findMany({
      where,
      include: {
        _count: {
          select: { Items: true },
        },
      },
      orderBy: {
        CategoryId: "asc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const items = categories.map((cat) => ({
      categoryId: cat.CategoryId,
      categoryName: cat.CategoryName,
      description: cat.Description,
      isActive: cat.IsActive,
      itemCount: cat._count?.Items || 0,
    }));

    return NextResponse.json({
      success: true,
      message: "Successfully retrieved categories.",
      data: {
        items,
        totalCount,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error.", data: null },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { categoryName, description, isActive } = body;

    const trimmedName = (categoryName || "").trim();
    if (!trimmedName) {
      return NextResponse.json(
        { success: false, message: "Category name is required." },
        { status: 400 }
      );
    }

    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return NextResponse.json(
        { success: false, message: "Category name must be between 2 and 50 characters." },
        { status: 400 }
      );
    }

    // Check duplicate name
    const existing = await prisma.categories.findFirst({
      where: {
        CategoryName: {
          equals: trimmedName,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "A category with this name already exists." },
        { status: 400 }
      );
    }

    const newCategory = await prisma.categories.create({
      data: {
        CategoryName: trimmedName,
        Description: (description || "").trim(),
        IsActive: isActive !== false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Category created successfully.",
      data: {
        categoryId: newCategory.CategoryId,
        categoryName: newCategory.CategoryName,
        description: newCategory.Description,
        isActive: newCategory.IsActive,
      },
    });
  } catch (error: any) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create category." },
      { status: 500 }
    );
  }
}
