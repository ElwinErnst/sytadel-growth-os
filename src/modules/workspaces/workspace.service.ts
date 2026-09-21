import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Workspace } from './entities/workspace.entity';

/**
 * Workspaces are the isolation boundary. The operator names one on the CLI; we
 * get-or-create it idempotently so concurrent invocations converge on a single
 * row (the unique slug constraint is the source of truth, not a read-check).
 */
@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Workspace)
    private readonly repo: Repository<Workspace>,
  ) {}

  async getOrCreate(slug: string, name?: string): Promise<Workspace> {
    const normalized = slug.trim().toLowerCase();
    const existing = await this.repo.findOne({ where: { slug: normalized } });
    if (existing) return existing;

    try {
      return await this.repo.save(
        this.repo.create({ slug: normalized, name: name ?? normalized }),
      );
    } catch (err) {
      // Lost a create race: another process inserted the same slug. Re-read.
      if (err instanceof QueryFailedError) {
        const found = await this.repo.findOne({
          where: { slug: normalized },
        });
        if (found) return found;
      }
      throw err;
    }
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    return this.repo.findOne({ where: { slug: slug.trim().toLowerCase() } });
  }

  async list(): Promise<Workspace[]> {
    return this.repo.find({ order: { createdAt: 'ASC', id: 'ASC' } });
  }
}
