<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEventRequest;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;
use Illuminate\Http\Request;

class EventController extends Controller
{
    public function store(StoreEventRequest $request): JsonResponse
    {
        $event = Event::create($request->validated());

        return response()->json($event, 201);
    }

    public function recent(Request $request): JsonResponse
    {
        $raw = $request->query('since');
        $since = $raw ? Carbon::parse(str_replace(' ', '+', $raw)) : now()->subMinutes(5);

        $events = Event::where('created_at', '>', $since)
            ->orderBy('created_at')
            ->get();

        return response()->json($events);
    }

    public function status(): JsonResponse
    {
        $actors = Event::select('actor')
            ->distinct()
            ->pluck('actor');

        $status = $actors->map(function (string $actor) {
            return Event::where('actor', $actor)
                ->orderByDesc('created_at')
                ->first();
        });

        return response()->json($status);
    }
}
