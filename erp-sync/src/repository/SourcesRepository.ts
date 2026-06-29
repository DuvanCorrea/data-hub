import { pool } from '../db';
import type { ErpSource } from '../types';

export class SourcesRepository {
  async findAll(): Promise<ErpSource[]> {
    const { rows } = await pool.query<ErpSource>(
      'SELECT * FROM erpsync_sources ORDER BY id ASC',
    );
    return rows;
  }

  async findByName(sourceName: string): Promise<ErpSource | null> {
    const { rows } = await pool.query<ErpSource>(
      'SELECT * FROM erpsync_sources WHERE source_name = $1',
      [sourceName],
    );
    return rows[0] ?? null;
  }

  async findById(id: number): Promise<ErpSource | null> {
    const { rows } = await pool.query<ErpSource>(
      'SELECT * FROM erpsync_sources WHERE id = $1',
      [id],
    );
    return rows[0] ?? null;
  }

  async setActive(id: number, isActive: boolean): Promise<ErpSource | null> {
    const { rows } = await pool.query<ErpSource>(
      `UPDATE erpsync_sources
          SET is_active = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *`,
      [isActive, id],
    );
    return rows[0] ?? null;
  }
}
