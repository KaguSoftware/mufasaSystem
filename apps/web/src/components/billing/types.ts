export type PlanView = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  seats: number;
  periodDays: number;
  features: string[];
  cardAvailable: boolean;
};

export type LearnerOption = { id: string; name: string };

export type BankInfo = {
  iban: string;
  accountName: string;
  bankName: string;
  instructions: string;
  whatsapp: string;
};
