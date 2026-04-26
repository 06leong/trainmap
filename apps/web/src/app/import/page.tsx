import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageHeader } from "@/components/page-header";
import { ImportWizard } from "@/components/import-wizard";
import { getTrainmapRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const repository = getTrainmapRepository();
  const stations = repository ? await repository.listStations() : [];

  return (
    <div>
      <PageHeader
        eyebrow="CSV import"
        title="viaduct CSV import"
        description="Map columns, clean encoding, dry-run validation, fuzzy-match stations, and preserve every raw source row before committing."
      />
      <div className="p-5 lg:p-8">
        {!repository ? <DatabaseSetupNotice /> : <ImportWizard stations={stations} />}
      </div>
    </div>
  );
}
