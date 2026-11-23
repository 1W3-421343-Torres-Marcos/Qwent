---
name: android-packaging
description: Usar al configurar Capacitor, orientación horizontal, modo inmersivo de Android, scripts de compilación Gradle o generación del APK por fase.
---

# Módulo: Android Packaging (Capacitor + Gradle)

## Especificaciones Técnicas
- **Capacitor**: Configurar `capacitor.config.ts` apuntando `webDir` a la salida de compilación Angular (`dist/qwent/browser` o equivalente) y `appId` fijo offline (ej. `com.qwent.tw3gwent`).
- **Orientación bloqueada**: Configurar `android:screenOrientation="sensorLandscape"` en `AndroidManifest.xml` para la `MainActivity` (permite rotar 180° en horizontal sin pasar nunca a vertical).
- **Modo pantalla completa inmersivo**: En `MainActivity.java` / `MainActivity.kt` y `styles.xml`, usar exclusivamente `WindowCompat.setDecorFitsSystemWindows(window, false)` + `WindowInsetsControllerCompat` (`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`) reaplicado en `onWindowFocusChanged` (sin la API deprecada `SYSTEM_UI_FLAG_IMMERSIVE_STICKY`), y soporte para recortes de pantalla (`LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES`).
- **Script reproducible de fase (`npm run build:apk`)**:
  - Implementado en `scripts/build-apk.mjs` leyendo la fase/versión actual o parámetro de fase (ej. `--phase=f1`). Debe ser multiplataforma (detectar `process.platform === 'win32'` para ejecutar `gradlew.bat` vs. `./gradlew` con `cwd: 'android'`) y validar `JAVA_HOME` y `ANDROID_HOME` (o `android/local.properties`) antes de compilar.
  - Flujo estricto: `npm test` (falla si algún test está en rojo) -> `npm run build` -> `npx cap sync android` -> Gradle `assembleDebug` -> copia de `app-debug.apk` a `builds/apks/gwent-<phase>-debug.apk` (fuera de `dist/` para que `npm run build` de Angular no borre APKs previos; agregar `builds/` a `.gitignore`).
- **Alternativa CI**: Workflow opcional `.github/workflows/build-apk.yml` para compilar con JDK + Android SDK en caso de ejecutar en entornos sin Android Studio local.

## Reglas de Negocio
- **100% Offline y permisos mínimos**: Eliminar explícitamente `android.permission.INTERNET` de `AndroidManifest.xml` y verificar en F1 que el WebView local de Capacitor arranca 100% offline sin ese permiso. No declarar permisos de cámara, ubicación, contactos ni almacenamiento externo.
- **Entregable obligatorio por fase**: Ninguna fase (F1–F6) se considera terminada sin ejecutar los tests en verde y generar su `.apk` versionado verificando que arranca sin pantallas en blanco ni errores de WebView.
- **Recursos nativos (F6)**: Ícono adaptativo (`mipmap-*`) y splash screen empaquetados localmente en `android/app/src/main/res/`.

## Archivos que Toca
- `capacitor.config.ts`
- `package.json` (scripts `build:apk`, `cap:sync`)
- `.gitignore` (`builds/`)
- `scripts/build-apk.mjs`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/.../MainActivity.*`
- `android/app/src/main/res/values/styles.xml`
- `android/app/build.gradle`
- `.github/workflows/build-apk.yml` (opcional)

## Criterios de Aceptación
- [x] Capacitor inicializado y sincronizado con el bundle de Angular.
- [x] La app arranca forzada en orientación `sensorLandscape` y modo inmersivo sin barras visibles.
- [x] `npm run build:apk` ejecuta tests, compila web, sincroniza Android y genera `builds/apks/gwent-f<N>-debug.apk` sin intervención manual.
- [ ] El APK de la fase se instala/arranca correctamente 100% offline (sin `android.permission.INTERNET`) y muestra la versión/fase actual.
- [x] (F6) Ícono adaptativo y splash screen configurados y auditado sin permisos ni tráfico externo.
