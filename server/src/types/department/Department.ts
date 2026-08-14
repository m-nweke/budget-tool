// Forward-compatibility only: no auth or department scoping is
// implemented yet (see decisions 5, 16). Not exposed via any route.
export interface Department {
  id: number;
  name: string;
}
