using UnityEngine;

namespace IslaAuria.Characters
{
    /// <summary>
    /// Pulso suave de emisión para las partes mágicas (artefacto de Mael,
    /// cola de Oryn, núcleo de Liora, cristales de Noxia…). Anima la
    /// propiedad _EmissionColor del shader IslaAuria/StylizedToon usando un
    /// MaterialPropertyBlock (sin instanciar materiales: amigable con móvil).
    /// </summary>
    [RequireComponent(typeof(Renderer))]
    public class GlowPulse : MonoBehaviour
    {
        [ColorUsage(false, true)]
        [Tooltip("Color de emisión base (HDR). Si queda en negro, se toma del material.")]
        public Color emissionColor = Color.black;

        [Range(0f, 3f)] public float minIntensity = 0.7f;
        [Range(0f, 4f)] public float maxIntensity = 1.4f;
        [Tooltip("Velocidad del pulso en ciclos por segundo.")]
        public float speed = 1.2f;
        [Tooltip("Desfase aleatorio para que varios glows no pulsen a la vez.")]
        public bool randomPhase = true;

        private static readonly int EmissionId = Shader.PropertyToID("_EmissionColor");
        private Renderer cachedRenderer;
        private MaterialPropertyBlock block;
        private float phase;

        private void Awake()
        {
            cachedRenderer = GetComponent<Renderer>();
            block = new MaterialPropertyBlock();
            if (randomPhase) phase = Random.value * Mathf.PI * 2f;

            // Si no se configuró color, heredar el del material compartido
            if (emissionColor.maxColorComponent <= 0f && cachedRenderer.sharedMaterial != null &&
                cachedRenderer.sharedMaterial.HasProperty(EmissionId))
            {
                emissionColor = cachedRenderer.sharedMaterial.GetColor(EmissionId);
            }
        }

        private void Update()
        {
            float t = (Mathf.Sin(Time.time * speed * Mathf.PI * 2f + phase) + 1f) * 0.5f;
            float intensity = Mathf.Lerp(minIntensity, maxIntensity, t);
            cachedRenderer.GetPropertyBlock(block);
            block.SetColor(EmissionId, emissionColor * intensity);
            cachedRenderer.SetPropertyBlock(block);
        }
    }
}
