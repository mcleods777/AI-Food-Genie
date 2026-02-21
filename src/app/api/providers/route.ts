import { NextResponse } from "next/server";
import { getProviderStatus, getProviderForTask } from "@/lib/providers";

export async function GET() {
  const status = getProviderStatus();
  const routing = {
    scan: getProviderForTask("scan"),
    ocr: getProviderForTask("ocr"),
    recipe: getProviderForTask("recipe"),
    suggest: getProviderForTask("suggest"),
  };

  return NextResponse.json({ status, routing });
}
