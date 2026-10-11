import db from '../db';
import type { Investment, CreateInvestmentDto } from '../types';

const COLUMNS =
  'id, tenant_id, name, type, current_value, monthly_contribution, contribution_day, bank_account_id, active';

const investmentRepository = {
  async findAll(tenantId: number): Promise<Investment[]> {
    return (await db.all(`SELECT ${COLUMNS} FROM investments WHERE tenant_id = ?`, tenantId)) as Investment[];
  },

  async findById(id: number | string): Promise<Investment | undefined> {
    return (await db.get(`SELECT ${COLUMNS} FROM investments WHERE id = ?`, id)) as Investment | undefined;
  },

  // Cash-flow simulation only (cashflowRepository) — every active
  // investment, same shape as billRepository.findAllActive. Not filtered to
  // rows with a recurring contribution configured — cashflowRepository
  // itself skips any investment whose monthly_contribution/contribution_day
  // pair is null, since that decision is about what to *project*, not what
  // counts as "active."
  async findAllActive(tenantId: number): Promise<Investment[]> {
    return (await db.all(`SELECT ${COLUMNS} FROM investments WHERE tenant_id = ? AND active = 1`, tenantId)) as Investment[];
  },

  async create(
    { name, type, current_value, monthly_contribution, contribution_day, bank_account_id, active }: CreateInvestmentDto,
    tenantId: number
  ): Promise<Investment> {
    const result = (await db.run('INSERT INTO investments (tenant_id, name, type, current_value, monthly_contribution, contribution_day, bank_account_id, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', tenantId, name, type, current_value ?? 0, monthly_contribution ?? null, contribution_day ?? null, bank_account_id ?? null, active === false ? 0 : 1));
    return (await investmentRepository.findById(result.lastInsertRowid as number)) as Investment;
  },

  // Same "omitted means leave as-is, explicit null means clear" treatment
  // as billRepository.update for bank_account_id/monthly_contribution/
  // contribution_day.
  async update(
    id: number | string,
    { name, type, current_value, monthly_contribution, contribution_day, bank_account_id, active }: CreateInvestmentDto
  ): Promise<Investment> {
    const existing = (await investmentRepository.findById(id));
    (await db.run('UPDATE investments SET name = ?, type = ?, current_value = ?, monthly_contribution = ?, contribution_day = ?, bank_account_id = ?, active = ? WHERE id = ?', name, type, current_value ?? existing?.current_value ?? 0, monthly_contribution === undefined ? (existing?.monthly_contribution ?? null) : monthly_contribution, contribution_day === undefined ? (existing?.contribution_day ?? null) : contribution_day, bank_account_id === undefined ? (existing?.bank_account_id ?? null) : bank_account_id, active === false ? 0 : 1, id));
    return (await investmentRepository.findById(id)) as Investment;
  },

  async remove(id: number | string): Promise<void> {
    (await db.run('DELETE FROM investments WHERE id = ?', id));
  },
};

export default investmentRepository;
