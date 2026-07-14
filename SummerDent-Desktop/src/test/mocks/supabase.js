import { vi } from 'vitest';

const createMockQueryBuilder = (returnData) => {
  const chainable = {
    data: returnData,
    error: null,
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => Promise.resolve(resolve({ data: chainable.data, error: null })))
  };

  chainable.select = vi.fn().mockReturnValue(chainable);
  chainable.insert = vi.fn().mockReturnValue(chainable);
  chainable.update = vi.fn().mockReturnValue(chainable);
  chainable.delete = vi.fn().mockReturnValue(chainable);

  return chainable;
};

const createMockSupabaseClient = () => {
  const tables = {};

  const mockFrom = (table) => {
    if (!tables[table]) {
      tables[table] = [];
    }

    const query = createMockQueryBuilder();

    query.select = vi.fn().mockImplementation(() => {
      const q = { ...query };
      q.then = vi.fn((resolve) => {
        const filter = q._filter || (() => true);
        const filtered = tables[table].filter(filter);
        const ordered = q._order
          ? [...filtered].sort((a, b) => {
              const dir = q._order.ascending ? 1 : -1;
              return a[q._order.column] > b[q._order.column] ? dir : -dir;
            })
          : filtered;
        return Promise.resolve(resolve({ data: q._single ? ordered[0] ?? null : ordered, error: null }));
      });
      return q;
    };

    q.insert = vi.fn().mockImplementation((values) => {
      const arr = Array.isArray(values) ? values : [values];
      tables[table].push(...arr);
      const q = { ...query };
      q.then = vi.fn((resolve) => Promise.resolve(resolve({ data: arr, error: null })));
      return q;
    });

    q.update = vi.fn().mockImplementation((values) => {
      const q = { ...query };
      q._updateValues = values;
      q.eq = vi.fn().mockImplementation((col, val) => {
        const idx = tables[table].findIndex((r) => r[col] === val);
        if (idx !== -1) tables[table][idx] = { ...tables[table][idx], ...values };
        q.then = vi.fn((resolve) => Promise.resolve(resolve({ data: idx !== -1 ? tables[table][idx] : null, error: null })));
        return q;
      });
      return q;
    });

    q.delete = vi.fn().mockReturnThis();
    q.order = vi.fn().mockImplementation((col, opts) => {
      q._order = { column: col, ascending: opts?.ascending ?? true };
      return q;
    });
    q.limit = vi.fn().mockReturnThis();
    q.then = vi.fn((resolve) => Promise.resolve(resolve({ data: tables[table] || [], error: null })));

    return q;
  };

  const client = {
    from: vi.fn().mockImplementation(mockFrom),
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    }
  };

  return client;
};

export const createMockSupabaseClient = createMockSupabaseClient;
