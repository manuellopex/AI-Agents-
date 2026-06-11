using System.Collections.Generic;
using UnityEngine;

namespace IslaAuria.Characters
{
    /// <summary>
    /// Configuración central de cada personaje. Vive en la raíz del prefab y
    /// expone los puntos de anclaje (manos, cabeza, artefactos…), los objetos
    /// con glow y el contenedor del mesh, de modo que el resto del juego no
    /// dependa de la jerarquía interna. Cuando se reemplace el proxy por el
    /// modelo final, basta con re-vincular estas referencias (ver
    /// Character_Art_Implementation_Guide.md).
    /// </summary>
    public class CharacterSetup : MonoBehaviour
    {
        [Header("Identidad")]
        public string characterName = "Unnamed";

        [Header("Contenedores")]
        [Tooltip("Hijo que contiene el mesh (proxy o final). Se reemplaza entero.")]
        public Transform meshContainer;
        [Tooltip("Hijo reservado para el esqueleto del modelo final.")]
        public Transform rigContainer;
        [Tooltip("Hijo que agrupa los VFX (auras, partículas, trails).")]
        public Transform vfxContainer;

        [Header("Puntos de anclaje")]
        [Tooltip("Empties con nombre estable (Hand_R, Head, Tail_Glow…).")]
        public List<Transform> attachmentPoints = new List<Transform>();

        [Header("Magia")]
        [Tooltip("Renderers con material emissive que pulsan (GlowPulse).")]
        public List<Renderer> glowObjects = new List<Renderer>();

        /// <summary>Busca un punto de anclaje por nombre exacto.</summary>
        public Transform GetAttachmentPoint(string pointName)
        {
            foreach (var point in attachmentPoints)
            {
                if (point != null && point.name == pointName) return point;
            }
            Debug.LogWarning($"[{characterName}] Punto de anclaje no encontrado: {pointName}", this);
            return null;
        }

        /// <summary>
        /// Re-escanea la jerarquía para rellenar las listas. Lo usa el
        /// CharacterPrefabBuilder y puede ejecutarse tras sustituir el mesh.
        /// </summary>
        [ContextMenu("Auto-rellenar referencias")]
        public void AutoPopulate()
        {
            meshContainer = transform.Find("MeshContainer");
            rigContainer = transform.Find("Rig");
            vfxContainer = transform.Find("VFX");

            attachmentPoints.Clear();
            var attach = transform.Find("AttachPoints");
            if (attach != null)
            {
                foreach (Transform child in attach) attachmentPoints.Add(child);
            }

            glowObjects.Clear();
            foreach (var pulse in GetComponentsInChildren<GlowPulse>(true))
            {
                var rend = pulse.GetComponent<Renderer>();
                if (rend != null) glowObjects.Add(rend);
            }
        }
    }
}
