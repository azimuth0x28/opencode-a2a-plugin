/**
 * Authentication Interceptor for A2A Client
 * 
 * Adds Bearer token and API key to requests
 */

import { CallInterceptor, BeforeArgs, AfterArgs } from "@a2a-js/sdk/client";

export class AuthInterceptor implements CallInterceptor {
  private token?: string;
  private apiKey?: string;

  constructor(token?: string, apiKey?: string) {
    this.token = token;
    this.apiKey = apiKey;
  }

  async before(args: BeforeArgs): Promise<void> {
    const headers: Record<string, string> = {};
    
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    
    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }
    
    args.options = {
      ...args.options,
      serviceParameters: {
        ...args.options?.serviceParameters,
        ...headers,
      },
    };
  }

  async after(_args: AfterArgs): Promise<void> {
    // No action needed
  }
}
