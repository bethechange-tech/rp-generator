import { NextRequest } from "next/server";
import { CalculateCostHandler } from "@/lib/handlers";

export async function POST(request: NextRequest) {
  return CalculateCostHandler.handle(request);
}
