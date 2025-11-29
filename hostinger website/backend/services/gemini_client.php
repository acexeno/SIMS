<?php
/**
 * Lightweight Gemini client for server-side chat assistance.
 * Generates responses via Google AI Studio (Gemini) free tier endpoints.
 */

require_once __DIR__ . '/../config/env.php';

if (!function_exists('gemini_is_enabled')) {
    /**
     * Determine if Gemini integration is enabled and has a usable API key.
     */
    function gemini_is_enabled(): bool
    {
        $toggle = strtolower((string) env('GOOGLE_AI_CHAT_ENABLED', '1'));
        if (in_array($toggle, ['0', 'false', 'disabled', 'off'], true)) {
            return false;
        }

        $apiKey = trim((string) env('GOOGLE_AI_API_KEY', ''));
        return $apiKey !== '';
    }
}

if (!function_exists('gemini_generate_reply')) {
    /**
     * Send chat history to Gemini and return generated text.
     *
     * @param array $contents Gemini-formatted message array.
     * @param array $options  [
     *      'model' => string,
     *      'timeout' => int,
     *      'system_instruction' => string,
     *      'generation_config' => array,
     *      'safety_settings' => array,
     * ]
     * @return array ['ok' => bool, 'text' => string|null, 'error' => string|null, 'status' => int|null, 'raw' => mixed]
     */
    function gemini_generate_reply(array $contents, array $options = []): array
    {
        $apiKey = trim((string) env('GOOGLE_AI_API_KEY', ''));
        if ($apiKey === '') {
            return ['ok' => false, 'error' => 'Missing Google AI API key'];
        }

        $requestedModel = $options['model'] ?? env('GOOGLE_AI_MODEL', 'gemini-2.5-flash');
        $timeout = isset($options['timeout']) ? (int) $options['timeout'] : (int) env('GOOGLE_AI_TIMEOUT', 10);
        if ($timeout <= 0) {
            $timeout = 10;
        }

        $payload = [
            'contents' => $contents,
        ];

        $systemInstructionParts = null;
        if (!empty($options['system_instruction'])) {
            $systemInstructionParts = [
                ['text' => $options['system_instruction']],
            ];
        }

        if (!empty($options['generation_config']) && is_array($options['generation_config'])) {
            $payload['generationConfig'] = $options['generation_config'];
        }

        if (!empty($options['safety_settings']) && is_array($options['safety_settings'])) {
            $payload['safetySettings'] = $options['safety_settings'];
        }

        $fallbackEnv = env('GOOGLE_AI_FALLBACK_MODELS', '');
        $fallbackModels = array_filter(array_map('trim', explode(',', (string) $fallbackEnv)));

        $defaultFallbacks = [
            'gemini-2.5-flash',
            'gemini-flash-latest',
            'gemini-2.5-flash-preview-05-20',
            'gemini-2.0-flash',
        ];

        $modelsToTry = array_values(array_unique(array_filter(array_merge(
            [$requestedModel],
            $fallbackModels,
            $defaultFallbacks
        ))));

        $attempts = [];
        $apiVersions = ['v1', 'v1beta'];
        foreach ($apiVersions as $apiVersion) {
            foreach ($modelsToTry as $modelCandidate) {
                $url = sprintf(
                    'https://generativelanguage.googleapis.com/%s/models/%s:generateContent?key=%s',
                    $apiVersion,
                    rawurlencode($modelCandidate),
                    urlencode($apiKey)
                );

                $requestPayload = $payload;
                if ($systemInstructionParts !== null) {
                    if ($apiVersion === 'v1') {
                        $instructionContent = [
                            'role' => 'user',
                            'parts' => $systemInstructionParts,
                        ];
                        $requestPayload['contents'] = array_merge([$instructionContent], $requestPayload['contents']);
                    } else {
                        $requestPayload['systemInstruction'] = [
                            'role' => 'system',
                            'parts' => $systemInstructionParts,
                        ];
                    }
                }

                $ch = curl_init($url);
                $encodedPayload = json_encode($requestPayload, JSON_UNESCAPED_SLASHES);

                curl_setopt_array($ch, [
                    CURLOPT_POST => true,
                    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POSTFIELDS => $encodedPayload,
                    CURLOPT_TIMEOUT => $timeout,
                    CURLOPT_CONNECTTIMEOUT => min(5, $timeout),
                ]);

                $response = curl_exec($ch);
                if ($response === false) {
                    $error = curl_error($ch) ?: 'Unknown cURL error';
                    curl_close($ch);
                    return [
                        'ok' => false,
                        'error' => 'cURL error: ' . $error,
                        'model_attempts' => $attempts,
                    ];
                }

                $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                $data = json_decode($response, true);
                if ($status >= 200 && $status < 300 && is_array($data)) {
                    $text = '';
                    if (isset($data['candidates'][0]['content']['parts'])) {
                        foreach ($data['candidates'][0]['content']['parts'] as $part) {
                            if (isset($part['text'])) {
                                $text .= $part['text'];
                            }
                        }
                    }
                    $text = trim((string) $text);
                    if ($text === '') {
                        return [
                            'ok' => false,
                            'error' => 'Gemini response was empty',
                            'status' => $status,
                            'raw' => $data,
                            'model_attempts' => array_merge($attempts, [[
                                'model' => $modelCandidate,
                                'status' => $status,
                                'api_version' => $apiVersion,
                                'error' => 'empty_response',
                            ]]),
                        ];
                    }

                    return [
                        'ok' => true,
                        'text' => $text,
                        'status' => $status,
                        'raw' => $data,
                        'model_used' => $modelCandidate,
                        'api_version' => $apiVersion,
                        'model_attempts' => $attempts,
                    ];
                }

                $errorMessage = '';
                if (is_array($data) && isset($data['error']['message'])) {
                    $errorMessage = $data['error']['message'];
                } elseif ($status >= 400) {
                    $errorMessage = 'Gemini API returned HTTP ' . $status;
                } else {
                    $errorMessage = 'Unexpected response from Gemini API';
                }

                $attempts[] = [
                    'model' => $modelCandidate,
                    'status' => $status,
                    'api_version' => $apiVersion,
                    'error' => $errorMessage,
                ];

                if ($status !== 404) {
                    return [
                        'ok' => false,
                        'error' => $errorMessage,
                        'status' => $status,
                        'raw' => $data,
                        'model_attempts' => $attempts,
                    ];
                }
            }
        }

        return [
            'ok' => false,
            'error' => 'All Gemini model attempts failed',
            'status' => 404,
            'model_attempts' => $attempts,
        ];
    }
}

