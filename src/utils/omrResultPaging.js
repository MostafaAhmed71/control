const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const retryable = (error, status) => status >= 500 || ['57014', '08000', '08006'].includes(error?.code)
  || /timeout|canceling statement|failed to fetch|network|quic|aborted|load failed|connection/i.test(error?.message || '');

/** Keep full result data, but never scan earlier JSONB records with OFFSET. */
export async function fetchOmrResultPages(client, options = {}) {
  let pageSize = Math.max(1, Math.min(options.pageSize ?? 10, 50));
  const maxRows = options.maxRows ?? 25000;
  const maxAttempts = options.maxAttempts ?? 5;
  const sleep = options.sleep || wait;
  const mapRow = options.mapRow || ((row) => ({ id: row.id, ...row.data }));
  const all = [];
  let cursor = options.afterId ?? null;

  while (all.length < maxRows) {
    let lastError;
    let rows;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const limit = Math.min(pageSize, maxRows - all.length);
      let query = client.from('omr_results').select(options.select || 'id, data').order('id', { ascending: true }).limit(limit);
      if (options.examId) query = query.eq('data->>examId', String(options.examId));
      if (cursor !== null) query = query.gt('id', cursor);
      const { data, error, status } = await query;
      if (!error) {
        rows = data || [];
        if (rows.length && (rows.at(-1).id == null || rows.at(-1).id === cursor)) {
          throw new Error('OMR result pagination did not advance');
        }
        // Advance using the database ID, before mapping payload IDs over it.
        if (rows.length) cursor = rows.at(-1).id;
        all.push(...rows.map(mapRow));
        if (rows.length < limit) return all;
        break;
      }
      lastError = error;
      if (!retryable(error, status) || attempt === maxAttempts - 1) break;
      // Retry the same cursor without skipping any records.
      pageSize = Math.max(1, Math.floor(pageSize / 2));
      await sleep(600 * (attempt + 1));
    }
    if (!rows) {
      if (options.partialOnError && all.length) {
        all._partialFetch = true;
        return all;
      }
      throw Object.assign(new Error(lastError?.message || 'Unable to load OMR results'), { code: lastError?.code });
    }
    await sleep(options.pageDelayMs ?? 120);
  }
  return all;
}
