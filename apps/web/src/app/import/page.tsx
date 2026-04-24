import { PageHeader } from "@/components/page-header";
import { ImportWizard } from "@/components/import-wizard";

export default function ImportPage() {
  return (
    <div>
      <PageHeader
        eyebrow="CSV import"
        title="viaduct CSV import"
        description="Map columns, clean encoding, dry-run validation, fuzzy-match stations, and preserve every raw source row before committing."
      />
      <div className="p-5 lg:p-8">
        <ImportWizard />
      </div>
    </div>
  );
}
