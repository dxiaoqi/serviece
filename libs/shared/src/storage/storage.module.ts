import {
  DynamicModule,
  Module,
  Provider,
} from '@nestjs/common';
import {
  DEFAULT_STORAGE_OPTIONS,
  STORAGE_OPTIONS,
  STORAGE_PROVIDER,
} from './storage.constants';
import {
  StorageDriver,
  StorageModuleOptions,
} from './storage.types';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { OssStorageProvider } from './providers/oss-storage.provider';

function providerFactory(driver: StorageDriver): Provider {
  return {
    provide: STORAGE_PROVIDER,
    useFactory: (options: StorageModuleOptions) => {
      if (options.driver === 'oss') {
        return new OssStorageProvider(options);
      }
      return new LocalStorageProvider(options);
    },
    inject: [STORAGE_OPTIONS],
  };
}

@Module({})
export class StorageModule {
  static register(options?: Partial<StorageModuleOptions>): DynamicModule {
    const merged: StorageModuleOptions = {
      driver: options?.driver ?? DEFAULT_STORAGE_OPTIONS.driver,
      oss: options?.oss,
    };
    return this.build(merged);
  }

  static registerAsync(
    optionsFactory: () => Partial<StorageModuleOptions> | Promise<Partial<StorageModuleOptions>>,
  ): DynamicModule {
    const optionsProvider: Provider = {
      provide: STORAGE_OPTIONS,
      useFactory: async () => {
        const partial = (await optionsFactory()) ?? {};
        return {
          driver: partial.driver ?? DEFAULT_STORAGE_OPTIONS.driver,
          oss: partial.oss,
        } satisfies StorageModuleOptions;
      },
    };
    return {
      module: StorageModule,
      providers: [optionsProvider, providerFactory('local'), StorageService],
      exports: [StorageService],
      global: true,
    };
  }

  private static build(options: StorageModuleOptions): DynamicModule {
    const optionsProvider: Provider = { provide: STORAGE_OPTIONS, useValue: options };
    return {
      module: StorageModule,
      providers: [optionsProvider, providerFactory(options.driver), StorageService],
      exports: [StorageService],
      global: true,
    };
  }
}
