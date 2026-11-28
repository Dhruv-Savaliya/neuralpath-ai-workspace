import { InternalServerErrorException } from "@nestjs/common";

// Supabase caps rows per response. Use a stable, unique cursor on owner-scoped reads.
export async function readAllPages<T extends { id: string }>(
  fetchPage: (after: string | undefined, limit: number) => PromiseLike<{
    data: T[] | null;
    error: unknown;
  }>,
  failureMessage: string,
): Promise<T[]> {
  const rows: T[] = [];
  const limit = 500;
  let after: string | undefined;
  while (true) {
    const { data, error } = await fetchPage(after, limit);
    if (error || !data) throw new InternalServerErrorException(failureMessage);
    rows.push(...data);
    if (data.length < limit) return rows;
    after = data[data.length - 1].id;
  }
}
