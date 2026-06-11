using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using IslaAuria.Characters;

namespace IslaAuria.EditorTools
{
    /// <summary>
    /// Herramienta principal: construye los prefabs de los 6 personajes con
    /// proxy mesh, materiales, Animator, colliders, attachment points, glow,
    /// sombras y scripts. Menú: Isla Auria → Character Prefab Builder.
    /// </summary>
    public class CharacterPrefabBuilder : EditorWindow
    {
        private static readonly string[] Characters =
            { "Mael", "Oryn", "Elaria", "Liora", "Varkon", "Seralya" };

        [MenuItem("Isla Auria/2. Character Prefab Builder")]
        public static void Open()
        {
            GetWindow<CharacterPrefabBuilder>("Prefab Builder");
        }

        private void OnGUI()
        {
            GUILayout.Label("Mael & Oryn — Constructor de personajes", EditorStyles.boldLabel);
            GUILayout.Space(4);
            EditorGUILayout.HelpBox(
                "Genera el prefab proxy de cada personaje (mesh + materiales + " +
                "animator + colliders + attach points + glow). Los prefabs se " +
                "guardan en Assets/Characters/[Nombre]/Prefabs.", MessageType.Info);
            GUILayout.Space(8);

            foreach (string name in Characters)
            {
                if (GUILayout.Button($"Construir {name}", GUILayout.Height(28)))
                {
                    BuildCharacter(name, instantiate: true);
                }
            }

            GUILayout.Space(10);
            if (GUILayout.Button("★ Construir TODOS", GUILayout.Height(34)))
            {
                foreach (string name in Characters) BuildCharacter(name, instantiate: false);
                Debug.Log("✔ Los 6 prefabs fueron generados.");
            }

            GUILayout.Space(10);
            if (GUILayout.Button("Generar escena CharacterShowcase", GUILayout.Height(28)))
            {
                CharacterShowcaseBuilder.BuildScene();
            }

            GUILayout.Space(10);
            if (GraphicsSettings.CurrentPipeline() == null)
            {
                EditorGUILayout.HelpBox(
                    "URP no está activo. Crea un asset URP (Assets → Create → " +
                    "Rendering → URP Asset with Universal Renderer) y asígnalo en " +
                    "Project Settings → Graphics. Sin URP el shader no renderiza.",
                    MessageType.Warning);
            }
        }

        /// <summary>Construye el prefab de un personaje y lo guarda.</summary>
        public static GameObject BuildCharacter(string name, bool instantiate)
        {
            // 1. Proxy mesh con materiales y attach points
            GameObject root = name switch
            {
                "Mael" => ProxyMeshFactory.BuildMael(),
                "Oryn" => ProxyMeshFactory.BuildOryn(),
                "Elaria" => ProxyMeshFactory.BuildElaria(),
                "Liora" => ProxyMeshFactory.BuildLiora(),
                "Varkon" => ProxyMeshFactory.BuildVarkon(),
                "Seralya" => ProxyMeshFactory.BuildSeralya(),
                _ => throw new ArgumentException($"Personaje desconocido: {name}"),
            };

            // 2. Animator con controller placeholder
            var animator = root.AddComponent<Animator>();
            animator.runtimeAnimatorController = PlaceholderAnimationFactory.BuildController(name);

            // 3. Collider de gameplay (dimensiones por personaje)
            AddCollider(root, name);

            // 4. Scripts de comportamiento específicos
            if (name == "Oryn") root.AddComponent<OrynFollower>();
            if (name == "Liora") root.AddComponent<LioraSpirit>();

            // 5. Sombras: proyectar pero no recibir (look limpio en toon)
            foreach (var renderer in root.GetComponentsInChildren<MeshRenderer>())
            {
                renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
                renderer.receiveShadows = false;
            }

            // 6. Configuración central
            var setup = root.AddComponent<CharacterSetup>();
            setup.characterName = name;
            setup.AutoPopulate();

            // 7. Guardar prefab
            string folder = $"Assets/Characters/{name}/Prefabs";
            StylizedMaterialLibrary.EnsureFolder(folder);
            string path = $"{folder}/{name}.prefab";
            // Guardar también las mallas generadas (conos) dentro del prefab
            SaveGeneratedMeshes(root, $"Assets/Characters/{name}/Models");
            var prefab = PrefabUtility.SaveAsPrefabAsset(root, path);
            Debug.Log($"✔ Prefab generado: {path}");

            if (instantiate)
            {
                Selection.activeObject = root;
                SceneView.lastActiveSceneView?.FrameSelected();
            }
            else
            {
                UnityEngine.Object.DestroyImmediate(root);
            }
            return prefab;
        }

        /// <summary>Hitbox y colliders según el tipo de personaje.</summary>
        private static void AddCollider(GameObject root, string name)
        {
            switch (name)
            {
                case "Oryn":
                {
                    var col = root.AddComponent<CapsuleCollider>();
                    col.center = new Vector3(0f, 0.32f, 0.05f);
                    col.radius = 0.28f;
                    col.height = 0.7f;
                    break;
                }
                case "Liora":
                {
                    var col = root.AddComponent<SphereCollider>();
                    col.center = new Vector3(0f, 1.2f, 0f);
                    col.radius = 0.35f;
                    col.isTrigger = true; // espíritu: no bloquea, solo detecta
                    break;
                }
                case "Varkon":
                {
                    var col = root.AddComponent<CapsuleCollider>();
                    col.center = new Vector3(0f, 1.1f, 0f);
                    col.radius = 0.45f;
                    col.height = 2.3f;
                    break;
                }
                default:
                {
                    var col = root.AddComponent<CapsuleCollider>();
                    col.center = new Vector3(0f, 0.9f, 0f);
                    col.radius = 0.35f;
                    col.height = 1.8f;
                    break;
                }
            }
        }

        /// <summary>
        /// Las mallas generadas por código (conos) deben persistirse como
        /// sub-assets para que el prefab no pierda sus mallas al recargar.
        /// </summary>
        private static void SaveGeneratedMeshes(GameObject root, string folder)
        {
            StylizedMaterialLibrary.EnsureFolder(folder);
            var seen = new Dictionary<Mesh, Mesh>();
            foreach (var filter in root.GetComponentsInChildren<MeshFilter>())
            {
                var mesh = filter.sharedMesh;
                if (mesh == null || AssetDatabase.Contains(mesh)) continue;
                if (!seen.TryGetValue(mesh, out var saved))
                {
                    string meshPath = $"{folder}/{root.name}_{mesh.name}.asset";
                    var existing = AssetDatabase.LoadAssetAtPath<Mesh>(meshPath);
                    if (existing != null) AssetDatabase.DeleteAsset(meshPath);
                    AssetDatabase.CreateAsset(mesh, meshPath);
                    saved = mesh;
                    seen[mesh] = saved;
                }
                filter.sharedMesh = saved;
            }
        }
    }

    /// <summary>Helper para consultar el pipeline activo sin romper en versiones.</summary>
    internal static class GraphicsSettings
    {
        public static UnityEngine.Rendering.RenderPipelineAsset CurrentPipeline()
        {
            return UnityEngine.Rendering.GraphicsSettings.currentRenderPipeline;
        }
    }
}
