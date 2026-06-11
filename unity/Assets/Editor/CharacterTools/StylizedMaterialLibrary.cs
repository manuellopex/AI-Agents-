using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace IslaAuria.EditorTools
{
    /// <summary>
    /// Genera la librería de materiales estilizados del juego con el shader
    /// IslaAuria/StylizedToon. Menú: Isla Auria → 1. Generar materiales.
    /// Los materiales se crean en Assets/Characters/_Shared/Materials y son
    /// compartidos por todos los personajes (pocos materiales = móvil feliz).
    /// </summary>
    public static class StylizedMaterialLibrary
    {
        public const string MaterialsFolder = "Assets/Characters/_Shared/Materials";
        private const string ShaderName = "IslaAuria/StylizedToon";

        /// <summary>Definición de un material de la librería.</summary>
        private struct MatDef
        {
            public string name;
            public Color baseColor;
            public Color emission;     // negro = sin emisión
            public float smoothness;
            public float rimIntensity;
            public bool transparent;

            public MatDef(string name, Color baseColor, Color emission,
                float smoothness = 0.2f, float rimIntensity = 0.35f, bool transparent = false)
            {
                this.name = name;
                this.baseColor = baseColor;
                this.emission = emission;
                this.smoothness = smoothness;
                this.rimIntensity = rimIntensity;
                this.transparent = transparent;
            }
        }

        private static Color Hex(string hex, float alpha = 1f)
        {
            ColorUtility.TryParseHtmlString(hex, out Color color);
            color.a = alpha;
            return color;
        }

        /// <summary>Paleta oficial (ver ART_DIRECTION.md del prototipo web).</summary>
        private static List<MatDef> Definitions() => new List<MatDef>
        {
            new MatDef("MAT_Skin_Warm",   Hex("#F0B98A"), Color.black, 0.15f),
            new MatDef("MAT_Hair_Dark",   Hex("#4A3326"), Color.black, 0.35f),
            new MatDef("MAT_Cloth_Cream", Hex("#F5E6C4"), Color.black, 0.1f),
            new MatDef("MAT_Cloth_Teal",  Hex("#2AA6A0"), Color.black, 0.15f),
            new MatDef("MAT_Gold_Stylized", Hex("#FFD34D"), Hex("#3D2A00") * 0.5f, 0.7f, 0.6f),
            new MatDef("MAT_Leather_Brown", Hex("#8B5A2B"), Color.black, 0.25f),
            new MatDef("MAT_Auralis_Glow_Teal", Hex("#7FE8DC"), Hex("#2EC4B6") * 2.2f, 0.5f, 0.8f),
            new MatDef("MAT_Liora_Glow_Gold",   Hex("#FFF2B0"), Hex("#FFD34D") * 2.6f, 0.5f, 1.0f),
            new MatDef("MAT_Noxia_Glow_Violet", Hex("#C9A0E8"), Hex("#7A2FD0") * 2.4f, 0.5f, 0.8f),
            new MatDef("MAT_Dark_Armor",  Hex("#2E3A40"), Color.black, 0.45f, 0.5f),
            new MatDef("MAT_Pearl_White", Hex("#FDF6E0"), Hex("#FFF6E0") * 0.15f, 0.6f, 0.7f),
            new MatDef("MAT_Soft_Pink_Transparent", Hex("#F2A8C4", 0.45f), Hex("#F2A8C4") * 0.2f, 0.3f, 0.9f, true),
            // Extras usados por los proxies
            new MatDef("MAT_Fur_Blue",   Hex("#4EA8D8"), Color.black, 0.1f),
            new MatDef("MAT_Fur_White",  Hex("#E8F4FF"), Color.black, 0.1f),
            new MatDef("MAT_Cloth_DarkPurple", Hex("#3A2A52"), Color.black, 0.2f),
            new MatDef("MAT_Old_Gold",   Hex("#B8923D"), Color.black, 0.55f, 0.5f),
            new MatDef("MAT_Eye_White",  Hex("#FFFFFF"), Hex("#FFFFFF") * 0.1f, 0.8f, 0f),
            new MatDef("MAT_Eye_Dark",   Hex("#1B2A33"), Color.black, 0.9f, 0f),
        };

        [MenuItem("Isla Auria/1. Generar materiales estilizados")]
        public static void GenerateAll()
        {
            Shader shader = Shader.Find(ShaderName);
            if (shader == null)
            {
                Debug.LogError($"No se encontró el shader '{ShaderName}'. " +
                    "Comprueba que StylizedToon.shader compiló sin errores y que URP está instalado.");
                return;
            }

            EnsureFolder(MaterialsFolder);

            foreach (var def in Definitions())
            {
                string path = $"{MaterialsFolder}/{def.name}.mat";
                var material = AssetDatabase.LoadAssetAtPath<Material>(path);
                bool isNew = material == null;
                if (isNew) material = new Material(shader);
                else material.shader = shader;

                material.SetColor("_BaseColor", def.baseColor);
                material.SetColor("_EmissionColor", def.emission);
                material.SetFloat("_Smoothness", def.smoothness);
                material.SetFloat("_RimIntensity", def.rimIntensity);

                if (def.transparent)
                {
                    material.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
                    material.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
                    material.SetFloat("_ZWrite", 0f);
                    material.renderQueue = (int)RenderQueue.Transparent;
                    material.SetOverrideTag("RenderType", "Transparent");
                }
                else
                {
                    material.SetFloat("_SrcBlend", (float)BlendMode.One);
                    material.SetFloat("_DstBlend", (float)BlendMode.Zero);
                    material.SetFloat("_ZWrite", 1f);
                    material.renderQueue = (int)RenderQueue.Geometry;
                    material.SetOverrideTag("RenderType", "Opaque");
                }

                if (isNew) AssetDatabase.CreateAsset(material, path);
                else EditorUtility.SetDirty(material);
            }

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log($"✔ Librería de materiales generada en {MaterialsFolder} ({Definitions().Count} materiales).");
        }

        /// <summary>Carga un material de la librería (generándola si falta).</summary>
        public static Material Get(string materialName)
        {
            string path = $"{MaterialsFolder}/{materialName}.mat";
            var material = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (material == null)
            {
                GenerateAll();
                material = AssetDatabase.LoadAssetAtPath<Material>(path);
            }
            if (material == null)
            {
                Debug.LogError($"Material no encontrado tras generar la librería: {materialName}");
            }
            return material;
        }

        public static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            string[] parts = path.Split('/');
            string current = parts[0];
            for (int i = 1; i < parts.Length; i++)
            {
                string next = $"{current}/{parts[i]}";
                if (!AssetDatabase.IsValidFolder(next))
                {
                    AssetDatabase.CreateFolder(current, parts[i]);
                }
                current = next;
            }
        }
    }
}
