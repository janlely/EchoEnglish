import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from '../schema';

// First, create the adapter to the underlying database
export const adapter = new SQLiteAdapter({
  schema,
});