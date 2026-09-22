import { useState, useEffect } from 'react'

const iconosCategoria = {
  'Motor': '🔧',
  'Combustible Y Autonomia': '⛽',
  'Frenos': '🛑',
  'Neumaticos': '🛞',
  'Electrico Y Bateria': '🔋',
  'Direccion': '🕹️',
  'Transmision': '⚙️',
  'Seguridad Y Asistencia A La Conduccion': '🛡️',
  'Suspension Y Traccion': '🏔️',
  'Iluminacion': '💡',
  'Carroceria Y Puertas': '🚪',
  'Mantenimiento General E Hibridos/Electricos': '🛠️',
}

const colorGravedad = {
  Critico: 'bg-red-500',
  Atencion: 'bg-amber-500',
  Informativo: 'bg-emerald-500',
}

function App() {
  const [vista, setVista] = useState('inicio') // inicio | categorias | testigos | resultado
  const [catalogoCompleto, setCatalogoCompleto] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  const [foto, setFoto] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [talleresLista, setTalleresLista] = useState([])
  const [cargandoTalleres, setCargandoTalleres] = useState(false)
  const [errorTalleres, setErrorTalleres] = useState(null)

  useEffect(() => {
    fetch('https://testigos-app-backend.onrender.com/catalogo')
      .then((r) => r.json())
      .then((datos) => setCatalogoCompleto(datos))
      .catch((err) => console.error('Error al cargar el catalogo:', err))
  }, [])

  const categorias = [...new Set(catalogoCompleto.map((t) => t.categoria))]

  const manejarFoto = async (evento) => {
    const archivo = evento.target.files[0]
    if (!archivo) return

    setFoto(URL.createObjectURL(archivo))
    setResultado(null)
    setError(null)
    setCargando(true)

    try {
      const base64 = await convertirABase64(archivo)

      const respuesta = await fetch('https://testigos-app-backend.onrender.com/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagenBase64: base64, tipoImagen: archivo.type }),
      })

      const datos = await respuesta.json()

      if (datos.encontrado) {
        setResultado(datos.testigo)
        setVista('resultado')
      } else {
        setError('No hemos podido identificar el testigo con seguridad.')
      }
    } catch (err) {
      console.error(err)
      setError('Ha ocurrido un error al analizar la foto. Inténtalo de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  const convertirABase64 = (archivo) => {
    return new Promise((resolve, reject) => {
      const lector = new FileReader()
      lector.readAsDataURL(archivo)
      lector.onload = () => resolve(lector.result.split(',')[1])
      lector.onerror = (error) => reject(error)
    })
  }

  const irAInicio = () => {
    setVista('inicio')
    setFoto(null)
    setResultado(null)
    setError(null)
    setBusqueda('')
  }

  const seleccionarTestigo = (testigo) => {
    setResultado(testigo)
    setVista('resultado')
  }
  const buscarTalleres = () => {
    setCargandoTalleres(true)
    setErrorTalleres(null)
    setTalleresLista([])

    if (!navigator.geolocation) {
      setErrorTalleres('Tu navegador no permite acceder a la ubicación.')
      setCargandoTalleres(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (posicion) => {
        const { latitude, longitude } = posicion.coords
        try {
          const respuesta = await fetch(
            `https://testigos-app-backend.onrender.com/talleres?lat=${latitude}&lng=${longitude}`
          )
          const datos = await respuesta.json()

          if (datos.talleres) {
            setTalleresLista(datos.talleres)
          } else {
            setErrorTalleres('No se han podido cargar los talleres.')
          }
        } catch (err) {
          console.error(err)
          setErrorTalleres('Error al buscar talleres cercanos.')
        } finally {
          setCargandoTalleres(false)
        }
      },
      () => {
        setErrorTalleres('No hemos podido acceder a tu ubicación. Revisa los permisos del navegador.')
        setCargandoTalleres(false)
      }
    )
  }

  const testigosFiltrados = busqueda
    ? catalogoCompleto.filter((t) =>
        t.nombre.toLowerCase().includes(busqueda.toLowerCase())
      )
    : catalogoCompleto.filter((t) => t.categoria === categoriaActiva)

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center px-6 text-center py-10">
      <h1 className="text-3xl font-bold text-white mb-2">
        ¿Qué significa ese testigo?
      </h1>
      <p className="text-slate-400 mb-8">
        Identifica en segundos el aviso de tu salpicadero
      </p>

      {/* PANTALLA INICIO */}
      {vista === 'inicio' && (
        <div className="w-full max-w-xs flex flex-col items-center">
          {foto && !resultado && (
            <img
              src={foto}
              alt="Foto del testigo"
              className="w-full rounded-2xl mb-6 border border-slate-700"
            />
          )}

          {cargando && <p className="text-slate-300 mb-6">Analizando la foto...</p>}

          {error && (
            <div className="w-full bg-slate-800 rounded-2xl p-5 mb-6">
              <p className="text-slate-300 mb-4">{error}</p>
              <button onClick={irAInicio} className="text-orange-400 underline text-sm">
                Intentar de nuevo
              </button>
            </div>
          )}

          {!foto && (
            <>
              <label className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-2xl text-lg mb-4 transition cursor-pointer">
                📷 Escanear testigo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={manejarFoto}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => setVista('categorias')}
                className="text-slate-400 hover:text-white underline text-sm transition"
              >
                Buscar en catálogo
              </button>
            </>
          )}
        </div>
      )}

      {/* PANTALLA CATEGORIAS */}
      {vista === 'categorias' && (
        <div className="w-full max-w-sm">
          <input
            type="text"
            placeholder="Buscar testigo por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-xl px-4 py-3 mb-5 outline-none border border-slate-700 focus:border-orange-500"
          />

          {busqueda ? (
            <div className="flex flex-col gap-2 text-left">
              {testigosFiltrados.length === 0 && (
                <p className="text-slate-500 text-sm">No se han encontrado testigos.</p>
              )}
              {testigosFiltrados.map((t) => (
                <button
                  key={t.id}
                  onClick={() => seleccionarTestigo(t)}
                  className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 rounded-xl px-4 py-3 transition text-left"
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${colorGravedad[t.gravedad]}`}></span>
                  <span className="text-white text-sm">{t.nombre}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {categorias.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategoriaActiva(cat)
                    setVista('testigos')
                  }}
                  className="bg-slate-800 hover:bg-slate-700 rounded-2xl p-4 transition flex flex-col items-center gap-2"
                >
                  <span className="text-3xl">{iconosCategoria[cat] || '🚗'}</span>
                  <span className="text-white text-xs font-medium">{cat}</span>
                </button>
              ))}
            </div>
          )}

          <button onClick={irAInicio} className="text-slate-400 hover:text-white underline text-sm mt-6">
            ← Volver al inicio
          </button>
        </div>
      )}

      {/* PANTALLA TESTIGOS DE UNA CATEGORIA */}
      {vista === 'testigos' && (
        <div className="w-full max-w-sm">
          <h2 className="text-white text-lg font-semibold mb-4">{categoriaActiva}</h2>
          <div className="flex flex-col gap-2 text-left mb-6">
            {testigosFiltrados.map((t) => (
              <button
                key={t.id}
                onClick={() => seleccionarTestigo(t)}
                className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 rounded-xl px-4 py-3 transition text-left"
              >
                <span className={`w-2.5 h-2.5 rounded-full ${colorGravedad[t.gravedad]}`}></span>
                <span className="text-white text-sm">{t.nombre}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setVista('categorias')}
            className="text-slate-400 hover:text-white underline text-sm"
          >
            ← Volver a categorías
          </button>
        </div>
      )}
      {/* PANTALLA TALLERES CERCANOS */}
      {vista === 'talleres' && (
        <div className="w-full max-w-sm">
          <h2 className="text-white text-lg font-semibold mb-4">Talleres cercanos</h2>

          {cargandoTalleres && (
            <p className="text-slate-300 mb-6">Buscando talleres cerca de ti...</p>
          )}

          {errorTalleres && (
            <p className="text-slate-400 text-sm mb-6">{errorTalleres}</p>
          )}

          <div className="flex flex-col gap-3 text-left mb-6">
            {talleresLista.map((t, i) => (
              <div key={i} className="bg-slate-800 rounded-xl px-4 py-3">
                <p className="text-white text-sm font-semibold">{t.nombre}</p>
                <p className="text-slate-400 text-xs mt-1">{t.direccion}</p>
                {t.valoracion && (
                  <p className="text-slate-400 text-xs mt-1">⭐ {t.valoracion}</p>
                )}
              </div>
            ))}
          </div>

          <button onClick={irAInicio} className="text-slate-400 hover:text-white underline text-sm">
            ← Volver al inicio
          </button>
        </div>
      )}

      {/* PANTALLA RESULTADO */}
      {vista === 'resultado' && resultado && (
        <div className="w-full max-w-xs bg-slate-800 rounded-2xl p-5 text-left">
          <span
            className={`inline-block ${colorGravedad[resultado.gravedad]} text-white text-xs font-semibold px-3 py-1 rounded-full mb-3`}
          >
            {resultado.gravedad}
          </span>
          <h2 className="text-white text-xl font-bold mb-2">{resultado.nombre}</h2>
          <p className="text-slate-300 text-sm mb-3">{resultado.significado}</p>
          <p className="text-slate-400 text-sm mb-4">
            <span className="text-white font-semibold">Qué hacer: </span>
            {resultado.accion}
          </p>

          {resultado.tipo === 'Solucionable' && resultado.producto && (
            
              <a
              href={"https://www.amazon.es/s?k=" + encodeURIComponent(resultado.producto) + "&tag=testigosapp-21"}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-orange-500 hover:bg-orange-600 text-white text-center font-semibold py-3 rounded-xl mb-3 transition"
            >
              🛒 Ver producto: {resultado.producto}
            </a>
          )}

          {resultado.tipo === 'Requiere taller' && (
            <button
              onClick={() => {
                setVista('talleres')
                buscarTalleres()
              }}
              className="block w-full bg-blue-500 hover:bg-blue-600 text-white text-center font-semibold py-3 rounded-xl mb-3 transition"
            >
              🔧 Ver talleres cercanos
            </button>
          )}

          <button onClick={irAInicio} className="text-orange-400 underline text-sm">
            Volver al inicio
          </button>
        </div>
      )}
    </div>
  )
}

export default App