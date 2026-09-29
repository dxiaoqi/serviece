import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('download_records')
@Index('idx_download_app_key', ['appKey'])
@Index('idx_download_created_at', ['createdAt'])
export class DownloadRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'app_key', length: 64 })
  appKey: string;

  @Column({ length: 16, default: 'unknown' })
  platform: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  version: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 256, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
