-- Reescribe los links relativos para que funcionen desde el PDF:
--   · a un .md de esta carpeta  → su PDF hermano;
--   · a cualquier cosa fuera de specs/evidencia-m3/ → el archivo en GitHub,
--     porque el PDF puede viajar solo, sin el repo al lado.
-- Los links absolutos (http, mailto) no cambian. DOC_DIR es la carpeta del
-- .md relativa a specs/evidencia-m3/ (la pasa generar.sh).

local REPO = 'https://github.com/Javote/real-world-real-estate/blob/main/'
local BASE = 'specs/evidencia-m3'

local function normalizar(ruta)
  local partes = {}
  for p in ruta:gmatch('[^/]+') do
    if p == '..' then table.remove(partes)
    elseif p ~= '.' then table.insert(partes, p) end
  end
  return table.concat(partes, '/')
end

function Link(el)
  local t = el.target
  if t:match('^%a[%w+.-]*:') or t:match('^#') then return el end
  local ruta, ancla = t:match('^([^#]*)(#?.*)$')
  local dir = os.getenv('DOC_DIR') or '.'
  local absoluta = normalizar(BASE .. '/' .. dir .. '/' .. ruta)
  if absoluta:sub(1, #BASE + 1) ~= BASE .. '/' and absoluta ~= BASE then
    el.target = REPO .. absoluta .. ancla
  else
    el.target = ruta:gsub('%.md$', '.pdf') .. ancla
  end
  return el
end
