import os
import uuid
import tempfile
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
import boto3
from botocore.client import Config

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Import IndexTTS
from indextts.infer_v2 import IndexTTS2

# ==========================================
# Cloudflare R2 Configuration
# ==========================================
# TODO: Fill in your Cloudflare R2 credentials
R2_ENDPOINT = os.getenv('R2_ENDPOINT', '')  # e.g., 'https://account_id.r2.cloudflarestorage.com'
R2_ACCESS_KEY_ID = os.getenv('R2_ACCESS_KEY_ID', '')
R2_SECRET_ACCESS_KEY = os.getenv('R2_SECRET_ACCESS_KEY', '')
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME', '')  # e.g., 'alice-tts-audio'
R2_PUBLIC_URL_BASE = os.getenv('R2_PUBLIC_URL_BASE', '')  # e.g., 'https://your-custom-domain.com' or R2 public bucket URL

# ==========================================
# TTS Configuration
# ==========================================
TTS_CONFIG_PATH = os.getenv('TTS_CONFIG_PATH', 'checkpoints/config.yaml')
TTS_MODEL_DIR = os.getenv('TTS_MODEL_DIR', 'checkpoints')
TTS_VOICE_PROMPT = os.getenv('TTS_VOICE_PROMPT', 'examples/voice_01.wav')  # Default reference audio

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access

# Initialize TTS model
print("Initializing IndexTTS model...")
tts = IndexTTS2(
    cfg_path=TTS_CONFIG_PATH,
    model_dir=TTS_MODEL_DIR,
    use_fp16=True,
    use_cuda_kernel=True,
    use_deepspeed=True
)
print("TTS model initialized successfully.")

# Initialize R2 client
def get_r2_client():
    """Create and return Cloudflare R2 S3-compatible client."""
    if not all([R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME]):
        raise ValueError("R2 credentials not fully configured. Please set environment variables.")

    return boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4')
    )


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "message": "TTS service is running"}), 200


@app.route('/tts', methods=['POST'])
def generate_tts():
    """
    Generate TTS audio from text input.

    Request body (JSON):
    {
        "text": "Text to convert to speech",
        "voice_prompt": "path/to/reference.wav" (optional, defaults to TTS_VOICE_PROMPT)
    }

    Response (JSON):
    {
        "url": "https://your-r2-public-url/audio/uuid.wav",
        "filename": "uuid.wav"
    }
    """
    try:
        # Parse request
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "Missing 'text' field in request body"}), 400

        text = data['text']
        voice_prompt = data.get('voice_prompt', TTS_VOICE_PROMPT)

        if not text.strip():
            return jsonify({"error": "Text cannot be empty"}), 400

        # Validate voice prompt file exists
        if not os.path.exists(voice_prompt):
            return jsonify({"error": f"Voice prompt file not found: {voice_prompt}"}), 400

        # Generate unique filename
        audio_id = str(uuid.uuid4())
        filename = f"{audio_id}.wav"

        # Create temporary file for generated audio
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
            tmp_path = tmp_file.name

        try:
            # Generate TTS audio
            print(f"Generating TTS for text: {text[:50]}...")
            tts.infer(
                spk_audio_prompt=voice_prompt,
                text=text,
                output_path=tmp_path,
                verbose=True
            )
            print(f"Audio generated successfully: {tmp_path}")

            # Upload to R2
            print(f"Uploading to R2 bucket: {R2_BUCKET_NAME}")
            r2_client = get_r2_client()
            object_key = f"audio/{filename}"

            with open(tmp_path, 'rb') as audio_file:
                r2_client.put_object(
                    Bucket=R2_BUCKET_NAME,
                    Key=object_key,
                    Body=audio_file,
                    ContentType='audio/wav'
                )

            # Construct public URL
            public_url = f"{R2_PUBLIC_URL_BASE.rstrip('/')}/{object_key}"
            print(f"Upload successful. Public URL: {public_url}")

            return jsonify({
                "url": public_url,
                "filename": filename
            }), 200

        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except ValueError as ve:
        print(f"Configuration error: {ve}")
        return jsonify({"error": str(ve)}), 500
    except Exception as e:
        print(f"Error generating TTS: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


@app.route('/tts/batch', methods=['POST'])
def generate_tts_batch():
    """
    Generate multiple TTS audios in batch.

    Request body (JSON):
    {
        "texts": ["Text 1", "Text 2", ...],
        "voice_prompt": "path/to/reference.wav" (optional)
    }

    Response (JSON):
    {
        "results": [
            {"url": "...", "filename": "...", "text": "..."},
            ...
        ]
    }
    """
    try:
        data = request.get_json()
        if not data or 'texts' not in data:
            return jsonify({"error": "Missing 'texts' field in request body"}), 400

        texts = data['texts']
        if not isinstance(texts, list) or len(texts) == 0:
            return jsonify({"error": "'texts' must be a non-empty array"}), 400

        voice_prompt = data.get('voice_prompt', TTS_VOICE_PROMPT)

        results = []
        for text in texts:
            if not text.strip():
                results.append({"error": "Empty text", "text": text})
                continue

            # Generate audio for each text
            audio_id = str(uuid.uuid4())
            filename = f"{audio_id}.wav"

            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                tmp_path = tmp_file.name

            try:
                tts.infer(
                    spk_audio_prompt=voice_prompt,
                    text=text,
                    output_path=tmp_path,
                    verbose=False
                )

                r2_client = get_r2_client()
                object_key = f"audio/{filename}"

                with open(tmp_path, 'rb') as audio_file:
                    r2_client.put_object(
                        Bucket=R2_BUCKET_NAME,
                        Key=object_key,
                        Body=audio_file,
                        ContentType='audio/wav'
                    )

                public_url = f"{R2_PUBLIC_URL_BASE.rstrip('/')}/{object_key}"
                results.append({
                    "url": public_url,
                    "filename": filename,
                    "text": text
                })

            except Exception as e:
                results.append({"error": str(e), "text": text})

            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

        return jsonify({"results": results}), 200

    except Exception as e:
        print(f"Error in batch TTS: {e}")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


if __name__ == '__main__':
    # Check configuration
    print("\n=== TTS Service Configuration ===")
    print(f"TTS Config: {TTS_CONFIG_PATH}")
    print(f"TTS Model Dir: {TTS_MODEL_DIR}")
    print(f"Default Voice Prompt: {TTS_VOICE_PROMPT}")
    print(f"R2 Endpoint: {R2_ENDPOINT or '[NOT SET]'}")
    print(f"R2 Bucket: {R2_BUCKET_NAME or '[NOT SET]'}")
    print(f"R2 Public URL Base: {R2_PUBLIC_URL_BASE or '[NOT SET]'}")
    print("=" * 35 + "\n")

    # Start server
    port = int(os.getenv('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
