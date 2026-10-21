import { Module } from '@nestjs/common';

import { MemoryStorageProvider } from './memory-storage.service.js';
import { R2StorageProvider } from './r2-storage.service.js';
import { StorageController } from './storage.controller.js';
import { STORAGE_PROVIDER } from './storage.provider.js';
import type { StorageProvider } from './storage.provider.js';
import { StorageService } from './storage.service.js';

function createStorageProvider(): StorageProvider {
  // Tests always use the in-memory provider so no test can contact real R2.
  if (process.env.NODE_ENV === 'test') {
    return new MemoryStorageProvider();
  }

  return new R2StorageProvider();
}

export { createStorageProvider };

@Module({
  controllers: [StorageController],
  providers: [StorageService, { provide: STORAGE_PROVIDER, useFactory: createStorageProvider }],
  exports: [StorageService],
})
export class StorageModule {}
