import { NextRequest } from "next/server";
import { ListReceiptsHandler } from "@/lib/handlers";

export async function GET(request: NextRequest) {
  return ListReceiptsHandler.handle(request);
}

