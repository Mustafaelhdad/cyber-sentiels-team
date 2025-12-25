<?php

return [

  /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

  'postmark' => [
    'token' => env('POSTMARK_TOKEN'),
  ],

  'ses' => [
    'key' => env('AWS_ACCESS_KEY_ID'),
    'secret' => env('AWS_SECRET_ACCESS_KEY'),
    'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
  ],

  'slack' => [
    'notifications' => [
      'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
      'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
    ],
  ],

  /*
    |--------------------------------------------------------------------------
    | ZAP Service Configuration
    |--------------------------------------------------------------------------
    */

  'zap' => [
    'host' => env('ZAP_HOST', 'http://zap:8080'),
    'api_key' => env('ZAP_API_KEY', ''),
    'spider_max_depth' => env('ZAP_SPIDER_MAX_DEPTH', 3),
    'spider_max_children' => env('ZAP_SPIDER_MAX_CHILDREN', 150),
    'spider_thread_count' => env('ZAP_SPIDER_THREAD_COUNT', 2),
    'spider_timeout_seconds' => env('ZAP_SPIDER_TIMEOUT_SECONDS', 300),
    'ascan_thread_per_host' => env('ZAP_ASCAN_THREAD_PER_HOST', 2),
    'ascan_delay_ms' => env('ZAP_ASCAN_DELAY_MS', 200),
    'ascan_max_duration_minutes' => env('ZAP_ASCAN_MAX_DURATION_MINUTES', 25),
    'active_scan_timeout_seconds' => env('ZAP_ACTIVE_SCAN_TIMEOUT_SECONDS', 1500),
    'job_timeout_seconds' => env('ZAP_JOB_TIMEOUT_SECONDS', 2400),
  ],

  /*
    |--------------------------------------------------------------------------
    | SAST Service Configuration
    |--------------------------------------------------------------------------
    */

  'sast' => [
    'url' => env('SAST_API_URL', 'http://sast:8080'),
    'timeout' => env('SAST_TIMEOUT', 300),
  ],

  /*
    |--------------------------------------------------------------------------
    | RASP Service Configuration
    |--------------------------------------------------------------------------
    */

  'rasp' => [
    'url' => env('RASP_API_URL', 'http://rasp:9000'),
    'timeout' => env('RASP_TIMEOUT', 30),
  ],

  /*
    |--------------------------------------------------------------------------
    | SIEM Service Configuration
    |--------------------------------------------------------------------------
    */

  'siem' => [
    'url' => env('SIEM_API_URL', 'http://siem:5000'),
    'timeout' => env('SIEM_TIMEOUT', 120),
  ],

  /*
    |--------------------------------------------------------------------------
    | Auth Tool Service Configuration
    |--------------------------------------------------------------------------
    */

  'auth_tool' => [
    'url' => env('AUTH_API_URL', 'http://auth:5000'),
    'timeout' => env('AUTH_TIMEOUT', 30),
  ],

];
