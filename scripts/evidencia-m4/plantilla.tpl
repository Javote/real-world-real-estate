<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>$pagetitle$</title>
<style>
$css$
</style>
$if(portada)$<style>@page :first { margin: 0; @bottom-left { content: none; } }</style>$endif$
</head>
<body>
$if(portada)$
<section class="portada">
  <div class="banda">
    <div class="etiqueta">$etiqueta$</div>
    <div class="titulo">$titulo$</div>
    <p class="bajada">$bajada$</p>
    <p class="datos">Project Catalyst 1400106 · Real-World Real Estate: Pre-Sale with Proof &amp; Release · $fecha$</p>
  </div>
</section>
$endif$
<main class="$if(sinsalto)$sin-salto$endif$">
$body$
</main>
</body>
</html>
