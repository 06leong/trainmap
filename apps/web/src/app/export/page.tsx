import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageHeader } from "@/components/page-header";
import { ExportDesigner } from "@/components/export-designer";
import { getTrainmapRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function ExportPage() {
  const repository = getTrainmapRepository();

  return (
    <div>
      <PageHeader
        eyebrow="High-resolution PNG export"
        title="Export views"
        description="Configure map-only, stats-only, and poster render pages with dark/light themes, legends, titles, subtitles, and attribution."
      />
      <div className="p-5 lg:p-8">
        {repository ? <ExportDesigner /> : <DatabaseSetupNotice detail="Set DATABASE_URL before creating PNG export jobs." />}
      </div>
    </div>
  );
}
