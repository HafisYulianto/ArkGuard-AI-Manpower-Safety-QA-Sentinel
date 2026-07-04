<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Inspection;

class ArkGuardController extends Controller
{
    /**
     * Receive an uploaded image and camera/drone source from the frontend,
     * forward the image to the FastAPI AI service, calculate the compliance
     * readiness score, save the log to SQLite, and return the modified JSON response.
     *
     * Flow: Next.js → Laravel (this) → FastAPI → Laravel (save to DB) → Next.js
     */
    public function analyzeImage(Request $request): JsonResponse
    {
        // ── Validate input ──────────────────────────────────────
        $request->validate([
            'image'  => 'required|image|mimes:jpeg,png,jpg,webp|max:10240',
            'source' => 'nullable|string',
        ]);

        $image = $request->file('image');
        $source = $request->input('source', 'Unknown');
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

            $responseData = $response->json();

            // ── Calculate Manpower Readiness Score ──────────────
            $detections = $responseData['detections'] ?? [];
            $unsafeCount = 0;

            foreach ($detections as $det) {
                if (isset($det['is_safe']) && !$det['is_safe']) {
                    $unsafeCount++;
                }
            }

            // Calculation logic: Base 100%, subtract 30% per unsafe worker, min 0%
            $readinessScore = max(0, 100 - ($unsafeCount * 30));

            // Inject the score and source into the response JSON
            $responseData['readiness_score'] = $readinessScore;
            $responseData['source'] = $source;

            // ── Save to SQLite Database ──────────────────────────
            try {
                Inspection::create([
                    'source' => $source,
                    'total_persons' => $responseData['summary']['total_persons'] ?? 0,
                    'safe_count' => $responseData['summary']['safe_count'] ?? 0,
                    'violation_count' => $responseData['summary']['violation_count'] ?? 0,
                    'readiness_score' => $readinessScore,
                ]);
            } catch (\Exception $dbEx) {
                Log::error('Gagal menyimpan log K3 ke database SQLite', [
                    'error' => $dbEx->getMessage()
                ]);
            }

            return response()->json($responseData);

        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('AI Service connection failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Tidak dapat terhubung ke AI Service. Pastikan service berjalan.',
            ], 503);

        } catch (\Exception $e) {
            Log::error('Unexpected error in analyzeImage', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan internal.',
            ], 500);
        }
    }

    /**
     * Get recent K3 compliance log history for rendering trend charts.
     * Returns the latest 20 inspections in chronological order.
     */
    public function getHistory(): JsonResponse
    {
        try {
            $history = Inspection::latest()
                ->limit(20)
                ->get()
                ->reverse()
                ->values();

            return response()->json([
                'success' => true,
                'data' => $history
            ]);
        } catch (\Exception $e) {
            Log::error('Gagal mengambil history K3', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Gagal mengambil riwayat pengawasan dari database.'
            ], 500);
        }
    }
}
