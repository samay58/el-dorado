import ListingsDashboardClient from '@/components/dashboard/ListingsDashboardClient';

export const metadata = {
  title: 'Listings Dashboard',
};

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-neutral-100">Listings Dashboard</h1>
      <ListingsDashboardClient />
    </section>
  );
} 