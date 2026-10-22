"""M2-6: face detection with MediaPipe's Tasks FaceDetector (mediapipe 1.x dropped
`mp.solutions.face_detection`): the camera checks and the selfie's face count."""
import base64
import tempfile
import threading
import urllib.request

from mediapipe import Image
from mediapipe.tasks.python.core.base_options import BaseOptions
from mediapipe.tasks.python.vision import FaceDetector, FaceDetectorOptions

from . import config

FACE_MODEL = config.MODELS_DIR / "blaze_face_short_range.tflite"
FACE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_detector/"
    "blaze_face_short_range/float16/latest/blaze_face_short_range.tflite"
)

_detector = None
_detector_lock = threading.Lock()


def _get_detector() -> FaceDetector:
    """Creates the detector once, downloading the model on first use."""
    global _detector
    if _detector is None:
        if not FACE_MODEL.exists():
            config.MODELS_DIR.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(FACE_MODEL_URL, FACE_MODEL)
        _detector = FaceDetector.create_from_options(
            FaceDetectorOptions(
                base_options=BaseOptions(model_asset_path=str(FACE_MODEL)),
                min_detection_confidence=0.5,
            )
        )
    return _detector


def decode_image(data: str) -> bytes:
    """Base64 image, with or without a "data:image/...;base64," prefix."""
    if data.startswith("data:"):
        data = data.split(",", 1)[1]
    return base64.b64decode(data)


def count_faces(image_bytes: bytes) -> int:
    with _detector_lock, tempfile.NamedTemporaryFile(suffix=".jpg") as file:
        file.write(image_bytes)
        file.flush()
        image = Image.create_from_file(file.name)
        return len(_get_detector().detect(image).detections)
