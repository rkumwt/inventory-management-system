import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** IDs of the events this service has already handled (the "inbox"). */
@Entity('processed_events')
export class ProcessedEvent {
  @PrimaryColumn('uuid')
  eventId!: string;

  @Column({ type: 'varchar', length: 100 })
  eventName!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  processedAt!: Date;
}
