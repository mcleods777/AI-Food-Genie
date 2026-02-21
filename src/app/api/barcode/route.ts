import { NextRequest, NextResponse } from "next/server";
import { lookupBarcode, searchProducts } from "@/lib/barcode";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get("code");
  const query = searchParams.get("q");

  // Barcode lookup
  if (barcode) {
    const product = await lookupBarcode(barcode);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found in Open Food Facts database" },
        { status: 404 }
      );
    }
    return NextResponse.json(product);
  }

  // Text search
  if (query) {
    const products = await searchProducts(query, 10);
    return NextResponse.json(products);
  }

  return NextResponse.json(
    { error: "Provide ?code=BARCODE or ?q=search+term" },
    { status: 400 }
  );
}
