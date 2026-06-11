using UnityEngine;

namespace IslaAuria.Characters
{
    /// <summary>
    /// Comportamiento de seguimiento de Oryn: corre detrás de Mael con un
    /// retardo elástico, mira hacia donde se mueve y reacciona con pequeños
    /// saltos de alegría cuando se queda quieto cerca de él.
    /// </summary>
    public class OrynFollower : MonoBehaviour
    {
        [Tooltip("Transform de Mael (o de quien deba seguir).")]
        public Transform target;
        [Tooltip("Distancia a la que se detiene del objetivo.")]
        public float followDistance = 1.6f;
        [Tooltip("Distancia a partir de la cual corre para alcanzarlo.")]
        public float runDistance = 3.5f;
        public float walkSpeed = 2.5f;
        public float runSpeed = 6f;
        public float turnSpeed = 10f;

        [Header("Personalidad")]
        [Tooltip("Cada cuántos segundos (aprox.) hace un saltito si está ocioso.")]
        public float happyHopInterval = 4f;
        public float hopHeight = 0.25f;

        private Animator animator;
        private Vector3 velocity;
        private float hopTimer;
        private float hopPhase = -1f;
        private float baseY;

        private void Awake()
        {
            animator = GetComponent<Animator>();
            hopTimer = happyHopInterval;
            baseY = transform.position.y;
        }

        private void Update()
        {
            if (target == null) return;

            Vector3 toTarget = target.position - transform.position;
            toTarget.y = 0f;
            float distance = toTarget.magnitude;

            // Velocidad deseada según la distancia (quieto / trote / carrera)
            float speed = 0f;
            if (distance > runDistance) speed = runSpeed;
            else if (distance > followDistance) speed = walkSpeed;

            Vector3 desired = distance > 0.01f ? toTarget.normalized * speed : Vector3.zero;
            velocity = Vector3.Lerp(velocity, desired, Time.deltaTime * 6f);
            transform.position += velocity * Time.deltaTime;

            // Girar hacia el movimiento (o hacia Mael si está quieto)
            Vector3 lookDir = velocity.sqrMagnitude > 0.05f ? velocity : toTarget;
            if (lookDir.sqrMagnitude > 0.001f)
            {
                Quaternion look = Quaternion.LookRotation(lookDir.normalized, Vector3.up);
                transform.rotation = Quaternion.Slerp(transform.rotation, look, Time.deltaTime * turnSpeed);
            }

            UpdateHappyHop(speed <= 0.01f);

            if (animator != null)
            {
                animator.SetFloat("Speed", velocity.magnitude);
            }
        }

        /// <summary>Saltito de alegría cuando está ocioso junto a Mael.</summary>
        private void UpdateHappyHop(bool idle)
        {
            if (hopPhase >= 0f)
            {
                hopPhase += Time.deltaTime * 4f;
                float height = Mathf.Sin(Mathf.Clamp01(hopPhase) * Mathf.PI) * hopHeight;
                Vector3 pos = transform.position;
                pos.y = baseY + height;
                transform.position = pos;
                if (hopPhase >= 1f) hopPhase = -1f;
                return;
            }

            baseY = transform.position.y;
            if (!idle) { hopTimer = happyHopInterval; return; }

            hopTimer -= Time.deltaTime;
            if (hopTimer <= 0f)
            {
                hopPhase = 0f;
                hopTimer = happyHopInterval * Random.Range(0.7f, 1.4f);
            }
        }
    }
}
