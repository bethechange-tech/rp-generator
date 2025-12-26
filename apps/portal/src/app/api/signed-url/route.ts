import { NextRequest } from "next/server";
import { GetSignedUrlHandler } from "@/lib/handlers";

export async function GET(request: NextRequest) {
  return GetSignedUrlHandler.handle(request);
}

