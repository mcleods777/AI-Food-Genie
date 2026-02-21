import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auditType = body.type || "full_audit";

  const now = new Date();
  const allItems = await prisma.pantryItem.findMany();

  const findings: {
    expired: { id: string; name: string; expirationDate: string }[];
    expiringSoon: { id: string; name: string; expirationDate: string; daysLeft: number }[];
    needsRestock: { id: string; name: string; quantity: number; unit: string }[];
    lowQuantity: { id: string; name: string; quantity: number; unit: string }[];
    totalItems: number;
  } = {
    expired: [],
    expiringSoon: [],
    needsRestock: [],
    lowQuantity: [],
    totalItems: allItems.length,
  };

  for (const item of allItems) {
    if (item.expirationDate) {
      const expDate = new Date(item.expirationDate);
      const daysUntilExpiry = Math.floor(
        (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiry < 0) {
        findings.expired.push({
          id: item.id,
          name: item.name,
          expirationDate: item.expirationDate.toISOString(),
        });
      } else if (daysUntilExpiry <= 7) {
        findings.expiringSoon.push({
          id: item.id,
          name: item.name,
          expirationDate: item.expirationDate.toISOString(),
          daysLeft: daysUntilExpiry,
        });
      }
    }

    if (item.needsRestock) {
      findings.needsRestock.push({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      });
    }

    // Flag items with quantity <= 1 (except spices, etc.)
    if (item.quantity <= 1 && !["Spice"].includes(item.category)) {
      findings.lowQuantity.push({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      });
    }
  }

  // Mark expired items as needing restock
  await Promise.all(
    findings.expired.map((item) =>
      prisma.pantryItem.update({
        where: { id: item.id },
        data: { needsRestock: true },
      })
    )
  );

  const summary = [
    `Total items: ${findings.totalItems}`,
    `Expired: ${findings.expired.length}`,
    `Expiring within 7 days: ${findings.expiringSoon.length}`,
    `Flagged for restock: ${findings.needsRestock.length}`,
    `Low quantity: ${findings.lowQuantity.length}`,
  ].join(". ");

  const audit = await prisma.auditLog.create({
    data: {
      type: auditType,
      summary,
      details: JSON.stringify(findings),
    },
  });

  return NextResponse.json({ audit, findings });
}
