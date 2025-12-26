import { NextRequest, NextResponse } from "next/server";
import { QueryServiceFactory } from "../../config";
import { QueryParser } from "./QueryParser";
import { ResponseBuilder } from "./ResponseBuilder";

export class ListReceiptsHandler {
  static async handle(request: NextRequest): Promise<NextResponse> {
    try {
      const rawQuery = QueryParser.parse(request);
      const query = QueryParser.applyDefaults(rawQuery);

      const queryService = QueryServiceFactory.get();
      const result = await queryService.query(query);

      const response = ResponseBuilder.success(result);
      return NextResponse.json(response);
    } catch (error) {
      console.error("Query error:", error);
      const response = ResponseBuilder.error(error);
      return NextResponse.json(response, { status: 500 });
    }
  }
}
