<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->string('actor');
            $table->string('project');
            $table->string('activity');
            $table->string('task')->nullable();
            $table->unsignedInteger('duration_s')->nullable();
            $table->timestamp('ts');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
