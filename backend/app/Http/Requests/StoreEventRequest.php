<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'actor' => ['required', 'string', 'max:255'],
            'project' => ['required', 'string', 'max:255'],
            'activity' => ['required', Rule::in([
                'planning', 'coding', 'review', 'bugfix', 'testing', 'done', 'idle', 'waiting',
            ])],
            'task' => ['nullable', 'string', 'max:255'],
            'duration_s' => ['nullable', 'integer', 'min:0'],
            'ts' => ['required', 'date'],
        ];
    }
}
