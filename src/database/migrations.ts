import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// No migrations - schema version 1 creates all tables automatically
// WatermelonDB will create tables based on the schema definition
export const migrations = schemaMigrations({
  migrations: [],
});
