using UnityEngine;

namespace IslaAuria.Characters
{
    /// <summary>
    /// Cámara orbital para la escena CharacterShowcase: arrastra con el
    /// ratón (o un dedo) para orbitar, rueda (o pellizco) para acercar.
    /// Pensada para revisar los personajes como "concept art en 3D".
    /// </summary>
    public class ShowcaseOrbitCamera : MonoBehaviour
    {
        public Transform pivot;
        public float distance = 6f;
        public float minDistance = 2f;
        public float maxDistance = 14f;
        public float orbitSpeed = 160f;
        public float zoomSpeed = 4f;
        public float minPitch = -10f;
        public float maxPitch = 70f;

        private float yaw = 20f;
        private float pitch = 18f;

        private void LateUpdate()
        {
            if (pivot == null) return;

            // Ratón
            if (Input.GetMouseButton(0))
            {
                yaw += Input.GetAxis("Mouse X") * orbitSpeed * Time.deltaTime;
                pitch -= Input.GetAxis("Mouse Y") * orbitSpeed * Time.deltaTime;
            }
            distance -= Input.mouseScrollDelta.y * zoomSpeed * 0.1f * distance;

            // Táctil: un dedo orbita, dos dedos hacen zoom
            if (Input.touchCount == 1)
            {
                Vector2 delta = Input.GetTouch(0).deltaPosition;
                yaw += delta.x * 0.25f;
                pitch -= delta.y * 0.25f;
            }
            else if (Input.touchCount == 2)
            {
                Touch a = Input.GetTouch(0);
                Touch b = Input.GetTouch(1);
                float current = (a.position - b.position).magnitude;
                float previous = ((a.position - a.deltaPosition) - (b.position - b.deltaPosition)).magnitude;
                distance -= (current - previous) * 0.01f;
            }

            pitch = Mathf.Clamp(pitch, minPitch, maxPitch);
            distance = Mathf.Clamp(distance, minDistance, maxDistance);

            Quaternion rotation = Quaternion.Euler(pitch, yaw, 0f);
            transform.position = pivot.position + rotation * new Vector3(0f, 0f, -distance);
            transform.rotation = rotation;
        }
    }
}
