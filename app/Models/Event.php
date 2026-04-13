<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'actor',
        'project',
        'activity',
        'task',
        'duration_s',
        'ts',
    ];

    protected function casts(): array
    {
        return [
            'ts' => 'datetime',
            'created_at' => 'datetime',
            'duration_s' => 'integer',
        ];
    }
}
