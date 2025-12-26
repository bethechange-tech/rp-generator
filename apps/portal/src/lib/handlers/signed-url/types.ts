export interface SignedUrlSuccessResponse {
  success: true;
  data: {
    url: string;
    expires_in: number;
    pdf_key: string;
  };
}

export interface SignedUrlErrorResponse {
  success: false;
  error: string;
}

export type SignedUrlResponse = SignedUrlSuccessResponse | SignedUrlErrorResponse;
