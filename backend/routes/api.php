<?php

use App\Http\Controllers\EventController;
use Illuminate\Support\Facades\Route;

Route::post('/events', [EventController::class, 'store']);
Route::get('/events/recent', [EventController::class, 'recent']);
Route::get('/events/status', [EventController::class, 'status']);
