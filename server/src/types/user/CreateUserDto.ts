// password_hash, not a plaintext password — hashing happens at the call
// site (auth core's hashPassword, in a later story) so userRepository
// stays a thin SQL layer with no hashing dependency of its own.
export interface CreateUserDto {
  name: string;
  email: string;
  role: 'department_head' | 'department_employee';
  department_id: number | null;
  password_hash: string;
}