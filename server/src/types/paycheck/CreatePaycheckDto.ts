import type { PaycheckFrequency } from './Paycheck';
import type { CreatePaycheckSplitDto } from './CreatePaycheckSplitDto';

export interface CreatePaycheckDto {
  label: string;
  amount: number;
  frequency: PaycheckFrequency;
  next_pay_date: string;
  // Replaced wholesale on every create/update — see paycheckRepository.
  splits: CreatePaycheckSplitDto[];
}
