// src/@types/api.d.ts
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string | undefined;
  data?: T | undefined;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPage?: number;
    cached?: boolean;
  } | undefined;
  errors?: string[];
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}
