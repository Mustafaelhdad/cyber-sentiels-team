import { useState } from "react";
import {
  useAuthToolSignup,
  useAuthToolSignin,
  useAuthToolVerifyOtp,
  useAuthToolTestFlow,
} from "@/hooks/useApiQueries";

type TestMode = "manual" | "auto";

export function AuthToolTestPanel() {
  const [mode, setMode] = useState<TestMode>("manual");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [token, setToken] = useState("");

  // Results
  const [signupResult, setSignupResult] = useState<string | null>(null);
  const [signinResult, setSigninResult] = useState<string | null>(null);
  const [otpResult, setOtpResult] = useState<string | null>(null);

  // Mutations
  const signupMutation = useAuthToolSignup();
  const signinMutation = useAuthToolSignin();
  const verifyOtpMutation = useAuthToolVerifyOtp();
  const testFlowMutation = useAuthToolTestFlow();

  const handleSignup = async () => {
    try {
      const result = await signupMutation.mutateAsync({ username, password });
      setSignupResult(result.message);
    } catch (error: unknown) {
      const err = error as Error;
      setSignupResult(`Error: ${err.message}`);
    }
  };

  const handleSignin = async () => {
    try {
      const result = await signinMutation.mutateAsync({ username, password });
      setSessionId(result.session_id);
      setSigninResult(`Session ID: ${result.session_id.substring(0, 16)}...`);
      setStep(2);
    } catch (error: unknown) {
      const err = error as Error;
      setSigninResult(`Error: ${err.message}`);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const result = await verifyOtpMutation.mutateAsync({
        session_id: sessionId,
        otp,
      });
      setToken(result.token);
      setOtpResult(`Token received! User: ${result.user}`);
      setStep(3);
    } catch (error: unknown) {
      const err = error as Error;
      setOtpResult(`Error: ${err.message}`);
    }
  };

  const handleAutoTest = async () => {
    if (!username || !password) return;
    await testFlowMutation.mutateAsync({ username, password, otp: "5555" });
  };

  const resetFlow = () => {
    setStep(1);
    setSessionId("");
    setToken("");
    setOtp("");
    setSignupResult(null);
    setSigninResult(null);
    setOtpResult(null);
  };

  const isLoading =
    signupMutation.isPending ||
    signinMutation.isPending ||
    verifyOtpMutation.isPending ||
    testFlowMutation.isPending;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Authentication Test Panel
          </h3>
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setMode("manual")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === "manual"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => setMode("auto")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === "auto"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Auto Test
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {mode === "manual" ? (
          <div className="space-y-6">
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      step >= s
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                    }`}
                  >
                    {s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`w-12 h-0.5 mx-1 ${
                        step > s
                          ? "bg-emerald-500"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Step Labels */}
            <div className="flex justify-center gap-8 text-xs text-gray-500 dark:text-gray-400">
              <span>Sign Up / Sign In</span>
              <span>Verify OTP</span>
              <span>Authenticated</span>
            </div>

            {/* Step 1: Signup/Signin */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {signupResult && (
                  <div
                    className={`p-3 rounded-lg text-sm ${
                      signupResult.startsWith("Error")
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                        : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {signupResult}
                  </div>
                )}

                {signinResult && (
                  <div
                    className={`p-3 rounded-lg text-sm ${
                      signinResult.startsWith("Error")
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                        : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    }`}
                  >
                    {signinResult}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleSignup}
                    disabled={isLoading || !username || !password}
                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                  >
                    {signupMutation.isPending ? "Creating..." : "Sign Up"}
                  </button>
                  <button
                    onClick={handleSignin}
                    disabled={isLoading || !username || !password}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                  >
                    {signinMutation.isPending ? "Signing in..." : "Sign In"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: OTP Verification */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Hint:</strong> The default OTP code is{" "}
                    <code className="px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 rounded">
                      5555
                    </code>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    OTP Code
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter OTP code"
                    maxLength={6}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center text-2xl tracking-widest"
                  />
                </div>

                {otpResult && (
                  <div
                    className={`p-3 rounded-lg text-sm ${
                      otpResult.startsWith("Error")
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                        : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {otpResult}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={resetFlow}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerifyOtp}
                    disabled={isLoading || !otp}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                  >
                    {verifyOtpMutation.isPending
                      ? "Verifying..."
                      : "Verify OTP"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Authenticated */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-emerald-600 dark:text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Authentication Successful!
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    User <strong>{username}</strong> has been authenticated
                  </p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    JWT Token
                  </p>
                  <code className="text-xs text-gray-700 dark:text-gray-300 break-all">
                    {token}
                  </code>
                </div>

                <button
                  onClick={resetFlow}
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                >
                  Test Another User
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Auto Test Mode */
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Run an automated test of the complete authentication flow (signup
              → signin → OTP → token verification).
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Test Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="test_user"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Test Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password123"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              onClick={handleAutoTest}
              disabled={isLoading || !username || !password}
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {testFlowMutation.isPending ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Running Test...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Run Full Test
                </>
              )}
            </button>

            {/* Test Results */}
            {testFlowMutation.data && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  Test Results
                  {testFlowMutation.data.overall_success ? (
                    <span className="px-2 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                      PASSED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                      FAILED
                    </span>
                  )}
                </h4>

                <div className="space-y-2 text-sm">
                  {Object.entries(testFlowMutation.data.test_results).map(
                    ([key, value]) => {
                      if (key === "overall_success" || key === "token")
                        return null;
                      const result = value as { success?: boolean } | null;
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between"
                        >
                          <span className="text-gray-600 dark:text-gray-400 capitalize">
                            {key.replace(/_/g, " ")}
                          </span>
                          {result?.success ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              ✓ Pass
                            </span>
                          ) : result === null ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">
                              ✗ Fail
                            </span>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
