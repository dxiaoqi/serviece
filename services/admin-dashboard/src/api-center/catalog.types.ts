export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type AuthMode = 'public' | 'bearer';

export type PrimitiveType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array';

export interface FieldSchema {
  type: PrimitiveType;
  format?: string;
  description?: string;
  example?: unknown;
  nullable?: boolean;
  items?: FieldSchema;
  properties?: Record<string, FieldSchema>;
}

export interface EndpointParam {
  name: string;
  required?: boolean;
  description?: string;
  schema: FieldSchema;
  example?: string;
}

export interface Endpoint {
  id: string;
  group: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description?: string;
  auth: AuthMode;
  queryParams?: EndpointParam[];
  body?: {
    required?: boolean;
    schema: FieldSchema;
  };
  data: FieldSchema;
}
