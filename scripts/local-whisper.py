import json
import os
import sys

from faster_whisper import WhisperModel


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: local-whisper.py <audio-file>")
    model_name = os.environ.get("LOCAL_WHISPER_MODEL", "base")
    model_dir = os.environ.get("LOCAL_WHISPER_MODEL_DIR")
    model = WhisperModel(
        model_name,
        device="cpu",
        compute_type="int8",
        download_root=model_dir or None,
    )
    segments, info = model.transcribe(
        sys.argv[1],
        vad_filter=True,
        beam_size=5,
        condition_on_previous_text=False,
    )
    result = [
        {"startTime": round(item.start, 3), "endTime": round(item.end, 3), "text": item.text.strip()}
        for item in segments
        if item.text.strip()
    ]
    print(json.dumps({"language": info.language, "segments": result}, ensure_ascii=False))


if __name__ == "__main__":
    main()
