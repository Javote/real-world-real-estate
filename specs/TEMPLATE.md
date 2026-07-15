# SPEC-NNN — Título

> Máximo 2 páginas. El número se pide bajo demanda: fila nueva en `specs/README.md` en el mismo PR que crea la spec. Si el código y la spec divergen, se corrige la spec (o el código) en el mismo PR en que se detecta.

## Propósito

Qué problema resuelve esta pieza y por qué existe. 2-4 líneas.

## Alcance / NO-alcance

- **Cubre:** …
- **NO cubre:** … (explícito: lo que alguien podría asumir que está y no está)

## Interfaz

Endpoints / funciones / datum-redeemer expuestos, con entradas y salidas. Tablas o firmas, no prosa.

## Invariantes

Afirmaciones que deben ser verdad siempre, en imperativo verificable. Cada invariante debería poder convertirse en un test.

## Casos borde (definen los tests)

Lista de situaciones límite con el comportamiento esperado. Estos casos son la base de la suite de tests: si un caso borde no está acá, el test no existe.

## Preguntas abiertas

Lo que esta spec no resuelve todavía, con dueño si lo hay. Si una pregunta se cierra, se mueve la decisión a DECISIONS.md y se actualiza acá.
