// El logo: tres barras ascendentes + el nombre en dos líneas, como en las 70
// capturas. Va en **todo** GradientHeader — M2-D3 §Usage rules: "Never omit the
// logo — it is the role-agnostic anchor".
//
// El nombre no sale del diccionario: es una marca, no una traducción (D-018).

export function PropNexusMark() {
  return (
    <span className="flex items-center gap-s2">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" fill="currentColor">
        <rect x="1" y="16" width="6" height="11" rx="1" />
        <rect x="10" y="9" width="6" height="18" rx="1" />
        <rect x="19" y="1" width="6" height="26" rx="1" />
      </svg>
      <span className="text-body font-bold leading-tight">
        Prop
        <br />
        Nexus
      </span>
    </span>
  )
}
