declare module "finnhub" {
  interface CompanyNews {
    headline: string;
    summary: string;
    source: string;
    url: string;
    datetime: number;
    related: string;
  }

  interface ApiError {
    message?: string;
  }

  interface FinnhubClient {
    companyNews(
      symbol: string,
      from: string,
      to: string,
      callback: (
        error: ApiError | Error | null,
        data: CompanyNews[] | undefined,
        response?: unknown,
      ) => void,
    ): void;
  }

  const finnhub: {
    ApiClient: {
      instance: {
        authentications: Record<string, { apiKey: string }>;
      };
    };
    DefaultApi: new () => FinnhubClient;
  };

  export = finnhub;
}
