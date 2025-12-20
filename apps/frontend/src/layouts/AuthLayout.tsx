import { Outlet, Link } from "react-router-dom";

const highlights = [
  {
    title: "Project-aware workflows",
    description: "Stay aligned with the project you're securing while you switch contexts.",
  },
  {
    title: "Security automation",
    description: "Schedule scans and monitoring with guardrails built for teams.",
  },
  {
    title: "Role-based controls",
    description: "Manage access confidently with clear, auditable handoffs.",
  },
  {
    title: "Fast onboarding",
    description: "New teammates get up to speed quickly with familiar flows.",
  },
];

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* Brand / message panel (visible on larger screens) */}
        <div className="relative hidden overflow-hidden border-r border-white/10 bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 text-white lg:flex">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white,transparent_30%),radial-gradient(circle_at_80%_10%,white,transparent_25%),radial-gradient(circle_at_40%_80%,white,transparent_20%)]" />

          <div className="relative z-10 flex h-full flex-col p-12">
            <Link
              to="/"
              className="inline-flex items-center text-2xl font-bold tracking-tight text-white"
            >
              Cyber Sentinels
            </Link>

            <div className="mt-16 max-w-xl space-y-6">
              <h2 className="text-3xl font-semibold leading-tight">
                Secure every deployment with confidence
              </h2>
              <p className="text-base text-indigo-100/90">
                Coordinate testing, monitoring, and IAM from one place. Keep projects moving while
                the right safeguards stay in place.
              </p>
            </div>

            <div className="mt-12 grid max-w-xl grid-cols-2 gap-4 text-sm">
              {highlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-50/90">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm text-indigo-50/85">{item.description}</p>
                </div>
              ))}
            </div>

            <p className="mt-auto pt-12 text-sm text-indigo-100/80">
              Purpose-built for teams that ship securely.
            </p>
          </div>
        </div>

        {/* Auth form panel */}
        <div className="flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md space-y-8">
            <Link
              to="/"
              className="flex items-center text-lg font-semibold text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 lg:hidden"
            >
              Cyber Sentinels
            </Link>

            <div className="rounded-2xl border border-gray-200/80 bg-white/90 p-6 shadow-xl backdrop-blur-sm dark:border-gray-700/60 dark:bg-gray-800/90 sm:p-8">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
