import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const configs = await prisma.householdConfig.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(configs);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const config = await prisma.householdConfig.create({
    data: {
      name: body.name,
      scenario: body.scenario,
      headcount: body.headcount || 1,
      notes: body.notes,
      isDefault: body.isDefault || false,
    },
  });

  return NextResponse.json(config, { status: 201 });
}
