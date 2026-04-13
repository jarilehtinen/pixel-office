<?php

use App\Models\Event;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('events:prune {--hours=2}', function () {
    $hours = (int) $this->option('hours');
    $deleted = Event::where('ts', '<', now()->subHours($hours))->delete();
    $this->info("Deleted {$deleted} events (older than {$hours}h).");
})->purpose('Delete old events from the database');

Schedule::command('events:prune')->hourly();
