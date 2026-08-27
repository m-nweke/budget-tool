import db from '../db';
import type { Investment, CreateInvestmentDto } from '../types';

const COLUMNS =
  'id, tenant_id, name, type, current_value, monthly_contribution, contribution_day, bank_account_id, active';

const investmentRepository = {
  findAll(tenantId: number): Investment[] {
    return db.prepare(`SELECT ${COLUMNS} FROM investments WHERE tenant_id = ?`).all(tenantId) as Investment[];
  },

  findById(id: number | string): Investment | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM investments WHERE id = ?`).get(id) as Investment | undefined;
  },

  // Cash-flow simulation only (cashflowRepository) — every active
  // investment with a recurring contribution, same shape as
  // billRepository.findAllActive.
  findAllActive(tenantId: number): Investment[] {
    return db
      .prepare(`SELECT ${COLUMNS} FROM investments WHERE tenant_id = ? AND active = 1`)
      .all(tenantId) as Investment[];
  },

  create(
    { name, type, current_value, monthly_contribution, contribution_day, bank_account_id, active }: CreateInvestmentDto,
    tenantId: number
  ): Investment {
    const result = db
      .prepare(
        'INSERT INTO investments (tenant_id, name, type, current_value, monthly_contribution, contribution_day, bank_account_id, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        tenantId,
        name,
        type,
        current_value ?? 0,
        monthly_contribution ?? null,
        contribution_day ?? null,
        bank_account_id ?? null,
        active === false ? 0 : 1
      );
    return investmentRepository.findById(result.lastInsertRowid as number) as Investment;
  },

  // Same "omitted means leave as-is, explicit null means clear" treatment
  // as billRepository.update for bank_account_id/monthly_contribution/
  // contribution_day.
  update(
    id: number | string,
    { name, type, current_value, monthly_contribution, contribution_day, bank_account_id, active }: CreateInvestmentDto
  ): Investment {
    const existing = investmentRepository.findById(id);
    db.prepare(
      'UPDATE investments SET name = ?, type = ?, current_value = ?, monthly_contribution = ?, contribution_day = ?, bank_account_id = ?, active = ? WHERE id = ?'
    ).run(
      name,
      type,
      current_value ?? existing?.current_value ?? 0,
      monthly_contribution === undefined ? (existing?.monthly_contribution ?? null) : monthly_contribution,
      contribution_day === undefined ? (existing?.contribution_day ?? null) : contribution_day,
      bank_account_id === undefined ? (existing?.bank_account_id ?? null) : bank_account_id,
      active === false ? 0 : 1,
      id
    );
    return investmentRepository.findById(id) as Investment;
  },

  remove(id: number | string): void {
    db.prepare('DELETE FROM investments WHERE id = ?').run(id);
  },
};

export default investmentRepository;
