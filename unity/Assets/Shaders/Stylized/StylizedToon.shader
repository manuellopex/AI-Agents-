// IslaAuria/StylizedToon
// -----------------------
// Shader toon estilizado para URP, optimizado para móvil:
//  - Rampa de luz suave (cel shading con borde controlable)
//  - Tinte de sombra (sombras coloreadas, nunca negras)
//  - Rim light suave
//  - Especular toon sutil
//  - Emisión HDR (para partes mágicas: Auralis, Noxia, Liora)
//  - Outline opcional (ancho 0 = desactivado, sin coste)
//  - Soporta transparencia vía propiedades de blend (las configura
//    StylizedMaterialLibrary, no hace falta tocarlas a mano)
Shader "IslaAuria/StylizedToon"
{
    Properties
    {
        _BaseMap ("Base Map", 2D) = "white" {}
        _BaseColor ("Base Color", Color) = (1, 1, 1, 1)

        _RampSmooth ("Ramp Smoothness", Range(0.01, 1)) = 0.3
        _ShadowTint ("Shadow Tint", Color) = (0.62, 0.58, 0.72, 1)

        _Smoothness ("Specular Smoothness", Range(0, 1)) = 0.25
        _SpecIntensity ("Specular Intensity", Range(0, 1)) = 0.2

        _RimColor ("Rim Color", Color) = (1.0, 0.95, 0.82, 1)
        _RimPower ("Rim Power", Range(0.5, 8)) = 3.0
        _RimIntensity ("Rim Intensity", Range(0, 2)) = 0.35

        [HDR] _EmissionColor ("Emission Color", Color) = (0, 0, 0, 1)

        _OutlineColor ("Outline Color", Color) = (0.12, 0.1, 0.16, 1)
        _OutlineWidth ("Outline Width", Range(0, 0.02)) = 0

        // Configurados por código según el material sea opaco o transparente
        [HideInInspector] _SrcBlend ("Src Blend", Float) = 1
        [HideInInspector] _DstBlend ("Dst Blend", Float) = 0
        [HideInInspector] _ZWrite ("Z Write", Float) = 1
    }

    SubShader
    {
        Tags
        {
            "RenderType" = "Opaque"
            "RenderPipeline" = "UniversalPipeline"
            "Queue" = "Geometry"
        }

        // ------------------------------------------------------------
        // Pase de outline (inverted hull). Con _OutlineWidth = 0 los
        // vértices no se desplazan y el pase no aporta píxeles.
        // ------------------------------------------------------------
        Pass
        {
            Name "Outline"
            Tags { "LightMode" = "SRPDefaultUnlit" }
            Cull Front
            ZWrite [_ZWrite]

            HLSLPROGRAM
            #pragma vertex OutlineVert
            #pragma fragment OutlineFrag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
                half4 _BaseColor;
                half _RampSmooth;
                half4 _ShadowTint;
                half _Smoothness;
                half _SpecIntensity;
                half4 _RimColor;
                half _RimPower;
                half _RimIntensity;
                half4 _EmissionColor;
                half4 _OutlineColor;
                half _OutlineWidth;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
            };

            Varyings OutlineVert(Attributes input)
            {
                Varyings output;
                float3 posOS = input.positionOS.xyz + normalize(input.normalOS) * _OutlineWidth;
                output.positionCS = TransformObjectToHClip(posOS);
                return output;
            }

            half4 OutlineFrag(Varyings input) : SV_Target
            {
                return half4(_OutlineColor.rgb, 1);
            }
            ENDHLSL
        }

        // ------------------------------------------------------------
        // Pase principal de iluminación toon
        // ------------------------------------------------------------
        Pass
        {
            Name "StylizedForward"
            Tags { "LightMode" = "UniversalForward" }
            Blend [_SrcBlend] [_DstBlend]
            ZWrite [_ZWrite]
            Cull Back

            HLSLPROGRAM
            #pragma vertex ToonVert
            #pragma fragment ToonFrag

            // Mantener los variants al mínimo para móvil
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #pragma multi_compile_fog

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            TEXTURE2D(_BaseMap);
            SAMPLER(sampler_BaseMap);

            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
                half4 _BaseColor;
                half _RampSmooth;
                half4 _ShadowTint;
                half _Smoothness;
                half _SpecIntensity;
                half4 _RimColor;
                half _RimPower;
                half _RimIntensity;
                half4 _EmissionColor;
                half4 _OutlineColor;
                half _OutlineWidth;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float2 uv : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float2 uv : TEXCOORD0;
                float3 positionWS : TEXCOORD1;
                float3 normalWS : TEXCOORD2;
                half fogFactor : TEXCOORD3;
            };

            Varyings ToonVert(Attributes input)
            {
                Varyings output;
                VertexPositionInputs positionInputs = GetVertexPositionInputs(input.positionOS.xyz);
                output.positionCS = positionInputs.positionCS;
                output.positionWS = positionInputs.positionWS;
                output.normalWS = TransformObjectToWorldNormal(input.normalOS);
                output.uv = TRANSFORM_TEX(input.uv, _BaseMap);
                output.fogFactor = ComputeFogFactor(positionInputs.positionCS.z);
                return output;
            }

            half4 ToonFrag(Varyings input) : SV_Target
            {
                half4 baseTex = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, input.uv);
                half3 albedo = baseTex.rgb * _BaseColor.rgb;
                half alpha = baseTex.a * _BaseColor.a;

                float3 normalWS = normalize(input.normalWS);
                float3 viewDirWS = normalize(GetWorldSpaceViewDir(input.positionWS));

                float4 shadowCoord = TransformWorldToShadowCoord(input.positionWS);
                Light mainLight = GetMainLight(shadowCoord);

                // Rampa toon: transición suave alrededor del terminador
                half NdotL = dot(normalWS, mainLight.direction);
                half lightStep = smoothstep(0.0, _RampSmooth, NdotL) * mainLight.shadowAttenuation;

                // Sombras coloreadas (nunca negro puro: legibilidad en móvil)
                half3 lit = lerp(albedo * _ShadowTint.rgb, albedo, lightStep) * mainLight.color;

                // Luz ambiente del cielo (sondas/SH)
                half3 ambient = SampleSH(normalWS) * albedo * 0.55;

                // Especular toon: punto de brillo con corte limpio
                float3 halfDir = normalize(mainLight.direction + viewDirWS);
                half specDot = saturate(dot(normalWS, halfDir));
                half spec = smoothstep(0.5, 0.55, pow(specDot, exp2(8.0 * _Smoothness)));
                half3 specular = spec * _SpecIntensity * mainLight.color * lightStep;

                // Rim light suave, más fuerte en el lado iluminado
                half rim = pow(1.0 - saturate(dot(viewDirWS, normalWS)), _RimPower);
                half3 rimLight = rim * _RimIntensity * _RimColor.rgb * (0.4 + 0.6 * lightStep);

                half3 color = lit + ambient + specular + rimLight + _EmissionColor.rgb;
                color = MixFog(color, input.fogFactor);
                return half4(color, alpha);
            }
            ENDHLSL
        }

        // ------------------------------------------------------------
        // Pase de sombras (para que los personajes proyecten sombra)
        // ------------------------------------------------------------
        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode" = "ShadowCaster" }
            ZWrite On
            ZTest LEqual
            ColorMask 0
            Cull Back

            HLSLPROGRAM
            #pragma vertex ShadowVert
            #pragma fragment ShadowFrag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"

            float3 _LightDirection;

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
            };

            Varyings ShadowVert(Attributes input)
            {
                Varyings output;
                float3 positionWS = TransformObjectToWorld(input.positionOS.xyz);
                float3 normalWS = TransformObjectToWorldNormal(input.normalOS);
                output.positionCS = TransformWorldToHClip(ApplyShadowBias(positionWS, normalWS, _LightDirection));
                #if UNITY_REVERSED_Z
                    output.positionCS.z = min(output.positionCS.z, UNITY_NEAR_CLIP_VALUE);
                #else
                    output.positionCS.z = max(output.positionCS.z, UNITY_NEAR_CLIP_VALUE);
                #endif
                return output;
            }

            half4 ShadowFrag(Varyings input) : SV_Target
            {
                return 0;
            }
            ENDHLSL
        }
    }

    FallBack "Universal Render Pipeline/Simple Lit"
}
