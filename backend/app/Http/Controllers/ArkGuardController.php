<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ArkGuardController extends Controller
{
    /**
     * Receive an uploaded image from the frontend, forward it synchronously
     * to the FastAPI AI service, and return the detection results.
     *
     * Flow: Next.js → Laravel (this) → FastAPI → Laravel → Next.js
     */
    public function detect(Request $request): JsonResponse
    {
        // ── Validate input ──────────────────────────────────────
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:10240',
        ]);

        $image = $request->file('image');
        $aiServiceUrl = env('AI_SERVICE_URL', 'http://ai_service:8001');

        try {
            // ── Forward image to AI Service ─────────────────────
            $response = Http::timeout(120)
                ->attach(
                    'image',
                    file_get_contents($image->getRealPath()),
                    $image->getClientOriginalName()
                )
                ->post("{$aiServiceUrl}/detect");

            // ── Handle AI Service errors ────────────────────────
            if ($response->failed()) {
                Log::error('AI Service error', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'AI Service tidak dapat memproses gambar.',
                ], 502);
            }

            // ── Return AI response as-is ────────────────────────
            return response()->json($response->json());

        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('AI Service connection failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Tidak dapat terhubung ke AI Service. Pastikan service berjalan.',
            ], 503);

        } catch (\Exception $e) {
            Log::error('Unexpected error in detect', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan internal.',
            ], 500);
        }
    }
}
