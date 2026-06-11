using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using IslaAuria.Characters;

namespace IslaAuria.EditorTools
{
    /// <summary>
    /// Genera la escena CharacterShowcase.unity: piso de piedra clara, fondo
    /// tropical simple, iluminación premium (sol cálido + rim), los 6
    /// personajes alineados con sus nombres, cámara orbital y botonera para
    /// cambiar animaciones. Sirve para revisar el estilo visual como si
    /// fuera concept art en 3D.
    /// </summary>
    public static class CharacterShowcaseBuilder
    {
        private static readonly string[] Characters =
            { "Mael", "Oryn", "Elaria", "Liora", "Varkon", "Seralya" };

        [MenuItem("Isla Auria/3. Generar escena CharacterShowcase")]
        public static void BuildScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            BuildLighting();
            BuildEnvironment();
            Transform pivot = BuildCharacters();
            BuildCamera(pivot);

            StylizedMaterialLibrary.EnsureFolder("Assets/Scenes");
            EditorSceneManager.SaveScene(scene, "Assets/Scenes/CharacterShowcase.unity");
            Debug.Log("✔ Escena guardada en Assets/Scenes/CharacterShowcase.unity — pulsa Play y usa 1-7 o los botones.");
        }

        private static void BuildLighting()
        {
            // Sol dorado de isla (luz principal cálida)
            var sun = new GameObject("Sun_Warm").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.87f, 0.62f);
            sun.intensity = 1.5f;
            sun.shadows = LightShadows.Soft;
            sun.transform.rotation = Quaternion.Euler(42f, -28f, 0f);

            // Rim light fría desde atrás (separa la silueta del fondo)
            var rim = new GameObject("Rim_Cool").AddComponent<Light>();
            rim.type = LightType.Directional;
            rim.color = new Color(0.55f, 0.85f, 1f);
            rim.intensity = 0.7f;
            rim.shadows = LightShadows.None;
            rim.transform.rotation = Quaternion.Euler(25f, 152f, 0f);

            // Ambiente: cielo caribeño
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.62f, 0.86f, 0.95f);
            RenderSettings.ambientEquatorColor = new Color(0.75f, 0.85f, 0.75f);
            RenderSettings.ambientGroundColor = new Color(0.55f, 0.5f, 0.42f);
        }

        private static Material ToonMat(string name, Color color)
        {
            var shader = Shader.Find("IslaAuria/StylizedToon");
            var mat = new Material(shader) { name = name };
            mat.SetColor("_BaseColor", color);
            return mat;
        }

        private static void BuildEnvironment()
        {
            var env = new GameObject("Environment");

            // Piso de piedra clara
            var floor = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            floor.name = "StoneFloor";
            floor.transform.SetParent(env.transform);
            floor.transform.localScale = new Vector3(14f, 0.1f, 8f);
            floor.transform.position = new Vector3(0f, -0.1f, 0f);
            floor.GetComponent<Renderer>().sharedMaterial = ToonMat("ShowcaseFloor", new Color(0.91f, 0.86f, 0.75f));

            // Fondo: pared curva turquesa (gradiente con la niebla)
            var backdrop = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            backdrop.name = "Backdrop";
            backdrop.transform.SetParent(env.transform);
            backdrop.transform.localScale = new Vector3(60f, 30f, 60f);
            backdrop.transform.position = new Vector3(0f, 4f, 0f);
            var backMat = ToonMat("ShowcaseBackdrop", new Color(0.5f, 0.83f, 0.91f));
            backMat.SetFloat("_RimIntensity", 0f);
            backdrop.GetComponent<Renderer>().sharedMaterial = backMat;
            // Invertir: que se vea desde dentro
            backdrop.transform.localScale = new Vector3(-60f, 30f, -60f);

            // Palmeras proxy a los lados (vibra tropical sin distraer)
            var trunkMat = ToonMat("ShowcaseTrunk", new Color(0.55f, 0.35f, 0.17f));
            var leafMat = ToonMat("ShowcaseLeaf", new Color(0.18f, 0.63f, 0.37f));
            foreach (float x in new[] { -7f, 7f })
            {
                var trunk = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                trunk.transform.SetParent(env.transform);
                trunk.transform.position = new Vector3(x, 1.4f, 4f);
                trunk.transform.localScale = new Vector3(0.3f, 1.4f, 0.3f);
                trunk.GetComponent<Renderer>().sharedMaterial = trunkMat;
                var crown = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                crown.transform.SetParent(env.transform);
                crown.transform.position = new Vector3(x, 3.2f, 4f);
                crown.transform.localScale = new Vector3(1.8f, 1f, 1.8f);
                crown.GetComponent<Renderer>().sharedMaterial = leafMat;
            }
        }

        private static Transform BuildCharacters()
        {
            var row = new GameObject("Characters");
            var cycler = row.AddComponent<ShowcaseAnimationCycler>();

            float spacing = 1.9f;
            float startX = -(Characters.Length - 1) * spacing * 0.5f;

            for (int i = 0; i < Characters.Length; i++)
            {
                string name = Characters[i];
                string path = $"Assets/Characters/{name}/Prefabs/{name}.prefab";
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if (prefab == null)
                {
                    // Construirlo al vuelo si aún no existe
                    CharacterPrefabBuilder.BuildCharacter(name, instantiate: false);
                    prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                }
                if (prefab == null) continue;

                var instance = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
                instance.transform.SetParent(row.transform);
                instance.transform.position = new Vector3(startX + i * spacing, 0f, 0f);
                instance.transform.rotation = Quaternion.Euler(0f, 180f, 0f); // mirando a cámara

                var animator = instance.GetComponent<Animator>();
                if (animator != null) cycler.characters.Add(animator);

                // Etiqueta con el nombre
                var label = new GameObject($"Label_{name}");
                label.transform.SetParent(row.transform);
                label.transform.position = new Vector3(startX + i * spacing, 2.45f, 0f);
                label.transform.rotation = Quaternion.Euler(0f, 180f, 0f);
                var text = label.AddComponent<TextMesh>();
                text.text = name;
                text.fontSize = 48;
                text.characterSize = 0.045f;
                text.anchor = TextAnchor.MiddleCenter;
                text.color = new Color(1f, 0.95f, 0.8f);
            }

            return row.transform;
        }

        private static void BuildCamera(Transform pivot)
        {
            var camGo = new GameObject("ShowcaseCamera");
            var cam = camGo.AddComponent<Camera>();
            cam.fieldOfView = 45f;
            cam.nearClipPlane = 0.1f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.5f, 0.83f, 0.91f);
            camGo.tag = "MainCamera";

            var pivotGo = new GameObject("CameraPivot");
            pivotGo.transform.position = new Vector3(0f, 1.1f, 0f);

            var orbit = camGo.AddComponent<ShowcaseOrbitCamera>();
            orbit.pivot = pivotGo.transform;
            orbit.distance = 7.5f;
        }
    }
}
