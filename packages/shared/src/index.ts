// Contrato único API↔web (D-012, regla 6 de CLAUDE.md).
//
// Todo lo que cruza la frontera entre apps/api y apps/web se declara acá una
// sola vez. La API valida con estos schemas; el front importa los tipos
// inferidos. Si la forma de una respuesta cambia de un lado y no cambia acá, el
// typecheck del otro lado falla — que es el punto.
export * from "./auth";
