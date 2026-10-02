import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AccountFitTier } from '../../../common/enums';
import { Account } from './account.entity';

/**
 * An ICP-fit assessment of an account against a specific ICP version. New
 * scores append (history preserved); the latest is the current view. `tier` is
 * derived from `fitScore` in code, not chosen by the model. `matchedSegments`
 * are ICP segment names the account fits, resolved from grounded refs.
 */
@Entity('account_assessments')
export class AccountAssessment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_assessments_workspace')
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Index('ix_assessments_account')
  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  /** Which ICP version this assessment scored against. */
  @Column({ name: 'icp_version', type: 'int' })
  icpVersion!: number;

  /** Model-estimated fit in [0,1]. */
  @Column({ name: 'fit_score', type: 'real' })
  fitScore!: number;

  @Column({ name: 'tier', type: 'text' })
  tier!: AccountFitTier;

  @Column({ name: 'matched_segments', type: 'jsonb', default: [] })
  matchedSegments!: string[];

  @Column({ name: 'rationale', type: 'text' })
  rationale!: string;

  /** Missing info needed to decide with confidence. */
  @Column({ name: 'gaps', type: 'jsonb', default: [] })
  gaps!: string[];

  @Column({ name: 'recommended_next_step', type: 'text' })
  recommendedNextStep!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
