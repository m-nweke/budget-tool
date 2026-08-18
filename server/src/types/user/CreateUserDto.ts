// password_hash, not a plaintext password — hashing happens at the call
// site (auth core's hashPassword) so userRepository stays a thin SQL layer
// with no hashing dependency of its own. No role/department_id here — see
// CreateTenantMembershipDto, created as a separate row once the user exists.
export interface CreateUserDto {
  name: string;
  email: string;
  password_hash: string;
}
