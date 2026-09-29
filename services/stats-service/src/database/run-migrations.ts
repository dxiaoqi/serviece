import 'reflect-metadata';
import { dataSource } from './data-source';

async function runMigrations(): Promise<void> {
  await dataSource.initialize();
  try {
    const migrations = await dataSource.runMigrations();
    if (migrations.length === 0) {
      console.log('[stats-service] 数据库已是最新，无需执行迁移。');
    } else {
      console.log(
        `[stats-service] 已执行 ${migrations.length} 个迁移：` +
          migrations.map((m) => m.name).join(', '),
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

runMigrations().catch((err) => {
  console.error('[stats-service] 迁移执行失败：', err);
  process.exit(1);
});
