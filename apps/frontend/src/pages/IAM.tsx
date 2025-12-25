import { IamDashboard } from "@/components/iam";

export default function IAM() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Identity & Access Management
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Comprehensive identity management with authentication, authorization,
          audit compliance, and automated account provisioning.
        </p>
      </div>

      <IamDashboard />
    </div>
  );
}
