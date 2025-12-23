<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Force JSON responses for API requests.
 *
 * This middleware ensures that:
 * 1. All API requests have Accept: application/json header
 * 2. PHP errors are caught and returned as JSON instead of HTML
 */
class ForceJsonResponse
{
  /**
   * Handle an incoming request.
   *
   * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
   */
  public function handle(Request $request, Closure $next): Response
  {
    if ($this->allowsHtmlResponse($request)) {
      return $next($request);
    }

    // Force the Accept header to application/json for API requests
    $request->headers->set('Accept', 'application/json');

    // Set up an error handler to catch PHP errors and convert to JSON
    set_error_handler(function ($severity, $message, $file, $line) {
      throw new \ErrorException($message, 0, $severity, $file, $line);
    });

    try {
      $response = $next($request);

      // Check if response is HTML when it should be JSON (catch PHP errors that slip through)
      $content = $response->getContent();
      if ($content && $this->isHtmlResponse($content) && $response->headers->get('Content-Type') !== 'application/json') {
        // This is likely a PHP error that was rendered as HTML
        // Use JsonResponse directly for bootstrap safety
        $debug = env('APP_DEBUG', false) ? $this->extractErrorFromHtml($content) : null;
        return new JsonResponse([
          'message' => 'Server error: The server returned an HTML response instead of JSON. Please check the backend logs.',
          'debug' => $debug,
        ], 500);
      }

      return $response;
    } catch (\Throwable $e) {
      // Catch any errors and return as JSON
      // Use JsonResponse directly for bootstrap safety
      $isDebug = env('APP_DEBUG', false);
      return new JsonResponse([
        'message' => $e->getMessage() ?: 'An unexpected error occurred',
        'exception' => $isDebug ? get_class($e) : null,
        'file' => $isDebug ? $e->getFile() : null,
        'line' => $isDebug ? $e->getLine() : null,
      ], 500);
    } finally {
      restore_error_handler();
    }
  }

  /**
   * Check if the response content appears to be HTML.
   */
  private function isHtmlResponse(string $content): bool
  {
    $trimmed = trim($content);
    return str_starts_with($trimmed, '<') ||
      str_starts_with($trimmed, '<!') ||
      str_contains($content, '<br') ||
      str_contains($content, '<b>') ||
      str_contains($content, '</html>');
  }

  private function allowsHtmlResponse(Request $request): bool
  {
    if ($request->query('format') === 'html') {
      return true;
    }

    return $request->is(
      'api/projects/*/rasp/runs/*/report',
      'api/projects/*/rasp/runs/*/report/view',
      'api/projects/*/runs/*/report',
      'api/projects/*/runs/*/tasks/*/download-html',
      'api/projects/*/sast/runs/*/download-html'
    );
  }

  /**
   * Try to extract error message from HTML response.
   */
  private function extractErrorFromHtml(string $content): ?string
  {
    // Try to extract error message from PHP error HTML
    if (preg_match('/<b>([^<]+)<\/b>:\s*([^<]+)/', $content, $matches)) {
      return trim($matches[1] . ': ' . $matches[2]);
    }

    // Try to extract from Laravel/Symfony error page
    if (preg_match('/<title>([^<]+)<\/title>/', $content, $matches)) {
      return trim($matches[1]);
    }

    // Return first 200 chars of content as fallback
    return substr(strip_tags($content), 0, 200);
  }
}
