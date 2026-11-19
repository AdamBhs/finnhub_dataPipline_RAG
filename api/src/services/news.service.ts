
import "dotenv/config";
import finnhub from "finnhub";

export interface CompanyNews {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  related: string;
}

function createFinnhubClient() {
  const token = process.env.FINNHUB_TOKEN;

  if (!token) {
    throw new Error("FINNHUB_TOKEN is not configured in .env");
  }

  finnhub.ApiClient.instance.authentications["api_key"].apiKey =
    token;

  return new finnhub.DefaultApi();
}

export function getCompanyNews(
  symbol: string,
  from: string,
  to: string,
): Promise<CompanyNews[]> {
  if (!/^[A-Za-z0-9._:-]+$/.test(symbol)) {
    return Promise.reject(new Error("Invalid company symbol"));
  }

  const isDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

  if (!isDate(from) || !isDate(to) || from > to) {
    return Promise.reject(
      new Error("Invalid date range. Use YYYY-MM-DD."),
    );
  }

  const client = createFinnhubClient();

  return new Promise((resolve, reject) => {
    client.companyNews(symbol, from, to, (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(
        (data ?? []).slice(0, 10).map((item) => ({
          headline: item.headline,
          summary: item.summary,
          source: item.source,
          url: item.url,
          datetime: item.datetime,
          related: item.related,
        })),
      );
    });
  });
}
