using UnityEngine;

namespace IslaAuria.Characters
{
    /// <summary>
    /// Comportamiento de Liora, el Primer Destello: flota cerca de Mael con
    /// un vuelo suave, pulsa con la energía recuperada y puede volar hacia
    /// un objetivo importante para guiar al jugador (GuideTo). Su brillo
    /// crece con el progreso (SetProgress 0..1).
    /// </summary>
    public class LioraSpirit : MonoBehaviour
    {
        [Tooltip("A quién acompaña (normalmente Mael).")]
        public Transform companion;
        [Tooltip("Offset de vuelo respecto al compañero (sobre el hombro).")]
        public Vector3 companionOffset = new Vector3(0.7f, 1.9f, 0.2f);
        public float flySpeed = 3.5f;
        public float bobAmplitude = 0.12f;
        public float bobSpeed = 2.2f;

        [Header("Brillo según progreso")]
        public Light pointLight;
        public float minLightIntensity = 0.6f;
        public float maxLightIntensity = 2.2f;
        public float minScale = 0.8f;
        public float maxScale = 1.4f;

        private Transform guideTarget;
        private float progress;
        private float time;
        private Vector3 baseScale;

        private void Awake()
        {
            baseScale = transform.localScale;
            if (pointLight == null) pointLight = GetComponentInChildren<Light>();
        }

        /// <summary>Vuela hacia un objetivo (santuario, tótem, secreto…).</summary>
        public void GuideTo(Transform target) => guideTarget = target;

        /// <summary>Vuelve a acompañar a Mael.</summary>
        public void ReturnToCompanion() => guideTarget = null;

        /// <summary>Fracción de Lumas/luz recuperada (0..1): controla su brillo.</summary>
        public void SetProgress(float value) => progress = Mathf.Clamp01(value);

        private void Update()
        {
            time += Time.deltaTime;

            // Posición objetivo: guía activa > compañero > quedarse
            Vector3 desired = transform.position;
            if (guideTarget != null)
            {
                desired = guideTarget.position + Vector3.up * 1.5f;
            }
            else if (companion != null)
            {
                desired = companion.position + companion.rotation * companionOffset;
            }
            desired.y += Mathf.Sin(time * bobSpeed) * bobAmplitude;

            transform.position = Vector3.Lerp(
                transform.position, desired, 1f - Mathf.Exp(-flySpeed * Time.deltaTime));

            // Pulso + crecimiento con el progreso
            float pulse = 1f + Mathf.Sin(time * 4f) * 0.08f;
            float scale = Mathf.Lerp(minScale, maxScale, progress) * pulse;
            transform.localScale = baseScale * scale;

            if (pointLight != null)
            {
                pointLight.intensity = Mathf.Lerp(minLightIntensity, maxLightIntensity, progress) * pulse;
            }
        }
    }
}
