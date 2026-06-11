using System.Collections.Generic;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

namespace IslaAuria.EditorTools
{
    /// <summary>
    /// Genera animaciones placeholder por código (bob, giro, salto, golpe…)
    /// y un AnimatorController por personaje. Animan el transform de
    /// "MeshContainer", así que siguen funcionando aunque el proxy se
    /// reemplace por el modelo final (hasta tener animaciones reales).
    /// </summary>
    public static class PlaceholderAnimationFactory
    {
        private const string MeshPath = "MeshContainer";

        // ---------- Helpers de curvas ----------

        private static AnimationClip NewClip(string name, bool loop)
        {
            var clip = new AnimationClip { name = name, frameRate = 30 };
            var settings = AnimationUtility.GetAnimationClipSettings(clip);
            settings.loopTime = loop;
            AnimationUtility.SetAnimationClipSettings(clip, settings);
            return clip;
        }

        private static void Curve(AnimationClip clip, string property, params Keyframe[] keys)
        {
            clip.SetCurve(MeshPath, typeof(Transform), property, new AnimationCurve(keys));
        }

        private static Keyframe K(float t, float v) => new Keyframe(t, v);

        // ---------- Clips genéricos ----------

        private static AnimationClip Idle(float baseY = 0f)
        {
            var clip = NewClip("Idle", true);
            Curve(clip, "localPosition.y", K(0f, baseY), K(0.75f, baseY + 0.04f), K(1.5f, baseY));
            Curve(clip, "localScale.y", K(0f, 1f), K(0.75f, 1.02f), K(1.5f, 1f));
            return clip;
        }

        private static AnimationClip Run(float baseY = 0f)
        {
            var clip = NewClip("Run", true);
            Curve(clip, "localPosition.y", K(0f, baseY), K(0.15f, baseY + 0.09f), K(0.3f, baseY));
            Curve(clip, "localEulerAngles.x", K(0f, 8f), K(0.3f, 8f)); // inclinado hacia delante
            return clip;
        }

        private static AnimationClip Jump(float baseY = 0f)
        {
            var clip = NewClip("Jump", false);
            Curve(clip, "localScale.y", K(0f, 0.85f), K(0.12f, 1.15f), K(0.45f, 1f));
            Curve(clip, "localPosition.y", K(0f, baseY), K(0.45f, baseY));
            return clip;
        }

        private static AnimationClip Spin(string name = "SpinAttack")
        {
            var clip = NewClip(name, false);
            Curve(clip, "localEulerAngles.y", K(0f, 0f), K(0.4f, 360f));
            return clip;
        }

        private static AnimationClip Hit(float baseY = 0f)
        {
            var clip = NewClip("Hit", false);
            Curve(clip, "localPosition.x", K(0f, 0f), K(0.06f, 0.08f), K(0.12f, -0.08f), K(0.2f, 0.04f), K(0.3f, 0f));
            Curve(clip, "localPosition.y", K(0f, baseY), K(0.3f, baseY));
            return clip;
        }

        private static AnimationClip Victory(float baseY = 0f)
        {
            var clip = NewClip("Victory", false);
            Curve(clip, "localPosition.y", K(0f, baseY), K(0.25f, baseY + 0.35f), K(0.5f, baseY), K(0.7f, baseY + 0.2f), K(0.9f, baseY));
            Curve(clip, "localEulerAngles.y", K(0f, 0f), K(0.9f, 360f));
            return clip;
        }

        private static AnimationClip Float(string name, float baseY, float amplitude = 0.1f)
        {
            var clip = NewClip(name, true);
            Curve(clip, "localPosition.y", K(0f, baseY), K(1f, baseY + amplitude), K(2f, baseY));
            return clip;
        }

        private static AnimationClip Pulse(string name = "Pulse")
        {
            var clip = NewClip(name, true);
            Curve(clip, "localScale.x", K(0f, 1f), K(0.4f, 1.18f), K(0.8f, 1f));
            Curve(clip, "localScale.y", K(0f, 1f), K(0.4f, 1.18f), K(0.8f, 1f));
            Curve(clip, "localScale.z", K(0f, 1f), K(0.4f, 1.18f), K(0.8f, 1f));
            return clip;
        }

        private static AnimationClip Cast(string name, float baseY = 0f)
        {
            var clip = NewClip(name, false);
            Curve(clip, "localEulerAngles.x", K(0f, 0f), K(0.2f, -14f), K(0.6f, 6f), K(0.9f, 0f));
            Curve(clip, "localPosition.y", K(0f, baseY), K(0.45f, baseY + 0.12f), K(0.9f, baseY));
            return clip;
        }

        private static AnimationClip Defeated(float baseY = 0f)
        {
            var clip = NewClip("Defeated", false);
            Curve(clip, "localEulerAngles.x", K(0f, 0f), K(0.6f, 78f));
            Curve(clip, "localPosition.y", K(0f, baseY), K(0.6f, baseY * 0.4f));
            return clip;
        }

        private static AnimationClip ScaleAway(string name)
        {
            var clip = NewClip(name, false);
            Curve(clip, "localScale.x", K(0f, 1f), K(0.5f, 0.001f));
            Curve(clip, "localScale.y", K(0f, 1f), K(0.5f, 0.001f));
            Curve(clip, "localScale.z", K(0f, 1f), K(0.5f, 0.001f));
            return clip;
        }

        // ---------- Sets por personaje ----------

        /// <summary>baseY: offset del MeshContainer (Elaria/Liora flotan).</summary>
        private static List<AnimationClip> ClipsFor(string character)
        {
            switch (character)
            {
                case "Mael":
                    return new List<AnimationClip>
                    {
                        Idle(), Run(), Jump(),
                        Rename(Jump(), "DoubleJump"),
                        Spin(), Hit(), Victory(),
                    };
                case "Oryn":
                    return new List<AnimationClip>
                    {
                        Idle(), Run(), Jump(),
                        Rename(Pulse("Bark"), "Bark"),
                        Rename(Cast("Sniff"), "Sniff"),
                        Rename(Hit(), "Alert"),
                        Rename(Victory(), "Happy"),
                    };
                case "Elaria":
                    return new List<AnimationClip>
                    {
                        Rename(Float("Idle", 0.25f), "Idle"),
                        Rename(Pulse("Speak"), "Speak"),
                        Rename(Cast("Blessing", 0.25f), "Blessing"),
                        Rename(ScaleAway("Disappear"), "Disappear"),
                    };
                case "Liora":
                    return new List<AnimationClip>
                    {
                        Rename(Float("Idle", 0f, 0.18f), "Idle"),
                        Pulse(),
                        Rename(Run(), "GuideForward"),
                        Rename(Victory(), "HappySpin"),
                        Rename(ScaleAway("Hide"), "Hide"),
                    };
                case "Varkon":
                    return new List<AnimationClip>
                    {
                        Idle(), Rename(Run(), "Walk"),
                        Rename(Cast("Cast"), "Cast"),
                        Rename(Spin("StaffStrike"), "StaffStrike"),
                        Rename(ScaleAway("Teleport"), "Teleport"),
                        Hit(), Defeated(),
                    };
                case "Seralya":
                    return new List<AnimationClip>
                    {
                        Idle(), Rename(Cast("CastRune"), "CastRune"),
                        Rename(Pulse("Shield"), "Shield"),
                        Rename(Cast("SummonBook"), "SummonBook"),
                        Rename(Spin("CloneCast"), "CloneCast"),
                        Hit(), Defeated(),
                    };
                default:
                    return new List<AnimationClip> { Idle() };
            }
        }

        private static AnimationClip Rename(AnimationClip clip, string name)
        {
            clip.name = name;
            return clip;
        }

        /// <summary>
        /// Crea (o regenera) los clips y el AnimatorController del personaje
        /// en Assets/Characters/[Name]/Animations. Devuelve el controller.
        /// </summary>
        public static AnimatorController BuildController(string character)
        {
            string folder = $"Assets/Characters/{character}/Animations";
            StylizedMaterialLibrary.EnsureFolder(folder);

            string controllerPath = $"{folder}/{character}_Controller.controller";
            AssetDatabase.DeleteAsset(controllerPath);
            var controller = AnimatorController.CreateAnimatorControllerAtPath(controllerPath);

            bool first = true;
            foreach (var clip in ClipsFor(character))
            {
                string clipPath = $"{folder}/{character}_{clip.name}.anim";
                AssetDatabase.DeleteAsset(clipPath);
                AssetDatabase.CreateAsset(clip, clipPath);

                var state = controller.AddMotion(clip);
                state.name = clip.name;
                if (first)
                {
                    controller.layers[0].stateMachine.defaultState = state;
                    first = false;
                }
            }

            AssetDatabase.SaveAssets();
            return controller;
        }
    }
}
