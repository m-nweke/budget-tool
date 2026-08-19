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
