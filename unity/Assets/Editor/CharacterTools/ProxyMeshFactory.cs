using UnityEditor;
using UnityEngine;
using IslaAuria.Characters;

namespace IslaAuria.EditorTools
{
    /// <summary>
    /// Construye los modelos proxy estilizados de cada personaje usando
    /// geometría generada (Capa 1 del pipeline). No son la escultura final,
    /// pero tienen silueta, proporciones, colores y accesorios fieles al
    /// concept art, listos para reemplazarse por un FBX/GLB (Capa 2, ver
    /// Character_Art_Implementation_Guide.md).
    ///
    /// Convenciones:
    ///  - Root en los pies, +Z es el frente del personaje.
    ///  - Todo el proxy cuelga de "MeshContainer".
    ///  - Los puntos de anclaje cuelgan de "AttachPoints".
    /// </summary>
    public static class ProxyMeshFactory
    {
        // ------------------------------------------------------------
        // Helpers de construcción
        // ------------------------------------------------------------

        private static Material M(string name) => StylizedMaterialLibrary.Get(name);

        /// <summary>Crea una pieza primitiva sin collider, con material toon.</summary>
        private static GameObject Part(string name, PrimitiveType type, Transform parent,
            Vector3 pos, Vector3 euler, Vector3 scale, Material mat)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            Object.DestroyImmediate(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localEulerAngles = euler;
            go.transform.localScale = scale;
            go.GetComponent<Renderer>().sharedMaterial = mat;
            return go;
        }

        /// <summary>Cono generado (Unity no trae cono primitivo).</summary>
        private static GameObject Cone(string name, Transform parent, Vector3 pos,
            Vector3 euler, float radius, float height, Material mat, int segments = 12)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localEulerAngles = euler;
            var filter = go.AddComponent<MeshFilter>();
            filter.sharedMesh = BuildConeMesh(radius, height, segments);
            var rend = go.AddComponent<MeshRenderer>();
            rend.sharedMaterial = mat;
            return go;
        }

        /// <summary>Malla de cono con base en y=0 y punta en y=height.</summary>
        private static Mesh BuildConeMesh(float radius, float height, int segments)
        {
            var mesh = new Mesh { name = $"Cone_{radius}_{height}" };
            int vertCount = segments + 2; // anillo + punta + centro base
            var verts = new Vector3[vertCount];
            for (int i = 0; i < segments; i++)
            {
                float a = i / (float)segments * Mathf.PI * 2f;
                verts[i] = new Vector3(Mathf.Cos(a) * radius, 0f, Mathf.Sin(a) * radius);
            }
            verts[segments] = new Vector3(0f, height, 0f); // punta
            verts[segments + 1] = Vector3.zero;            // centro de la base

            var tris = new int[segments * 6];
            for (int i = 0; i < segments; i++)
            {
                int next = (i + 1) % segments;
                // lateral
                tris[i * 6 + 0] = i;
                tris[i * 6 + 1] = segments;
                tris[i * 6 + 2] = next;
                // base
                tris[i * 6 + 3] = next;
                tris[i * 6 + 4] = segments + 1;
                tris[i * 6 + 5] = i;
            }
            mesh.vertices = verts;
            mesh.triangles = tris;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>Ojos grandes y expresivos: esclerótica + pupila + brillo.</summary>
        private static void Eyes(Transform head, float spacing, float y, float z, float size)
        {
            foreach (int side in new[] { -1, 1 })
            {
                var eye = Part($"Eye_{(side < 0 ? "L" : "R")}", PrimitiveType.Sphere, head,
                    new Vector3(spacing * side, y, z), Vector3.zero,
                    Vector3.one * size, M("MAT_Eye_White"));
                Part("Pupil", PrimitiveType.Sphere, eye.transform,
                    new Vector3(0f, 0f, 0.38f), Vector3.zero,
                    Vector3.one * 0.55f, M("MAT_Eye_Dark"));
                Part("Highlight", PrimitiveType.Sphere, eye.transform,
                    new Vector3(0.16f, 0.18f, 0.45f), Vector3.zero,
                    Vector3.one * 0.18f, M("MAT_Eye_White"));
            }
        }

        /// <summary>Marca una pieza como mágica: emisión pulsante.</summary>
        private static void Glow(GameObject part, Color emission, float min = 0.7f, float max = 1.5f)
        {
            var pulse = part.AddComponent<GlowPulse>();
            pulse.emissionColor = emission;
            pulse.minIntensity = min;
            pulse.maxIntensity = max;
        }

        /// <summary>Crea los contenedores estándar del prefab y devuelve el root.</summary>
        private static (GameObject root, Transform mesh, Transform attach, Transform vfx) Skeleton(string name)
        {
            var root = new GameObject(name);
            var rig = new GameObject("Rig");
            rig.transform.SetParent(root.transform, false);
            var mesh = new GameObject("MeshContainer");
            mesh.transform.SetParent(root.transform, false);
            var attach = new GameObject("AttachPoints");
            attach.transform.SetParent(root.transform, false);
            var vfx = new GameObject("VFX");
            vfx.transform.SetParent(root.transform, false);
            return (root, mesh.transform, attach.transform, vfx.transform);
        }

        private static void AttachPoint(Transform container, string name, Vector3 pos)
        {
            var point = new GameObject(name);
            point.transform.SetParent(container, false);
            point.transform.localPosition = pos;
        }

        private static readonly Color AuralisGlow = new Color(0.18f, 0.77f, 0.71f) * 2.2f;
        private static readonly Color LioraGlow = new Color(1f, 0.83f, 0.3f) * 2.6f;
        private static readonly Color NoxiaGlow = new Color(0.48f, 0.18f, 0.82f) * 2.4f;

        // ------------------------------------------------------------
        // 1. MAEL VEYRA — joven aventurero isleño
        // ------------------------------------------------------------
        public static GameObject BuildMael()
        {
            var (root, mesh, attach, _) = Skeleton("Mael");

            // Piernas y botas de aventura
            foreach (int side in new[] { -1, 1 })
            {
                string s = side < 0 ? "L" : "R";
                Part($"Leg_{s}", PrimitiveType.Capsule, mesh,
                    new Vector3(0.11f * side, 0.42f, 0f), Vector3.zero,
                    new Vector3(0.16f, 0.24f, 0.16f), M("MAT_Cloth_Cream"));
                Part($"Boot_{s}", PrimitiveType.Cube, mesh,
                    new Vector3(0.11f * side, 0.08f, 0.04f), Vector3.zero,
                    new Vector3(0.17f, 0.16f, 0.28f), M("MAT_Leather_Brown"));
            }

            // Torso teal con sash cruzado crema y cinturón
            Part("Torso", PrimitiveType.Capsule, mesh,
                new Vector3(0f, 0.95f, 0f), Vector3.zero,
                new Vector3(0.42f, 0.3f, 0.3f), M("MAT_Cloth_Teal"));
            Part("Sash", PrimitiveType.Cube, mesh,
                new Vector3(0.02f, 0.98f, 0.12f), new Vector3(0f, 0f, 38f),
                new Vector3(0.14f, 0.52f, 0.16f), M("MAT_Cloth_Cream"));
            Part("SashTrim", PrimitiveType.Cube, mesh,
                new Vector3(0.02f, 0.98f, 0.125f), new Vector3(0f, 0f, 38f),
                new Vector3(0.05f, 0.53f, 0.16f), M("MAT_Gold_Stylized"));
            Part("Belt", PrimitiveType.Cylinder, mesh,
                new Vector3(0f, 0.72f, 0f), Vector3.zero,
                new Vector3(0.4f, 0.04f, 0.32f), M("MAT_Leather_Brown"));

            // Artefacto mágico circular en el cinturón (glow Auralis)
            var artifact = Part("Waist_Artifact_Mesh", PrimitiveType.Cylinder, mesh,
                new Vector3(0f, 0.72f, 0.17f), new Vector3(90f, 0f, 0f),
                new Vector3(0.13f, 0.02f, 0.13f), M("MAT_Auralis_Glow_Teal"));
            Glow(artifact, AuralisGlow);

            // Brazos con brazaletes dorados
            foreach (int side in new[] { -1, 1 })
            {
                string s = side < 0 ? "L" : "R";
                Part($"Arm_{s}", PrimitiveType.Capsule, mesh,
                    new Vector3(0.3f * side, 0.98f, 0f), new Vector3(0f, 0f, 18f * side),
                    new Vector3(0.13f, 0.23f, 0.13f), M("MAT_Skin_Warm"));
                Part($"Bracelet_{s}", PrimitiveType.Cylinder, mesh,
                    new Vector3(0.37f * side, 0.8f, 0f), new Vector3(0f, 0f, 18f * side),
                    new Vector3(0.11f, 0.03f, 0.11f), M("MAT_Gold_Stylized"));
                // Manos un poco exageradas (estilo platformer)
                Part($"Hand_{s}_Mesh", PrimitiveType.Sphere, mesh,
                    new Vector3(0.4f * side, 0.72f, 0f), Vector3.zero,
                    Vector3.one * 0.15f, M("MAT_Skin_Warm"));
            }

            // Cabeza grande con pelo oscuro despeinado
            var head = Part("Head", PrimitiveType.Sphere, mesh,
                new Vector3(0f, 1.5f, 0f), Vector3.zero,
                Vector3.one * 0.46f, M("MAT_Skin_Warm"));
            Eyes(head.transform, 0.22f, 0.08f, 0.42f, 0.16f);
            // Mechones despeinados: esferas achatadas en ángulos variados
            var hairOffsets = new[]
            {
                (new Vector3(0f, 0.32f, -0.05f), new Vector3(0f, 0f, 0f), new Vector3(0.95f, 0.55f, 0.95f)),
                (new Vector3(0.25f, 0.28f, 0.12f), new Vector3(20f, 0f, -25f), new Vector3(0.45f, 0.3f, 0.5f)),
                (new Vector3(-0.25f, 0.3f, 0.08f), new Vector3(15f, 0f, 25f), new Vector3(0.45f, 0.3f, 0.5f)),
                (new Vector3(0f, 0.28f, 0.3f), new Vector3(35f, 0f, 0f), new Vector3(0.5f, 0.28f, 0.45f)),
                (new Vector3(0.05f, 0.2f, -0.32f), new Vector3(-30f, 0f, 0f), new Vector3(0.55f, 0.35f, 0.5f)),
            };
            foreach (var (pos, euler, scale) in hairOffsets)
            {
                Part("Hair", PrimitiveType.Sphere, head.transform, pos, euler, scale, M("MAT_Hair_Dark"));
            }

            // Puntos de anclaje pedidos en el brief
            AttachPoint(attach, "Hand_R", new Vector3(0.4f, 0.72f, 0f));
            AttachPoint(attach, "Hand_L", new Vector3(-0.4f, 0.72f, 0f));
            AttachPoint(attach, "Back", new Vector3(0f, 1.05f, -0.18f));
            AttachPoint(attach, "Waist_Artifact", new Vector3(0f, 0.72f, 0.18f));
            AttachPoint(attach, "Head", new Vector3(0f, 1.72f, 0f));
            AttachPoint(attach, "Feet", new Vector3(0f, 0.02f, 0f));

            return root;
        }

        // ------------------------------------------------------------
        // 2. ORYN — perrito mágico marino
        // ------------------------------------------------------------
        public static GameObject BuildOryn()
        {
            var (root, mesh, attach, _) = Skeleton("Oryn");

            // Cuerpo horizontal blanco con lomo azul
            Part("Body", PrimitiveType.Capsule, mesh,
                new Vector3(0f, 0.28f, 0f), new Vector3(90f, 0f, 0f),
                new Vector3(0.3f, 0.26f, 0.3f), M("MAT_Fur_White"));
            Part("BackFur", PrimitiveType.Capsule, mesh,
                new Vector3(0f, 0.36f, -0.02f), new Vector3(90f, 0f, 0f),
                new Vector3(0.26f, 0.24f, 0.2f), M("MAT_Fur_Blue"));

            // Patas
            foreach (var (x, z) in new[] { (-0.12f, 0.16f), (0.12f, 0.16f), (-0.12f, -0.16f), (0.12f, -0.16f) })
            {
                Part("Leg", PrimitiveType.Capsule, mesh,
                    new Vector3(x, 0.1f, z), Vector3.zero,
                    new Vector3(0.08f, 0.1f, 0.08f), M("MAT_Fur_White"));
            }

            // Cabeza grande y expresiva con hocico
            var head = Part("Head", PrimitiveType.Sphere, mesh,
                new Vector3(0f, 0.5f, 0.3f), Vector3.zero,
                Vector3.one * 0.34f, M("MAT_Fur_White"));
            Part("Snout", PrimitiveType.Sphere, head.transform,
                new Vector3(0f, -0.12f, 0.42f), Vector3.zero,
                new Vector3(0.5f, 0.35f, 0.45f), M("MAT_Fur_White"));
            Part("Nose", PrimitiveType.Sphere, head.transform,
                new Vector3(0f, -0.04f, 0.62f), Vector3.zero,
                Vector3.one * 0.14f, M("MAT_Eye_Dark"));
            Eyes(head.transform, 0.2f, 0.12f, 0.4f, 0.2f);

            // Orejas enormes azules (silueta inconfundible)
            foreach (int side in new[] { -1, 1 })
            {
                Cone($"Ear_{(side < 0 ? "L" : "R")}", head.transform,
                    new Vector3(0.16f * side, 0.28f, -0.02f),
                    new Vector3(-12f, 0f, -18f * side), 0.1f, 0.42f, M("MAT_Fur_Blue"));
            }

            // Collar dorado con gema teal
            Part("Collar", PrimitiveType.Cylinder, mesh,
                new Vector3(0f, 0.42f, 0.18f), new Vector3(78f, 0f, 0f),
                new Vector3(0.24f, 0.025f, 0.24f), M("MAT_Gold_Stylized"));
            var gem = Part("Collar_Gem_Mesh", PrimitiveType.Sphere, mesh,
                new Vector3(0f, 0.36f, 0.33f), Vector3.zero,
                Vector3.one * 0.07f, M("MAT_Auralis_Glow_Teal"));
            Glow(gem, AuralisGlow);

            // Cola de agua luminosa (la marca de la Noxia)
            var tail = Cone("Tail_Glow_Mesh", mesh,
                new Vector3(0f, 0.36f, -0.3f), new Vector3(-125f, 0f, 0f),
                0.07f, 0.4f, M("MAT_Auralis_Glow_Teal"));
            Glow(tail, AuralisGlow, 0.8f, 1.8f);

            AttachPoint(attach, "Head", new Vector3(0f, 0.62f, 0.3f));
            AttachPoint(attach, "Tail_Glow", new Vector3(0f, 0.42f, -0.46f));
            AttachPoint(attach, "Mouth", new Vector3(0f, 0.4f, 0.55f));
            AttachPoint(attach, "Collar_Gem", new Vector3(0f, 0.36f, 0.33f));

            return root;
        }

        // ------------------------------------------------------------
        // 3. ELARIA DEL ALBA — guardiana luminosa
        // ------------------------------------------------------------
        public static GameObject BuildElaria()
        {
            var (root, mesh, attach, vfx) = Skeleton("Elaria");
            // Flota: todo el mesh ligeramente elevado
            mesh.localPosition = new Vector3(0f, 0.25f, 0f);

            // Falda larga (cono invertido) crema con bajo dorado
            Cone("Skirt", mesh, new Vector3(0f, 0.02f, 0f), Vector3.zero, 0.42f, 1.05f, M("MAT_Cloth_Cream"));
            Part("SkirtHem", PrimitiveType.Cylinder, mesh,
                new Vector3(0f, 0.05f, 0f), Vector3.zero,
                new Vector3(0.8f, 0.025f, 0.8f), M("MAT_Gold_Stylized"));

            // Torso perlado y hombreras doradas
            Part("Torso", PrimitiveType.Capsule, mesh,
                new Vector3(0f, 1.2f, 0f), Vector3.zero,
                new Vector3(0.3f, 0.26f, 0.24f), M("MAT_Pearl_White"));
            foreach (int side in new[] { -1, 1 })
            {
                Part("Pauldron", PrimitiveType.Sphere, mesh,
                    new Vector3(0.24f * side, 1.4f, 0f), Vector3.zero,
                    new Vector3(0.16f, 0.1f, 0.16f), M("MAT_Gold_Stylized"));
                Part($"Arm_{(side < 0 ? "L" : "R")}", PrimitiveType.Capsule, mesh,
                    new Vector3(0.28f * side, 1.15f, 0.06f), new Vector3(-12f, 0f, 14f * side),
                    new Vector3(0.09f, 0.24f, 0.09f), M("MAT_Pearl_White"));
            }

            // Luz del pecho
            var chest = Part("Chest_Light_Mesh", PrimitiveType.Sphere, mesh,
                new Vector3(0f, 1.32f, 0.12f), Vector3.zero,
                Vector3.one * 0.09f, M("MAT_Liora_Glow_Gold"));
            Glow(chest, LioraGlow);

            // Cabeza serena con pelo largo dorado y halo solar
            var head = Part("Head", PrimitiveType.Sphere, mesh,
                new Vector3(0f, 1.72f, 0f), Vector3.zero,
                Vector3.one * 0.34f, M("MAT_Skin_Warm"));
            Eyes(head.transform, 0.18f, 0.05f, 0.42f, 0.12f);
            Part("HairCrown", PrimitiveType.Sphere, head.transform,
                new Vector3(0f, 0.25f, -0.05f), Vector3.zero,
                new Vector3(1f, 0.6f, 1f), M("MAT_Gold_Stylized"));
            Part("HairBack", PrimitiveType.Capsule, mesh,
                new Vector3(0f, 1.3f, -0.2f), new Vector3(8f, 0f, 0f),
                new Vector3(0.22f, 0.5f, 0.14f), M("MAT_Gold_Stylized"));
            var halo = Part("Head_Halo_Mesh", PrimitiveType.Cylinder, mesh,
                new Vector3(0f, 1.95f, -0.12f), new Vector3(75f, 0f, 0f),
                new Vector3(0.5f, 0.012f, 0.5f), M("MAT_Liora_Glow_Gold"));
            Glow(halo, LioraGlow, 0.5f, 1.1f);

            // Velos rosados translúcidos flotando
            foreach (int side in new[] { -1, 1 })
            {
                Part("Veil", PrimitiveType.Quad, mesh,
                    new Vector3(0.3f * side, 1.0f, -0.15f), new Vector3(12f, 165f * side, 8f * side),
                    new Vector3(0.4f, 0.9f, 1f), M("MAT_Soft_Pink_Transparent"));
            }

            // Cetro con núcleo de luz
            var staff = Part("Staff", PrimitiveType.Cylinder, mesh,
                new Vector3(0.36f, 1.0f, 0.1f), new Vector3(0f, 0f, 8f),
                new Vector3(0.035f, 0.75f, 0.035f), M("MAT_Gold_Stylized"));
            var staffCore = Part("Staff_Glow", PrimitiveType.Sphere, staff.transform,
                new Vector3(0f, 1.1f, 0f), Vector3.zero,
                new Vector3(3.4f, 0.16f, 3.4f), M("MAT_Liora_Glow_Gold"));
            Glow(staffCore, LioraGlow, 0.9f, 1.8f);

            // Aura de partículas suaves
            AddSoftParticles(vfx, new Color(1f, 0.93f, 0.7f), 0.9f, 6f);

            AttachPoint(attach, "Staff_Top", new Vector3(0.46f, 2.1f, 0.1f));
            AttachPoint(attach, "Chest_Light", new Vector3(0f, 1.57f, 0.12f));
            AttachPoint(attach, "Head_Halo", new Vector3(0f, 2.2f, -0.12f));
            AttachPoint(attach, "Hands", new Vector3(-0.32f, 1.25f, 0.12f));

            return root;
        }

        // ------------------------------------------------------------
        // 4. LIORA — el Primer Destello (espíritu/VFX)
        // ------------------------------------------------------------
        public static GameObject BuildLiora()
        {
            var (root, mesh, attach, vfx) = Skeleton("Liora");
            mesh.localPosition = new Vector3(0f, 1.2f, 0f); // flota por defecto

            // Núcleo dorado vivo
            var core = Part("Core", PrimitiveType.Sphere, mesh,
                Vector3.zero, Vector3.zero, Vector3.one * 0.22f, M("MAT_Liora_Glow_Gold"));
            Glow(core, LioraGlow, 1f, 2f);

            // Carita tierna (ojitos diminutos)
            Eyes(core.transform, 0.28f, 0.12f, 0.42f, 0.16f);

            // "Pétalos" de luz alrededor (silueta de chispa)
            for (int i = 0; i < 5; i++)
            {
                float angle = i / 5f * 360f;
                var petal = Cone($"Spark_{i}", mesh, Vector3.zero,
                    new Vector3(0f, 0f, angle), 0.045f, 0.24f, M("MAT_Liora_Glow_Gold"));
                petal.transform.localPosition = Quaternion.Euler(0f, 0f, angle) * new Vector3(0f, 0.16f, 0f);
            }

            // Halo translúcido
            Part("Halo", PrimitiveType.Sphere, mesh,
                Vector3.zero, Vector3.zero, Vector3.one * 0.36f, M("MAT_Soft_Pink_Transparent"));

            // Luz real + chispas + estela dorada
            var lightGo = new GameObject("PointLight");
            lightGo.transform.SetParent(mesh, false);
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = new Color(1f, 0.85f, 0.45f);
            light.intensity = 1.4f;
            light.range = 5f;

            AddSoftParticles(vfx, new Color(1f, 0.88f, 0.45f), 1.4f, 10f);
            AddGoldTrail(mesh);

            AttachPoint(attach, "Core", new Vector3(0f, 1.2f, 0f));

            return root;
        }

        // ------------------------------------------------------------
        // 5. VARKON — investigador corrupto (jefe)
        // ------------------------------------------------------------
        public static GameObject BuildVarkon()
        {
            var (root, mesh, attach, vfx) = Skeleton("Varkon");

            // Piernas acorazadas
            foreach (int side in new[] { -1, 1 })
            {
                Part($"Leg_{(side < 0 ? "L" : "R")}", PrimitiveType.Capsule, mesh,
                    new Vector3(0.14f * side, 0.55f, 0f), Vector3.zero,
                    new Vector3(0.2f, 0.32f, 0.2f), M("MAT_Dark_Armor"));
            }

            // Torso angular (cubos rotados = silueta agresiva)
            Part("Torso", PrimitiveType.Cube, mesh,
                new Vector3(0f, 1.25f, 0f), Vector3.zero,
                new Vector3(0.52f, 0.6f, 0.34f), M("MAT_Cloth_DarkPurple"));
            Part("ChestPlate", PrimitiveType.Cube, mesh,
                new Vector3(0f, 1.4f, 0.12f), new Vector3(8f, 0f, 0f),
                new Vector3(0.46f, 0.34f, 0.16f), M("MAT_Dark_Armor"));
            foreach (int side in new[] { -1, 1 })
            {
                // Hombreras enormes en rombo con cristal corrupto
                var pauldron = Part($"Pauldron_{(side < 0 ? "L" : "R")}", PrimitiveType.Cube, mesh,
                    new Vector3(0.4f * side, 1.62f, 0f), new Vector3(0f, 0f, 45f),
                    new Vector3(0.26f, 0.26f, 0.26f), M("MAT_Dark_Armor"));
                Part("PauldronTrim", PrimitiveType.Cube, pauldron.transform,
                    Vector3.zero, Vector3.zero, new Vector3(1.06f, 1.06f, 0.4f), M("MAT_Old_Gold"));
                var crystal = Part("CorruptCrystal", PrimitiveType.Cube, mesh,
                    new Vector3(0.42f * side, 1.85f, 0f), new Vector3(25f, 30f, 45f),
                    new Vector3(0.1f, 0.22f, 0.1f), M("MAT_Noxia_Glow_Violet"));
                Glow(crystal, NoxiaGlow);

                Part($"Arm_{(side < 0 ? "L" : "R")}", PrimitiveType.Capsule, mesh,
                    new Vector3(0.42f * side, 1.2f, 0f), new Vector3(0f, 0f, 12f * side),
                    new Vector3(0.14f, 0.3f, 0.14f), M("MAT_Cloth_DarkPurple"));
            }

            // Núcleo de Noxia en el pecho
            var core = Part("Chest_Core_Mesh", PrimitiveType.Sphere, mesh,
                new Vector3(0f, 1.42f, 0.21f), Vector3.zero,
                Vector3.one * 0.12f, M("MAT_Noxia_Glow_Violet"));
            Glow(core, NoxiaGlow, 0.9f, 2f);

            // Cabeza encapuchada con ojos violeta brillantes
            var head = Part("Head", PrimitiveType.Sphere, mesh,
                new Vector3(0f, 1.95f, 0f), Vector3.zero,
                Vector3.one * 0.36f, M("MAT_Cloth_DarkPurple"));
            Cone("Hood", head.transform, new Vector3(0f, 0.05f, -0.05f),
                new Vector3(-8f, 0f, 0f), 0.46f, 0.55f, M("MAT_Cloth_DarkPurple"));
            foreach (int side in new[] { -1, 1 })
            {
                var eye = Part($"EyeGlow_{(side < 0 ? "L" : "R")}", PrimitiveType.Sphere, head.transform,
                    new Vector3(0.16f * side, 0.02f, 0.4f), Vector3.zero,
                    new Vector3(0.14f, 0.08f, 0.06f), M("MAT_Noxia_Glow_Violet"));
                Glow(eye, NoxiaGlow, 1f, 1.6f);
            }

            // Capa rota: dos paneles oscuros desincronizados
            Part("Cape_A", PrimitiveType.Quad, mesh,
                new Vector3(0.12f, 1.2f, -0.24f), new Vector3(8f, 180f, 4f),
                new Vector3(0.45f, 1.2f, 1f), M("MAT_Cloth_DarkPurple"));
            Part("Cape_B", PrimitiveType.Quad, mesh,
                new Vector3(-0.16f, 1.1f, -0.26f), new Vector3(5f, 180f, -7f),
                new Vector3(0.4f, 1.0f, 1f), M("MAT_Cloth_DarkPurple"));

            // Bastón con cristal de Noxia
            var staff = Part("Staff", PrimitiveType.Cylinder, mesh,
                new Vector3(0.5f, 1.1f, 0.05f), new Vector3(0f, 0f, 5f),
                new Vector3(0.04f, 0.95f, 0.04f), M("MAT_Old_Gold"));
            var staffCrystal = Part("StaffCrystal", PrimitiveType.Cube, staff.transform,
                new Vector3(0f, 1.12f, 0f), new Vector3(45f, 45f, 0f),
                new Vector3(2.6f, 0.12f, 2.6f), M("MAT_Noxia_Glow_Violet"));
            Glow(staffCrystal, NoxiaGlow, 1f, 2.2f);

            AddSoftParticles(vfx, new Color(0.55f, 0.25f, 0.85f), 1.2f, 8f);

            AttachPoint(attach, "Hand_R", new Vector3(0.5f, 0.95f, 0.05f));
            AttachPoint(attach, "Hand_L", new Vector3(-0.5f, 0.95f, 0.05f));
            AttachPoint(attach, "Chest_Core", new Vector3(0f, 1.42f, 0.22f));
            AttachPoint(attach, "Staff_Top", new Vector3(0.55f, 2.15f, 0.05f));
            AttachPoint(attach, "Back_Cape", new Vector3(0f, 1.6f, -0.26f));

            return root;
        }

        // ------------------------------------------------------------
        // 6. SERALYA — erudita arcana (jefa)
        // ------------------------------------------------------------
        public static GameObject BuildSeralya()
        {
            var (root, mesh, attach, vfx) = Skeleton("Seralya");

            // Falda elegante violeta oscuro con bajo dorado
            Cone("Skirt", mesh, new Vector3(0f, 0.02f, 0f), Vector3.zero, 0.36f, 1.0f, M("MAT_Cloth_DarkPurple"));
            Part("SkirtHem", PrimitiveType.Cylinder, mesh,
                new Vector3(0f, 0.05f, 0f), Vector3.zero,
                new Vector3(0.68f, 0.02f, 0.68f), M("MAT_Gold_Stylized"));

            // Torso con paneles crema y ornamentos dorados
            Part("Torso", PrimitiveType.Capsule, mesh,
                new Vector3(0f, 1.15f, 0f), Vector3.zero,
                new Vector3(0.28f, 0.25f, 0.22f), M("MAT_Cloth_DarkPurple"));
            Part("CreamPanel", PrimitiveType.Cube, mesh,
                new Vector3(0f, 1.15f, 0.1f), Vector3.zero,
                new Vector3(0.16f, 0.42f, 0.08f), M("MAT_Cloth_Cream"));
            Part("GoldCollar", PrimitiveType.Cylinder, mesh,
                new Vector3(0f, 1.38f, 0f), Vector3.zero,
                new Vector3(0.24f, 0.02f, 0.2f), M("MAT_Gold_Stylized"));

            // Gema violeta en el pecho
            var gem = Part("Chest_Gem_Mesh", PrimitiveType.Sphere, mesh,
                new Vector3(0f, 1.3f, 0.12f), Vector3.zero,
                Vector3.one * 0.08f, M("MAT_Noxia_Glow_Violet"));
            Glow(gem, NoxiaGlow);

            // Brazos con guantes largos
            foreach (int side in new[] { -1, 1 })
            {
                Part($"Arm_{(side < 0 ? "L" : "R")}", PrimitiveType.Capsule, mesh,
                    new Vector3(0.26f * side, 1.12f, 0.05f), new Vector3(-10f, 0f, 16f * side),
                    new Vector3(0.085f, 0.24f, 0.085f), M("MAT_Cloth_Cream"));
            }

            // Cabeza refinada: moño alto, diadema dorada
            var head = Part("Head", PrimitiveType.Sphere, mesh,
                new Vector3(0f, 1.66f, 0f), Vector3.zero,
                Vector3.one * 0.32f, M("MAT_Skin_Warm"));
            Eyes(head.transform, 0.17f, 0.05f, 0.42f, 0.11f);
            Part("HairCrown", PrimitiveType.Sphere, head.transform,
                new Vector3(0f, 0.22f, -0.08f), Vector3.zero,
                new Vector3(1f, 0.7f, 1f), M("MAT_Hair_Dark"));
            Part("HairBun", PrimitiveType.Sphere, head.transform,
                new Vector3(0f, 0.48f, -0.1f), Vector3.zero,
                Vector3.one * 0.45f, M("MAT_Hair_Dark"));
            Part("Head_Crown_Mesh", PrimitiveType.Cylinder, head.transform,
                new Vector3(0f, 0.3f, 0.05f), new Vector3(12f, 0f, 0f),
                new Vector3(0.95f, 0.04f, 0.95f), M("MAT_Gold_Stylized"));

            // Libro arcano flotante junto a la mano izquierda
            var book = new GameObject("FloatingBook");
            book.transform.SetParent(mesh, false);
            book.transform.localPosition = new Vector3(-0.5f, 1.25f, 0.2f);
            book.transform.localEulerAngles = new Vector3(-20f, 25f, 0f);
            Part("Cover", PrimitiveType.Cube, book.transform,
                Vector3.zero, Vector3.zero, new Vector3(0.3f, 0.04f, 0.4f), M("MAT_Cloth_DarkPurple"));
            Part("Pages", PrimitiveType.Cube, book.transform,
                new Vector3(0f, 0.025f, 0f), Vector3.zero,
                new Vector3(0.27f, 0.02f, 0.37f), M("MAT_Cloth_Cream"));
            Part("Spine", PrimitiveType.Cube, book.transform,
                new Vector3(-0.15f, 0f, 0f), Vector3.zero,
                new Vector3(0.03f, 0.05f, 0.41f), M("MAT_Old_Gold"));
            var rune = Part("BookRune", PrimitiveType.Cylinder, book.transform,
                new Vector3(0f, 0.06f, 0f), Vector3.zero,
                new Vector3(0.16f, 0.005f, 0.16f), M("MAT_Noxia_Glow_Violet"));
            Glow(rune, NoxiaGlow, 0.8f, 1.6f);

            // Círculo de runas bajo sus pies
            var circle = Part("RuneCircle", PrimitiveType.Cylinder, mesh,
                new Vector3(0f, 0.015f, 0f), Vector3.zero,
                new Vector3(0.9f, 0.004f, 0.9f), M("MAT_Noxia_Glow_Violet"));
            Glow(circle, NoxiaGlow * 0.6f, 0.4f, 0.9f);

            AddSoftParticles(vfx, new Color(0.6f, 0.35f, 0.9f), 1.0f, 6f);

            AttachPoint(attach, "Book_Point", new Vector3(-0.5f, 1.25f, 0.2f));
            AttachPoint(attach, "Hand_R", new Vector3(0.32f, 0.95f, 0.1f));
            AttachPoint(attach, "Hand_L", new Vector3(-0.32f, 0.95f, 0.1f));
            AttachPoint(attach, "Head_Crown", new Vector3(0f, 1.98f, 0.05f));
            AttachPoint(attach, "Chest_Gem", new Vector3(0f, 1.3f, 0.13f));

            return root;
        }

        // ------------------------------------------------------------
        // VFX compartidos
        // ------------------------------------------------------------

        /// <summary>Partículas flotantes suaves (aura mágica, barata para móvil).</summary>
        private static void AddSoftParticles(Transform vfx, Color color, float height, float rate)
        {
            var go = new GameObject("SoftParticles");
            go.transform.SetParent(vfx, false);
            go.transform.localPosition = new Vector3(0f, height, 0f);

            var ps = go.AddComponent<ParticleSystem>();
            var main = ps.main;
            main.startColor = color;
            main.startSize = new ParticleSystem.MinMaxCurve(0.03f, 0.08f);
            main.startSpeed = new ParticleSystem.MinMaxCurve(0.05f, 0.25f);
            main.startLifetime = new ParticleSystem.MinMaxCurve(1.2f, 2.2f);
            main.maxParticles = 40; // presupuesto móvil
            main.simulationSpace = ParticleSystemSimulationSpace.World;

            var emission = ps.emission;
            emission.rateOverTime = rate;

            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 0.45f;

            var renderer = go.GetComponent<ParticleSystemRenderer>();
            var shader = Shader.Find("Universal Render Pipeline/Particles/Unlit");
            if (shader != null)
            {
                var mat = new Material(shader);
                mat.SetColor("_BaseColor", color);
                renderer.sharedMaterial = mat;
            }
        }

        /// <summary>Estela dorada para Liora.</summary>
        private static void AddGoldTrail(Transform parent)
        {
            var go = new GameObject("GoldTrail");
            go.transform.SetParent(parent, false);
            var trail = go.AddComponent<TrailRenderer>();
            trail.time = 0.6f;
            trail.startWidth = 0.16f;
            trail.endWidth = 0.0f;
            trail.minVertexDistance = 0.05f;
            var shader = Shader.Find("Universal Render Pipeline/Particles/Unlit");
            if (shader != null)
            {
                var mat = new Material(shader);
                mat.SetColor("_BaseColor", new Color(1f, 0.85f, 0.4f, 0.8f));
                trail.sharedMaterial = mat;
            }
            var gradient = new Gradient();
            gradient.SetKeys(
                new[] { new GradientColorKey(new Color(1f, 0.9f, 0.55f), 0f), new GradientColorKey(new Color(1f, 0.7f, 0.2f), 1f) },
                new[] { new GradientAlphaKey(0.85f, 0f), new GradientAlphaKey(0f, 1f) });
            trail.colorGradient = gradient;
        }
    }
}
