<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ArkGuardController;

/*
|--------------------------------------------------------------------------
| API Routes — ArkGuard AI
|--------------------------------------------------------------------------
|
| POST /api/detect — Forward image to AI Service for K3 analysis
|
*/

Route::post('/detect', [ArkGuardController::class, 'analyzeImage']);
Route::get('/history', [ArkGuardController::class, 'getHistory']);

