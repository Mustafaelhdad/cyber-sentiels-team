<?php

namespace App\Http\Middleware;

use App\Rasp\RaspContext;
use App\Rasp\RaspEvent;
use App\Rasp\RaspService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * RASP Middleware.
 *
 * Captures request context, assigns trace ID, and initializes
 * the RASP context for downstream sink instrumentation.
 */
class RaspMiddleware
{
  public function __construct(
    private readonly RaspService $raspService,
  ) {}

  /**
   * Handle an incoming request.
   */
  public function handle(Request $request, Closure $next): Response
  {
    // Skip if RASP is disabled (default to false for safety)
    if (!config('rasp.enabled', false)) {
      return $next($request);
    }

    // Skip excluded paths
    $excludedPaths = config('rasp.excluded_paths', []);
    $currentPath = '/' . ltrim($request->path(), '/');
    foreach ($excludedPaths as $excluded) {
      if ($currentPath === $excluded || str_starts_with($currentPath, $excluded)) {
        return $next($request);
      }
    }

    // Initialize RASP context
    $context = RaspContext::getInstance();
    $context->initFromRequest($request);

    // Add trace ID to request for downstream use
    $request->attributes->set('rasp_trace_id', $context->getTraceId());

    // Emit request context event (async)
    $this->raspService->emit(RaspEvent::request(
      traceId: $context->getTraceId(),
      requestContext: $context->getRequestContext(),
      identityContext: $context->getIdentityContext(),
    ));

    // Process request
    $response = $next($request);

    // Add trace ID to response headers
    $response->headers->set('X-Trace-Id', $context->getTraceId());

    // Cleanup context after request
    RaspContext::reset();

    return $response;
  }
}
