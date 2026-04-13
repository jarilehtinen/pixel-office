<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('stores an event and retrieves it', function () {
    $payload = [
        'actor' => 'claude',
        'project' => 'my-project',
        'activity' => 'coding',
        'task' => 'refactoring auth module',
        'duration_s' => 120,
        'ts' => '2026-04-12T10:15:00+03:00',
    ];

    $this->postJson('/api/events', $payload)
        ->assertStatus(201)
        ->assertJsonFragment(['actor' => 'claude', 'activity' => 'coding']);

    $this->getJson('/api/events/recent?since='.urlencode(now()->subMinute()->toIso8601String()))
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonFragment(['project' => 'my-project']);
});

it('validates required fields', function () {
    $this->postJson('/api/events', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['actor', 'project', 'activity', 'ts']);
});

it('validates activity enum', function () {
    $payload = [
        'actor' => 'claude',
        'project' => 'test',
        'activity' => 'sleeping',
        'ts' => now()->toIso8601String(),
    ];

    $this->postJson('/api/events', $payload)
        ->assertStatus(422)
        ->assertJsonValidationErrors(['activity']);
});
