import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "7");

  try {
    const assignments = await prisma.dailyAssignment.findMany({
      orderBy: { date: "desc" },
      take: limit,
      include: { responses: true },
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("[assignments] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assignmentId, response, channel, date } = body;

    if (!response || !["accept", "skip"].includes(response)) {
      return NextResponse.json({ error: "Invalid response. Must be 'accept' or 'skip'" }, { status: 400 });
    }

    // Find assignment by ID or by today's date
    let assignment;
    if (assignmentId) {
      assignment = await prisma.dailyAssignment.findUnique({ where: { id: assignmentId } });
    } else if (date) {
      const targetDate = new Date(date);
      const dateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      assignment = await prisma.dailyAssignment.findUnique({ where: { date: dateOnly } });
    } else {
      // Default to today
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      assignment = await prisma.dailyAssignment.findUnique({ where: { date: today } });
    }

    if (!assignment) {
      return NextResponse.json({ error: "No assignment found" }, { status: 404 });
    }

    // Update assignment status and create response record
    const [updated] = await prisma.$transaction([
      prisma.dailyAssignment.update({
        where: { id: assignment.id },
        data: {
          status: response === "accept" ? "accepted" : "skipped",
          respondedAt: new Date(),
        },
      }),
      prisma.assignmentResponse.create({
        data: {
          assignmentId: assignment.id,
          response,
          channel: channel || "app",
        },
      }),
    ]);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[assignments] POST error:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}
