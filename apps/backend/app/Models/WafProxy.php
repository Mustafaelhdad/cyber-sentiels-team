<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class WafProxy extends Model
{
  use HasFactory;

  /**
   * The attributes that are mass assignable.
   *
   * @var array<int, string>
   */
  protected $fillable = [
    'project_id',
    'name',
    'origin_url',
    'token',
    'status',
    'requests_allowed',
    'requests_blocked',
    'requests_total',
    'last_request_at',
  ];

  /**
   * The attributes that should be cast.
   *
   * @return array<string, string>
   */
  protected function casts(): array
  {
    return [
      'requests_allowed' => 'integer',
      'requests_blocked' => 'integer',
      'requests_total' => 'integer',
      'last_request_at' => 'datetime',
    ];
  }

  /**
   * Status constants.
   */
  public const STATUS_ACTIVE = 'active';
  public const STATUS_PAUSED = 'paused';
  public const STATUS_DISABLED = 'disabled';

  /**
   * Boot the model.
   */
  protected static function boot(): void
  {
    parent::boot();

    static::creating(function (WafProxy $proxy) {
      if (empty($proxy->token)) {
        $proxy->token = self::generateToken();
      }
    });
  }

  /**
   * Generate a unique token.
   */
  public static function generateToken(): string
  {
    do {
      $token = Str::random(32);
    } while (self::where('token', $token)->exists());

    return $token;
  }

  /**
   * Get the project that owns this WAF proxy.
   */
  public function project(): BelongsTo
  {
    return $this->belongsTo(Project::class);
  }

  /**
   * Check if the proxy is active.
   */
  public function isActive(): bool
  {
    return $this->status === self::STATUS_ACTIVE;
  }

  /**
   * Get the WAF URL for this proxy.
   * Uses /waf-flask/{token}/ format for Flask WAF.
   */
  public function getWafUrl(): string
  {
    $baseUrl = config('waf.base_url', config('app.url'));
    $prefix = config('waf.url_prefix', '/waf-flask');
    return rtrim($baseUrl, '/') . $prefix . '/' . $this->token . '/';
  }

  /**
   * Increment allowed requests counter.
   */
  public function incrementAllowed(int $count = 1): void
  {
    $this->increment('requests_allowed', $count);
    $this->increment('requests_total', $count);
    $this->update(['last_request_at' => now()]);
  }

  /**
   * Increment blocked requests counter.
   */
  public function incrementBlocked(int $count = 1): void
  {
    $this->increment('requests_blocked', $count);
    $this->increment('requests_total', $count);
    $this->update(['last_request_at' => now()]);
  }

  /**
   * Reset counters.
   */
  public function resetCounters(): void
  {
    $this->update([
      'requests_allowed' => 0,
      'requests_blocked' => 0,
      'requests_total' => 0,
    ]);
  }

  /**
   * Regenerate the token.
   */
  public function regenerateToken(): string
  {
    $this->token = self::generateToken();
    $this->save();

    return $this->token;
  }

  /**
   * Pause the proxy.
   */
  public function pause(): void
  {
    $this->update(['status' => self::STATUS_PAUSED]);
  }

  /**
   * Activate the proxy.
   */
  public function activate(): void
  {
    $this->update(['status' => self::STATUS_ACTIVE]);
  }

  /**
   * Disable the proxy.
   */
  public function disable(): void
  {
    $this->update(['status' => self::STATUS_DISABLED]);
  }
}
