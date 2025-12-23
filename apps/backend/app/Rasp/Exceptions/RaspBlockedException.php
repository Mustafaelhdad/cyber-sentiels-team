<?php

namespace App\Rasp\Exceptions;

use App\Rasp\RaspEvent;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Exception thrown when RASP blocks a suspicious operation.
 */
class RaspBlockedException extends HttpException
{
  public function __construct(
    string $message,
    public readonly RaspEvent $raspEvent,
    ?\Throwable $previous = null,
  ) {
    parent::__construct(
      statusCode: 403,
      message: $message,
      previous: $previous,
      headers: [
        'X-RASP-Blocked' => 'true',
        'X-Trace-Id' => $raspEvent->traceId,
      ],
    );
  }

  /**
   * Get the RASP event that triggered the block.
   */
  public function getRaspEvent(): RaspEvent
  {
    return $this->raspEvent;
  }

  /**
   * Get the detection type that triggered the block.
   */
  public function getDetectionType(): ?string
  {
    return $this->raspEvent->detectionType;
  }
}
