import { PageHeader } from "@/components/dashboard-ui";
import { TenantSearch } from "@/components/tenant-search";
import { loadSearchItems } from "@/lib/admin-search";

export default async function AdminSearch() {
  const items = await loadSearchItems();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Search"
        subtitle="Find any tenant or unit across all four communities."
      />
      <TenantSearch items={items} autoFocus limit={60} />
    </div>
  );
}
