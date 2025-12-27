import { MonitoringDashboard } from "@/components/monitoring";

export default function Monitoring() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Monitoring & IR
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          SIEM, TIP, and SOAR for log ingestion, threat enrichment, and
          automated response.
        </p>
      </div>

      <MonitoringDashboard />
    </div>
  );
}
