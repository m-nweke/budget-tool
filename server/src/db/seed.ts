// Local-dev convenience: creates one enterprise tenant (two departments,
// one department_head with access to the first department only, one
// department_employee whose home department is the first one — enough to
// manually exercise scoping: the head/employee can't see Marketing) and
// one personal tenant (a single 'owner') — enough to manually exercise
// both product experiences without going through registration. Run
// manually via `npm run seed` — never auto-run on server start, so
// re-running the server doesn't silently duplicate rows.
import db from './index';
import userRepository from '../repositories/userRepository';
import tenantRepository from '../repositories/tenantRepository';
import tenantMembershipRepository from '../repositories/tenantMembershipRepository';
import departmentRepository from '../repositories/departmentRepository';
import departmentAccessRepository from '../repositories/departmentAccessRepository';
import bankAccountRepository from '../repositories/bankAccountRepository';
import paycheckRepository from '../repositories/paycheckRepository';
import savingsGoalRepository from '../repositories/savingsGoalRepository';
import debtRepository from '../repositories/debtRepository';
import { hashPassword } from '../utils/password';

const HEAD_EMAIL = 'head@example.com';
const EMPLOYEE_EMAIL = 'employee@example.com';
const PERSONAL_EMAIL = 'personal@example.com';
const DEV_PASSWORD = 'password123';

async function seed(): Promise<void> {
  const existing = userRepository.findByEmail(HEAD_EMAIL);
  if (existing) {
    console.log(`Seed users already exist: ${HEAD_EMAIL}, ${EMPLOYEE_EMAIL}, ${PERSONAL_EMAIL}`);
    return;
  }

  // Hashing has to happen before the transaction (better-sqlite3's
  // db.transaction() wraps a synchronous function), so a failure there
  // never touches the DB and doesn't need to be rolled back.
  const passwordHash = await hashPassword(DEV_PASSWORD);

  // Every insert commits or none do — without this, a crash partway
  // through would leave orphaned rows that a re-run can't detect (it only
  // checks for the head user by email), producing duplicates on retry.
  db.transaction(() => {
    const companyTenant = tenantRepository.create('Acme Co', 'enterprise');
    const engineering = departmentRepository.create('Engineering', companyTenant.id);
    // Marketing exists but neither seeded user has access to it — a
    // manual check that scoping actually hides it, not just that
    // Engineering shows up.
    departmentRepository.create('Marketing', companyTenant.id);

    const head = userRepository.create({ name: 'Dana Head', email: HEAD_EMAIL, password_hash: passwordHash });
    tenantMembershipRepository.create({
      user_id: head.id,
      tenant_id: companyTenant.id,
      role: 'department_head',
      department_id: null,
    });
    departmentAccessRepository.grant(head.id, engineering.id);

    const employee = userRepository.create({
      name: 'Evan Employee',
      email: EMPLOYEE_EMAIL,
      password_hash: passwordHash,
    });
    tenantMembershipRepository.create({
      user_id: employee.id,
      tenant_id: companyTenant.id,
      role: 'department_employee',
      department_id: engineering.id,
    });

    const personalTenant = tenantRepository.create("Pat's Budget", 'personal');
    const personalUser = userRepository.create({
      name: 'Pat Personal',
      email: PERSONAL_EMAIL,
      password_hash: passwordHash,
    });
    tenantMembershipRepository.create({
      user_id: personalUser.id,
      tenant_id: personalTenant.id,
      role: 'owner',
      department_id: null,
    });

    // Phase 2 sample data — enough to manually exercise accounts, a
    // paycheck with mixed split types, a linked savings goal, and a debt
    // without having to create everything by hand first.
    const checking = bankAccountRepository.create(
      { name: 'Checking', type: 'checking', current_balance: 1500 },
      personalTenant.id
    );
    const savings = bankAccountRepository.create(
      { name: 'Savings', type: 'savings', current_balance: 4000 },
      personalTenant.id
    );
    paycheckRepository.create(
      {
        label: 'Paycheck',
        amount: 2000,
        frequency: 'biweekly',
        next_pay_date: '2026-09-01',
        splits: [
          { bank_account_id: savings.id, split_type: 'percentage', value: 20 },
          { bank_account_id: checking.id, split_type: 'fixed', value: 1600 },
        ],
      },
      personalTenant.id
    );
    savingsGoalRepository.create(
      { name: 'Emergency Fund', target_amount: 10000, bank_account_id: savings.id },
      personalTenant.id
    );
    debtRepository.create(
      { name: 'Credit Card', balance: 2500, interest_rate: 21.99, minimum_payment: 75, due_day: 15 },
      personalTenant.id
    );

    console.log('Seeded tenants and users:');
    console.log(`  company:  Acme Co — Engineering (id ${engineering.id}), Marketing (no access granted)`);
    console.log(`  head:     ${HEAD_EMAIL} / ${DEV_PASSWORD}`);
    console.log(`  employee: ${EMPLOYEE_EMAIL} / ${DEV_PASSWORD}`);
    console.log(`  personal: ${PERSONAL_EMAIL} / ${DEV_PASSWORD} (tenant: Pat's Budget)`);
    console.log(`  join code for Acme Co: ${companyTenant.join_code}`);
  })();
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  });
