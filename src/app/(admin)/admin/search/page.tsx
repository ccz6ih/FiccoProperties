import { PageHeader } from "@/components/dashboard-ui";
import { TenantSearch } from "@/components/tenant-search";
import { loadSearchItems, loadWorkSearchItems } from "@/lib/admin-search";

export default async function AdminSearch() {
  const [items, work] = await Promise.all([loadSearchItems(), loadWorkSearchItems()]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Search"
        subtitle="Homes, people, repairs and tasks — across all four communities."
      />
      <TenantSearch items={items} work={work} autoFocus limit={60} />
    </div>
  );
}
