<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
  ->withRouting(
    web: __DIR__ . '/../routes/web.php',
    api: __DIR__ . '/../routes/api.php',
    commands: __DIR__ . '/../routes/console.php',
    health: '/up',
  )
  ->withMiddleware(function (Middleware $middleware) {
    $middleware->api(prepend: [
      \App\Http\Middleware\ForceJsonResponse::class,
      \Illuminate\Cookie\Middleware\EncryptCookies::class,
      \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
      \Illuminate\Session\Middleware\StartSession::class,
      \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
      \App\Http\Middleware\RaspMiddleware::class,
    ]);

    $middleware->alias([
      'abilities' => \Laravel\Sanctum\Http\Middleware\CheckAbilities::class,
      'ability' => \Laravel\Sanctum\Http\Middleware\CheckForAnyAbility::class,
    ]);
  })
  ->withExceptions(function (Exceptions $exceptions) {
    // Force JSON responses for API requests
    $exceptions->shouldRenderJsonWhen(function (Request $request, \Throwable $e) {
      return $request->is('api/*') || $request->expectsJson();
    });

    // Custom rendering for API exceptions
    // Note: We use JsonResponse directly instead of response()->json() helper
    // because the service container may not be fully initialized during early exceptions
    $exceptions->render(function (\Throwable $e, Request $request) {
      if (!$request->is('api/*') && !$request->expectsJson()) {
        return null; // Let Laravel handle non-API exceptions normally
      }

      // Handle validation exceptions
      if ($e instanceof ValidationException) {
        return new JsonResponse([
          'message' => 'Validation failed',
          'errors' => $e->errors(),
        ], 422);
      }

      // Handle not found exceptions
      if ($e instanceof NotFoundHttpException) {
        return new JsonResponse([
          'message' => 'Resource not found',
        ], 404);
      }

      // Handle HTTP exceptions
      if ($e instanceof HttpException) {
        return new JsonResponse([
          'message' => $e->getMessage() ?: 'HTTP Error',
        ], $e->getStatusCode());
      }

      // Handle all other exceptions
      $statusCode = 500;
      if ($e instanceof HttpExceptionInterface) {
        $statusCode = $e->getStatusCode();
      }

      $response = [
        'message' => $e->getMessage() ?: 'Server Error',
      ];

      // Include debug info only in debug mode
      // Note: Use env() directly as config() may not be available during early bootstrap
      if (env('APP_DEBUG', false)) {
        $response['exception'] = get_class($e);
        $response['file'] = $e->getFile();
        $response['line'] = $e->getLine();
        // Don't use collect() as it may not be available
        $response['trace'] = array_slice($e->getTrace(), 0, 10);
      }

      return new JsonResponse($response, $statusCode);
    });
  })->create();
