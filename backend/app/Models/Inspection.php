<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inspection extends Model
{
    protected $fillable = [
        'source',
        'total_persons',
        'safe_count',
        'violation_count',
        'readiness_score',
    ];
}
