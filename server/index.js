const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const Anthropic = require('@anthropic-ai/sdk')
const catalogo = require('./catalogo')
const rateLimit = require('express-rate-limit')

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
const limitador = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 15,
  message: { error: 'Has alcanzado el límite de análisis por hora. Inténtalo de nuevo más tarde.' },
})

// Ruta de prueba, para comprobar que el servidor esta vivo
app.get('/', (req, res) => {
  res.send('Servidor de testigos funcionando correctamente')
})
// Ruta que devuelve el catalogo completo, para la pantalla de busqueda manual
app.get('/catalogo', (req, res) => {
  res.json(catalogo)
})
// Ruta que busca talleres cercanos usando la ubicacion del usuario
app.get('/talleres', limitador, async (req, res) => {
  try {
    const { lat, lng } = req.query

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Faltan las coordenadas de ubicacion' })
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=car_repair&key=${process.env.GOOGLE_PLACES_API_KEY}`

    const respuestaGoogle = await fetch(url)
    const datos = await respuestaGoogle.json()

    if (datos.status !== 'OK' && datos.status !== 'ZERO_RESULTS') {
      console.error('Error de Google Places:', datos.status, datos.error_message)
      return res.status(500).json({ error: 'Error al buscar talleres', detalle: datos.status })
    }

    const talleres = (datos.results || []).slice(0, 10).map((t) => ({
      nombre: t.name,
      direccion: t.vicinity,
      valoracion: t.rating || null,
      abiertoAhora: t.opening_hours ? t.opening_hours.open_now : null,
    }))

    res.json({ talleres })
  } catch (error) {
    console.error('Error al buscar talleres:', error)
    res.status(500).json({ error: 'Error al buscar talleres' })
  }
})

// Ruta principal: recibe una foto en base64 y devuelve el testigo identificado
app.post('/analizar', limitador, async (req, res) => {
  try {
    const { imagenBase64, tipoImagen } = req.body

    if (!imagenBase64) {
      return res.status(400).json({ error: 'No se ha recibido ninguna imagen' })
    }

    // Preparamos el catalogo para la IA, con nombre y significado para diferenciar iconos parecidos
    const listaTestigos = catalogo
      .map((t) => `${t.id}: ${t.nombre} (${t.categoria}) — ${t.significado}`)
      .join('\n')

    const mensaje = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: tipoImagen || 'image/jpeg',
                data: imagenBase64,
              },
            },
            {
              type: 'text',
              text: `Esta es una foto de un testigo (icono) del salpicadero de un coche. Analiza con atencion la FORMA EXACTA del icono: su silueta, los simbolos que contiene dentro, y su color.\n\nAqui tienes la lista de testigos posibles, con su ID, nombre y significado:\n\n${listaTestigos}\n\nTen especial cuidado en no confundir iconos que comparten una silueta parecida (por ejemplo, varios testigos usan una forma redondeada u ovalada con un simbolo de exclamacion dentro, pero cada uno tiene detalles distintos como una herradura para neumaticos o un circulo con letras para frenos).\n\nDevuelve UNICAMENTE el ID de 3 digitos del testigo que mas se parezca a la imagen (por ejemplo: "018"). Si no estas seguro o no coincide con ninguno, devuelve exactamente: "NINGUNO". No escribas nada mas, ni explicaciones, solo el ID o "NINGUNO".`,
            },
          ],
        },
      ],
    })

    const respuestaTextoOriginal = mensaje.content[0].text.trim()
    console.log('Respuesta de la IA:', respuestaTextoOriginal)

    const coincidenciaId = respuestaTextoOriginal.match(/\d{3}/)
    const respuestaTexto = coincidenciaId ? coincidenciaId[0] : respuestaTextoOriginal

    if (respuestaTexto === 'NINGUNO') {
      return res.json({ encontrado: false })
    }

    const testigoEncontrado = catalogo.find((t) => t.id === respuestaTexto)

    if (!testigoEncontrado) {
      return res.json({ encontrado: false })
    }

    res.json({ encontrado: true, testigo: testigoEncontrado })
  } catch (error) {
    console.error('Error al analizar la imagen:', error)
    res.status(500).json({ error: 'Error al analizar la imagen' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})