<?php

return [

  /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    */

  'default' => env('FILESYSTEM_DISK', 'local'),

  /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    */

  'disks' => [

    'local' => [
      'driver' => 'local',
      'root' => storage_path('app/private'),
      'serve' => true,
      'throw' => false,
    ],

    'public' => [
      'driver' => 'local',
      'root' => storage_path('app/public'),
      'url' => env('APP_URL') . '/storage',
      'visibility' => 'public',
      'throw' => false,
    ],

    'reports' => [
      'driver' => 'local',
      'root' => storage_path('app/reports'),
      'throw' => false,
    ],

  ],

  /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    */

  'links' => [
    public_path('storage') => storage_path('app/public'),
  ],

];

