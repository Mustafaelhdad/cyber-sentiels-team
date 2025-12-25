import { SiemDashboard } from "@/components/siem";

export default function Monitoring() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Monitoring & IR
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Real-time security monitoring, log analysis, and automated incident
          response workflows.
        </p>
      </div>

      <SiemDashboard />
    </div>
  );
}
