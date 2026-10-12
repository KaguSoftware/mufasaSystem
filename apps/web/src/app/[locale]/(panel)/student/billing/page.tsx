import { BillingPage } from "@/components/billing/billing-page";

export default async function StudentBillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return <BillingPage status={status} />;
}
