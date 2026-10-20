import { useQuery } from "@tanstack/react-query";
import { fetchOverview } from "./api";
import type { Range } from "./schemas";

export function useOverview(range: Range) {
  return useQuery({
    queryKey: ["market", "overview", range],
    queryFn: () => fetchOverview(range),
  });
}
