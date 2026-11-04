<?php

namespace Tests;

use App\Models\Setting;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Storage;

abstract class TestCase extends BaseTestCase
{
    /** Seed the full store (from storefront-seed.json) with a fake public disk. */
    protected function seedStore(): void
    {
        Storage::fake('public');
        $this->seed(DatabaseSeeder::class);
        Setting::flush();
    }

    protected function api(string $method, string $uri, array $data = [], array $headers = [], string $platform = 'web')
    {
        return $this->json($method, "/api/v1/{$platform}/".ltrim($uri, '/'), $data, $headers);
    }
}
