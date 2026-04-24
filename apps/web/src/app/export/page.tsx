import { PageHeader } from "@/components/page-header";
import { ExportDesigner } from "@/components/export-designer";

export default function ExportPage() {
  return (
    <div>
      <PageHeader
        eyebrow="High-resolution PNG export"
        title="Export views"
        description="Configure map-only, stats-only, and poster render pages with dark/light themes, legends, titles, subtitles, and attribution."
      />
      <div className="p-5 lg:p-8">
        <ExportDesigner />
      </div>
    </div>
  );
}
