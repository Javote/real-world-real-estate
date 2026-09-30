# scripts/video-walkthrough

Las herramientas del runbook del video walkthrough —
[`specs/GUION-2026-09-21-video-walkthrough.md`](../../specs/GUION-2026-09-21-video-walkthrough.md),
ítem 3.12 / criterio 13—. **El runbook dice cuándo se usa cada una**; esto es solo el índice.
Todas se corren desde la raíz del repo y funcionan con lo que trae esta Mac (bash 3.2 de macOS,
Node, Chrome). ffmpeg es opcional.

| Paso | Herramienta | Qué hace |
|---|---|---|
| 0 | `preparar.sh` | Crea `~/Movies/propnexus-walkthrough/` y `~/Movies/propnexus-evidencia/` (con la evidencia), chequea disco, Chrome, Node y ffmpeg, y corre el verificador. Se puede repetir |
| 0, 1, 6 | `verificar-produccion.mjs` | **Solo lectura.** Entra con los cinco roles y compara lo que ve cada uno con lo que el runbook espera; saldo de tADA de la wallet de servicio. `--despues` para después de la sesión B |
| 1 | `sesion.sh` | En una Terminal aparte durante cada sesión: esconde el escritorio, manda las grabaciones a la carpeta, ofrece cerrar apps ruidosas, despierta Render y lo mantiene despierto. `Ctrl-C` deshace todo |
| 1 | `chrome.sh` | Abre un Chrome aparte (perfil `PropNexus Demo`: sin guardar contraseñas, sin traductor) con las cinco pestañas en `/login` |
| 2 | `renombrar.sh A\|B\|C` | Al final de cada sesión, pone `Txx.mov` a sus grabaciones en orden; si sobran (tomas repetidas), pregunta cuáles descartar |
| 4, 5 | `estudio/servidor.mjs` | El estudio en `http://127.0.0.1:8765`: graba la voz de cada toma mirando el video, con la frase en pantalla en su segundo, y guarda `Txx.webm`. Sin ffmpeg, también arma el video final |
| 5 | `unir.sh` | Con ffmpeg: une video y voz de cada toma, pega las 28 y escribe `walkthrough-final.mp4` y `.srt` |
| — | `evidencia/` | Los tres archivos que se suben en T15 (ficticios, marcados como tales) y `generar.sh` para regenerarlos desde `fuentes/` |
| — | `lib/` | `tomas.mjs` lee las tomas y la narración **del runbook** (única fuente: el estudio y los subtítulos salen de ahí); `api.mjs`, el acceso a la API |

**Las contraseñas** las leen `verificar-produccion.mjs` y `preparar.sh` de `SEED_DEMO_PASSWORD` y
`SEED_ADMIN_PASSWORD` del entorno o de `apps/api/.env`; nunca se imprimen.

**Probado el 2026-09-28:** el estudio de punta a punta con Playwright (micrófono simulado, voz
guardada, montaje en el navegador con H.264 + AAC y subtítulos), `unir.sh` con una voz del estudio
y una de QuickTime (la primera frase entra en 0:01,1), `renombrar.sh` con una toma de más y con
tomas de menos, las preferencias del perfil de Chrome, y `preparar.sh` y el verificador contra
producción. **No probado a propósito:** `chrome.sh` y `sesion.sh` abren ventanas y cambian ajustes
de la Mac; se validaron con `bash -n` y en partes.
