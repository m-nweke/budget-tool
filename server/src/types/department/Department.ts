// Department scoping/routes aren't implemented yet (see decisions 5, 16) —
// only the seed script creates rows so far. Not exposed via any route.
export interface Department {
  id: number;
  name: string;
}
