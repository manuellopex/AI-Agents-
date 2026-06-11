using System.Collections.Generic;
using UnityEngine;

namespace IslaAuria.Characters
{
    /// <summary>
    /// Controlador de la escena CharacterShowcase: cambia la animación de
    /// todos los personajes a la vez con las teclas 1-9 / flechas, o con los
    /// botones en pantalla (útil en móvil). Cada personaje reproduce el
    /// estado si su Animator lo contiene; si no, se queda en Idle.
    /// </summary>
    public class ShowcaseAnimationCycler : MonoBehaviour
    {
        [Tooltip("Animators de los personajes alineados en el showcase.")]
        public List<Animator> characters = new List<Animator>();

        [Tooltip("Estados disponibles en orden (deben coincidir con los clips).")]
        public List<string> states = new List<string>
        {
            "Idle", "Run", "Jump", "SpinAttack", "Hit", "Victory", "Cast",
        };

        private int index;

        private void Update()
        {
            // Teclas numéricas directas
            for (int i = 0; i < states.Count && i < 9; i++)
            {
                if (Input.GetKeyDown(KeyCode.Alpha1 + i)) Play(i);
            }
            // Flechas para recorrer
            if (Input.GetKeyDown(KeyCode.RightArrow)) Play((index + 1) % states.Count);
            if (Input.GetKeyDown(KeyCode.LeftArrow)) Play((index - 1 + states.Count) % states.Count);
        }

        private void Play(int stateIndex)
        {
            index = stateIndex;
            string state = states[index];
            foreach (var animator in characters)
            {
                if (animator == null) continue;
                // Solo reproducir si el estado existe en su controller
                if (animator.HasState(0, Animator.StringToHash(state)))
                {
                    animator.CrossFade(state, 0.15f);
                }
                else
                {
                    animator.CrossFade("Idle", 0.15f);
                }
            }
        }

        private void OnGUI()
        {
            // Botonera simple para revisar animaciones en el editor o móvil
            const int width = 110;
            const int height = 42;
            GUILayout.BeginArea(new Rect(12, 12, width + 8, (height + 6) * states.Count + 30));
            GUILayout.Label($"Animación: {states[index]}");
            for (int i = 0; i < states.Count; i++)
            {
                if (GUILayout.Button(states[i], GUILayout.Width(width), GUILayout.Height(height)))
                {
                    Play(i);
                }
            }
            GUILayout.EndArea();
        }
    }
}
