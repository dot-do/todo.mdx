import * as migration_20251220_192515 from './20251220_192515';

export const migrations = [
  {
    up: migration_20251220_192515.up,
    down: migration_20251220_192515.down,
    name: '20251220_192515'
  },
];
